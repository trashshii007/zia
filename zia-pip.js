// Zia: picture-in-picture, loaded into each picture-in-picture window by
// zia.uc.js. It restyles Firefox's controls like Dia's (zia-pip.css) and lets
// the window tuck into the side of the screen. Self-contained, so it keeps
// working whichever browser window opened it.
(() => {
  if (window.__ziaPipLoaded) {
    return;
  }
  window.__ziaPipLoaded = true;

  const HTML = "http://www.w3.org/1999/xhtml";
  const SHEET_URL = "chrome://sine/content/zia/zia-pip.css";
  const root = document.documentElement;
  const controls = document.getElementById("controls");
  if (!controls) {
    return;
  }
  const pref = (name, fallback) => {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch (err) {
      return fallback;
    }
  };

  // The page only allows chrome: URLs, so the styles come from a real file.
  // A user sheet from windowUtils isn't subject to the page's rules at all;
  // the <link> is a fallback.
  try {
    window.windowUtils.loadSheetUsingURIString(SHEET_URL, window.windowUtils.AUTHOR_SHEET);
  } catch (err) {
    const link = document.createElementNS(HTML, "link");
    link.rel = "stylesheet";
    link.href = SHEET_URL;
    document.head.appendChild(link);
  }

  const make = (tag, className, parent) => {
    const el = document.createElementNS(HTML, tag);
    el.className = className;
    parent.appendChild(el);
    return el;
  };

  // Zia's own top bar: "Back to Tab", the site, the tuck button and "Close".
  // Firefox's corner buttons fight any restyling, so they're hidden and
  // ours press them.
  const topBar = make("div", "zia-pip-top", controls);
  const back = make("button", "zia-pip-pill zia-pip-back control-item", topBar);
  back.textContent = "Back to Tab";
  const host = make("div", "zia-pip-host control-item", topBar);
  let sourceBrowser = null;
  try {
    const { PictureInPicture } = ChromeUtils.importESModule("resource://gre/modules/PictureInPicture.sys.mjs");
    sourceBrowser = PictureInPicture.weakWinToBrowser?.get(window) || null;
    host.textContent = sourceBrowser?.currentURI?.host || "";
  } catch (err) {
    console.debug("[Zia] picture-in-picture: site name", err);
  }
  const end = make("div", "zia-pip-end", topBar);
  const tuckButton = make("button", "zia-pip-pill zia-pip-tuck-button control-item", end);
  const closeButton = make("button", "zia-pip-pill zia-pip-close control-item", end);
  closeButton.textContent = "Close";
  // Keep our clicks away from Firefox's own click handling on #controls.
  const press = (id) => (event) => {
    event.stopPropagation();
    document.getElementById(id)?.click();
  };
  back.addEventListener("click", press("unpip"));
  closeButton.addEventListener("click", press("close"));

  const sliver = make("div", "zia-pip-sliver", document.body);

  const applyPrefs = () => {
    root.toggleAttribute("zia-dia", pref("zia.pip.dia-style", true));
    root.toggleAttribute("zia-tuck-on", pref("zia.pip.tuck", true));
  };
  applyPrefs();
  Services.prefs.addObserver("zia.pip.", applyPrefs);
  window.addEventListener("unload", () => Services.prefs.removeObserver("zia.pip.", applyPrefs));

  // Live streams get no progress line or time. Firefox hides them only for a
  // video with no length at all, but most live streams report one that keeps
  // growing. Zen's own player counts 900,000 seconds or more as live; Zia
  // asks the tab's media controller and does the same.
  const LIVE_SECONDS = 900000;
  try {
    const controller = sourceBrowser?.browsingContext?.mediaController;
    if (controller) {
      const showLive = (duration) => root.toggleAttribute("zia-live", Number.isFinite(duration) ? duration >= LIVE_SECONDS : duration === Infinity);
      try {
        showLive(controller.getPositionState()?.duration);
      } catch (err) {
        // No position yet; the event below brings it
      }
      const onPosition = (event) => showLive(event.duration);
      controller.addEventListener("positionstatechange", onPosition);
      window.addEventListener("unload", () => controller.removeEventListener("positionstatechange", onPosition));
    }
  } catch (err) {
    console.debug("[Zia] picture-in-picture: live check", err);
  }

  // Firefox skips 5 seconds; Dia's buttons skip 15, so each press skips three times.
  let repeating = false;
  for (const id of ["seekBackward", "seekForward"]) {
    const button = document.getElementById(id);
    button?.addEventListener("click", () => {
      if (repeating || !root.hasAttribute("zia-dia")) {
        return;
      }
      repeating = true;
      try {
        button.click();
        button.click();
      } finally {
        repeating = false;
      }
    });
  }

  // Tucking. Two ways in: the tuck button, or throw the window at the left
  // or right side of the screen. Let go with a good part of it off the side,
  // or flick it quickly at a side, and it springs the rest of the way in.
  // Tucked, only a strip with an arrow shows. Pointing at it only
  // nudges the video out a little, so passing over it does nothing. Two
  // ways out, and either way it stays out until you tuck it again: click
  // the strip and the video slides back onto the screen, or hold the strip
  // and drag it out sideways.
  const SLIVER = 24;
  const NUDGE = 12;
  const TUCK_OFF = 0.3; // this much of the window past a side tucks it
  const FLING_SPEED = 1.2; // px per ms toward a side as it's let go
  const FLING_REACH = 160; // and within this many px of that side
  const MARGIN = 16;
  let state = "free"; // "free" or "tucked"
  let side = null;
  let animating = false;
  let lastX = window.screenX;
  let lastY = window.screenY;
  let movedAt = 0;
  let trail = []; // [time, x] while the window is being dragged
  let glideId = 0;

  const screenBox = () => {
    const s = window.screen;
    return { left: s.availLeft, right: s.availLeft + s.availWidth };
  };
  const nearestEdge = () => {
    const box = screenBox();
    const middle = window.screenX + window.outerWidth / 2;
    return middle > (box.left + box.right) / 2 ? "right" : "left";
  };
  // How far the window is past either side, as a share of TUCK_OFF: 0 on
  // the screen, 1 where letting go would tuck it. It frosts the video over
  // as it goes (zia-pip.css).
  const veil = (progress) => root.style.setProperty("--zia-veil", Math.min(1, Math.max(0, progress)).toFixed(3));
  const pastSide = () => {
    const box = screenBox();
    const width = window.outerWidth;
    const off = Math.max(window.screenX + width - box.right, box.left - window.screenX, 0);
    return off / width / TUCK_OFF;
  };

  // Where the window was let go: far enough past a side, or flicked at one
  const tuckEdge = () => {
    const box = screenBox();
    const width = window.outerWidth;
    if ((window.screenX + width - box.right) / width >= TUCK_OFF) {
      return "right";
    }
    if ((box.left - window.screenX) / width >= TUCK_OFF) {
      return "left";
    }
    const last = trail.at(-1);
    const first = last && trail.find(([time]) => last[0] - time <= 150);
    if (!first || first === last) {
      return null;
    }
    const speed = (last[1] - first[1]) / (last[0] - first[0] || 1);
    if (speed > FLING_SPEED && box.right - (window.screenX + width) < FLING_REACH) {
      return "right";
    }
    if (speed < -FLING_SPEED && window.screenX - box.left < FLING_REACH) {
      return "left";
    }
    return null;
  };
  const updateButton = () => {
    root.setAttribute("zia-edge", side || nearestEdge());
    tuckButton.setAttribute("tooltip", "Tuck into the side");
  };
  // A newer glide takes over from one still running.
  // `spring` runs a little past the end and settles back
  const glide = (x, duration = 280, done = null, spring = false) => {
    animating = true;
    const id = ++glideId;
    const from = window.screenX;
    const y = window.screenY;
    const start = performance.now();
    const step = (now) => {
      if (id !== glideId) {
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      const eased = spring ? 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2) : 1 - Math.pow(1 - t, 3);
      window.moveTo(Math.round(from + (x - from) * eased), y);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
        lastX = window.screenX;
        lastY = window.screenY;
        done?.();
      }
    };
    requestAnimationFrame(step);
  };
  const tuck = (edge) => {
    side = edge;
    state = "tucked";
    root.setAttribute("zia-tucked", edge);
    root.removeAttribute("zia-nudged");
    root.removeAttribute("zia-emerging");
    updateButton();
    glide(tuckedX(0), 360, null, true);
  };
  // Where the tucked window sits, with `extra` more of it showing.
  const tuckedX = (extra) => {
    const box = screenBox();
    return side === "right" ? box.right - SLIVER - extra : box.left - window.outerWidth + SLIVER + extra;
  };
  const nudge = (out) => {
    if (state !== "tucked" || root.hasAttribute("zia-nudged") === out) {
      return;
    }
    root.toggleAttribute("zia-nudged", out);
    glide(tuckedX(out ? NUDGE : 0), 160);
  };
  // Where the window sits fully back on the screen, by the side it was
  // tucked into.
  const outX = () => {
    const box = screenBox();
    return side === "right" ? box.right - window.outerWidth - MARGIN : box.left + MARGIN;
  };
  // The strip stays over the window's edge and fades as the window slides
  // in, so no slice of video flashes at the side of the screen first. Once
  // out, the window is free and stays where it is.
  const slideOut = (duration = 280) => {
    root.removeAttribute("zia-nudged");
    root.setAttribute("zia-emerging", "");
    glide(outX(), duration, release);
  };
  const release = () => {
    state = "free";
    side = null;
    root.removeAttribute("zia-tucked");
    root.removeAttribute("zia-nudged");
    root.removeAttribute("zia-emerging");
    updateButton();
  };
  updateButton();

  tuckButton.addEventListener("click", (event) => {
    event.stopPropagation();
    if (state === "free") {
      tuck(nearestEdge());
    }
  });

  // Pointing at the strip nudges the video out a little; clicking brings it
  // all the way out. Holding it and dragging sideways, away from the side,
  // pulls the window out under the pointer, and letting go settles it fully
  // on the screen. Dragging it up or down instead moves the tucked window
  // along the side, and it stays tucked where it's left.
  const PULL_OUT = 4;
  let dragFrom = null;
  let dragMode = null; // null until the pointer has moved: "along" or "out"
  sliver.addEventListener("mouseenter", () => nudge(true));
  sliver.addEventListener("mouseleave", () => {
    if (!dragFrom) {
      nudge(false);
    }
  });
  sliver.addEventListener("pointerdown", (event) => {
    if (state !== "tucked" || event.button !== 0) {
      return;
    }
    glideId++;
    animating = false;
    dragFrom = { x: event.screenX, y: event.screenY, windowX: window.screenX, windowY: window.screenY };
    dragMode = null;
    sliver.setPointerCapture(event.pointerId);
  });
  sliver.addEventListener("pointermove", (event) => {
    if (!dragFrom) {
      return;
    }
    const dx = event.screenX - dragFrom.x;
    const dy = event.screenY - dragFrom.y;
    if (!dragMode) {
      if (Math.abs(dx) < PULL_OUT && Math.abs(dy) < PULL_OUT) {
        return;
      }
      const outward = side === "right" ? -dx : dx;
      dragMode = outward > Math.abs(dy) ? "out" : "along";
      root.setAttribute("zia-dragging", dragMode);
      if (dragMode === "out") {
        root.removeAttribute("zia-nudged");
      }
    }
    const s = window.screen;
    const y = Math.round(Math.min(s.availTop + s.availHeight - window.outerHeight, Math.max(s.availTop, dragFrom.windowY + dy)));
    let x = window.screenX;
    if (dragMode === "out") {
      // Follows the pointer out, but never back past the tucked position or
      // further than fully on the screen
      const from = tuckedX(0);
      const to = outX();
      x = Math.round(Math.min(Math.max(from, to), Math.max(Math.min(from, to), dragFrom.windowX + dx)));
    }
    if (dragMode === "out") {
      const from = tuckedX(0);
      veil(1 - (x - from) / (outX() - from || 1));
    }
    window.moveTo(x, y);
    lastX = x;
    lastY = y;
  });
  const endDrag = (event) => {
    if (!dragFrom) {
      return;
    }
    const mode = dragMode;
    dragFrom = null;
    dragMode = null;
    root.removeAttribute("zia-dragging");
    if (sliver.hasPointerCapture?.(event.pointerId)) {
      sliver.releasePointerCapture(event.pointerId);
    }
    if (mode === "out") {
      // Pulled out: it stays out, sliding the rest of the way onto the screen
      slideOut(200);
    } else if (mode === "along") {
      if (!sliver.matches(":hover")) {
        nudge(false);
      }
    } else if (event.type === "pointerup" && state === "tucked") {
      // A click, not a drag
      slideOut();
    }
  };
  sliver.addEventListener("pointerup", endDrag);
  sliver.addEventListener("pointercancel", endDrag);

  setInterval(() => {
    const enabled = pref("zia.pip.tuck", true);
    if (!enabled || document.fullscreenElement) {
      if (state !== "free") {
        release();
      }
      return;
    }
    if (animating) {
      return;
    }
    const x = window.screenX;
    const y = window.screenY;
    const now = Date.now();
    // Moved straight up or down while tucked: dragged along the side, so it
    // stays tucked. (Dragging the strip moves the window itself and keeps
    // lastX and lastY in step, so it never looks like a drag of the window.)
    if (state === "tucked" && x === lastX && y !== lastY) {
      lastY = y;
      return;
    }
    if (x !== lastX || y !== lastY) {
      // Being dragged: a tucked window that's moved is free again.
      if (now - movedAt > 300) {
        trail = [];
      }
      lastX = x;
      lastY = y;
      movedAt = now;
      trail.push([now, x]);
      if (trail.length > 20) {
        trail.shift();
      }
      if (state !== "free") {
        release();
      }
      const past = pastSide();
      root.toggleAttribute("zia-leaving", past > 0);
      veil(past);
      updateButton();
      return;
    }
    // Just let go after a drag (never where Firefox first puts it): tuck if
    // it was thrown at a side.
    const sinceMove = now - movedAt;
    if (state === "free" && trail.length && sinceMove > 200) {
      const edge = tuckEdge();
      trail = [];
      if (edge) {
        veil(1);
        tuck(edge);
      } else {
        veil(0);
      }
      // Tucked, the strip's own frosting takes over; otherwise it clears
      setTimeout(() => root.removeAttribute("zia-leaving"), 120);
    }
  }, 40);
})();
