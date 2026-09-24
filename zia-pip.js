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
  try {
    const { PictureInPicture } = ChromeUtils.importESModule("resource://gre/modules/PictureInPicture.sys.mjs");
    const browser = PictureInPicture.weakWinToBrowser?.get(window);
    host.textContent = browser?.currentURI?.host || "";
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

  const dropHint = make("div", "zia-pip-drop-hint", document.body);
  dropHint.textContent = "Let go to tuck away";
  const sliver = make("div", "zia-pip-sliver", document.body);

  const applyPrefs = () => {
    root.toggleAttribute("zia-dia", pref("zia.pip.dia-style", true));
    root.toggleAttribute("zia-tuck-on", pref("zia.pip.tuck", true));
  };
  applyPrefs();
  Services.prefs.addObserver("zia.pip.", applyPrefs);
  window.addEventListener("unload", () => Services.prefs.removeObserver("zia.pip.", applyPrefs));

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

  // Tucking. Two ways in: the tuck button, or drag the window against the
  // left or right side of the screen (a blue edge says "Let go to tuck
  // away"). Tucked, only a strip with an arrow shows. Pointing at it only
  // nudges the video out a little, so passing over it does nothing; click
  // it and the video slides back out, then tucks again when the pointer
  // leaves. Press the button again ("Keep it out") or drag it away to leave
  // it out.
  const SLIVER = 24;
  const NUDGE = 12;
  const ZONE = 24;
  const MARGIN = 16;
  let state = "free"; // "free", "tucked" or "out" (peeking from a tuck)
  let side = null;
  let animating = false;
  let lastX = window.screenX;
  let lastY = window.screenY;
  let movedAt = 0;
  let leaveTimer = 0;
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
  const edgeUnderWindow = () => {
    const box = screenBox();
    if (window.screenX + window.outerWidth >= box.right - ZONE) {
      return "right";
    }
    if (window.screenX <= box.left + ZONE) {
      return "left";
    }
    return null;
  };
  const updateButton = () => {
    root.setAttribute("zia-edge", side || nearestEdge());
    tuckButton.setAttribute("tooltip", state === "out" ? "Keep it out" : "Tuck into the side");
    tuckButton.toggleAttribute("zia-keep", state === "out");
  };
  // A newer glide takes over from one still running.
  const glide = (x, duration = 280, done = null) => {
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
      const eased = 1 - Math.pow(1 - t, 3);
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
    clearTimeout(leaveTimer);
    side = edge;
    state = "tucked";
    root.removeAttribute("zia-drop-hint");
    root.setAttribute("zia-tucked", edge);
    root.removeAttribute("zia-nudged");
    root.removeAttribute("zia-emerging");
    updateButton();
    glide(tuckedX(0));
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
  // The strip stays over the window's edge and fades as the window slides
  // in, so no slice of video flashes at the side of the screen first.
  const slideOut = () => {
    state = "out";
    root.removeAttribute("zia-nudged");
    root.setAttribute("zia-emerging", "");
    updateButton();
    const box = screenBox();
    glide(side === "right" ? box.right - window.outerWidth - MARGIN : box.left + MARGIN, 280, () => {
      if (state === "out") {
        root.removeAttribute("zia-tucked");
      }
      root.removeAttribute("zia-emerging");
    });
  };
  const release = () => {
    clearTimeout(leaveTimer);
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
    if (state === "out") {
      release();
    } else if (state === "free") {
      tuck(nearestEdge());
    }
  });

  // Pointing at the strip nudges the video out a little; clicking brings it
  // all the way back. Dragging it up or down moves the tucked window along
  // the side of the screen, and it stays tucked where it's left.
  let dragFrom = null;
  let dragged = false;
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
    dragFrom = { pointer: event.screenY, window: window.screenY };
    dragged = false;
    sliver.setPointerCapture(event.pointerId);
  });
  sliver.addEventListener("pointermove", (event) => {
    if (!dragFrom) {
      return;
    }
    const dy = event.screenY - dragFrom.pointer;
    if (!dragged && Math.abs(dy) < 4) {
      return;
    }
    dragged = true;
    root.setAttribute("zia-dragging", "");
    const s = window.screen;
    const top = s.availTop;
    const bottom = s.availTop + s.availHeight - window.outerHeight;
    const y = Math.round(Math.min(bottom, Math.max(top, dragFrom.window + dy)));
    window.moveTo(window.screenX, y);
    lastX = window.screenX;
    lastY = y;
  });
  const endDrag = (event) => {
    if (!dragFrom) {
      return;
    }
    dragFrom = null;
    root.removeAttribute("zia-dragging");
    if (sliver.hasPointerCapture?.(event.pointerId)) {
      sliver.releasePointerCapture(event.pointerId);
    }
    if (!sliver.matches(":hover")) {
      nudge(false);
    }
  };
  sliver.addEventListener("pointerup", endDrag);
  sliver.addEventListener("pointercancel", endDrag);
  sliver.addEventListener("click", () => {
    if (dragged) {
      dragged = false;
      return;
    }
    if (state === "tucked") {
      slideOut();
    }
  });
  document.addEventListener("mouseover", () => clearTimeout(leaveTimer));
  root.addEventListener("mouseleave", () => {
    if (state === "out") {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (state === "out") {
          tuck(side);
        }
      }, 800);
    }
  });

  setInterval(() => {
    const enabled = pref("zia.pip.tuck", true);
    if (!enabled || document.fullscreenElement) {
      if (state !== "free") {
        release();
      }
      root.removeAttribute("zia-drop-hint");
      return;
    }
    if (animating) {
      return;
    }
    const x = window.screenX;
    const y = window.screenY;
    const now = Date.now();
    // Moved straight up or down while tucked: dragged along the side, so it
    // stays tucked.
    if (state === "tucked" && x === lastX && y !== lastY) {
      lastY = y;
      return;
    }
    if (x !== lastX || y !== lastY) {
      // Being dragged: a tucked or peeking window that's moved is free again.
      lastX = x;
      lastY = y;
      movedAt = now;
      if (state !== "free") {
        release();
      }
      const edge = edgeUnderWindow();
      if (edge) {
        root.setAttribute("zia-drop-hint", edge);
      } else {
        root.removeAttribute("zia-drop-hint");
      }
      updateButton();
      return;
    }
    // Only when the user has just dragged it there and let go, never where
    // Firefox first puts it.
    const sinceMove = now - movedAt;
    if (state === "free" && sinceMove > 350 && sinceMove < 1500) {
      const edge = edgeUnderWindow();
      if (edge) {
        tuck(edge);
      }
    }
    if (sinceMove > 1500) {
      root.removeAttribute("zia-drop-hint");
    }
  }, 100);
})();
