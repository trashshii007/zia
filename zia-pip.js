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

  // The site, between "Back to Tab" and "Close"
  const host = make("div", "zia-pip-host", controls);
  try {
    const { PictureInPicture } = ChromeUtils.importESModule("resource://gre/modules/PictureInPicture.sys.mjs");
    const browser = PictureInPicture.weakWinToBrowser?.get(window);
    host.textContent = browser?.currentURI?.host || "";
  } catch (err) {
  }

  const tuckButton = make("button", "zia-pip-tuck-button control-item control-button", controls);
  const dropHint = make("div", "zia-pip-drop-hint", document.body);
  dropHint.textContent = "Let go to tuck away";
  const sliver = make("div", "zia-pip-sliver", document.body);

  // The tuck button sits just left of Close, whatever width Close is.
  const close = document.getElementById("close");
  if (close) {
    new window.ResizeObserver(() => {
      root.style.setProperty("--zia-close-width", `${close.offsetWidth}px`);
    }).observe(close);
  }

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

  // Tucking. Three ways in: the tuck button, or drag the window against the
  // left or right side of the screen (a blue edge says "Let go to tuck
  // away"). Tucked, only a strip with sound bars shows; point at it and the
  // video slides back out, then tucks again when the pointer leaves. Press
  // the button again ("Keep it out") or drag it away to leave it out.
  const SLIVER = 24;
  const ZONE = 24;
  const MARGIN = 16;
  let state = "free"; // "free", "tucked" or "out" (peeking from a tuck)
  let side = null;
  let animating = false;
  let lastX = window.screenX;
  let lastY = window.screenY;
  let movedAt = 0;
  let leaveTimer = 0;
  let hoverTimer = 0;

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
  const glide = (x) => {
    animating = true;
    const from = window.screenX;
    const y = window.screenY;
    const start = performance.now();
    const duration = 280;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      window.moveTo(Math.round(from + (x - from) * eased), y);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        animating = false;
        lastX = window.screenX;
        lastY = window.screenY;
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
    updateButton();
    const box = screenBox();
    glide(edge === "right" ? box.right - SLIVER : box.left - window.outerWidth + SLIVER);
  };
  const slideOut = () => {
    state = "out";
    root.removeAttribute("zia-tucked");
    updateButton();
    const box = screenBox();
    glide(side === "right" ? box.right - window.outerWidth - MARGIN : box.left + MARGIN);
  };
  const release = () => {
    clearTimeout(leaveTimer);
    state = "free";
    side = null;
    root.removeAttribute("zia-tucked");
    updateButton();
  };
  updateButton();

  tuckButton.addEventListener("click", () => {
    if (state === "out") {
      release();
    } else if (state === "free") {
      tuck(nearestEdge());
    }
  });

  // Point at the strip (briefly, so passing over it doesn't count) and the
  // video slides back out.
  sliver.addEventListener("mouseenter", () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (state === "tucked" && !animating) {
        slideOut();
      }
    }, 120);
  });
  sliver.addEventListener("mouseleave", () => clearTimeout(hoverTimer));
  sliver.addEventListener("click", () => {
    if (state === "tucked" && !animating) {
      clearTimeout(hoverTimer);
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
