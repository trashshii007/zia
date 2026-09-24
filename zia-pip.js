// Zia: picture-in-picture, loaded into each picture-in-picture window by
// zia.uc.js. It restyles Firefox's controls like Dia's and lets the window
// tuck into the side of the screen. Self-contained, so it keeps working
// whichever browser window opened it.
(() => {
  if (window.__ziaPipLoaded) {
    return;
  }
  window.__ziaPipLoaded = true;

  const HTML = "http://www.w3.org/1999/xhtml";
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
  const svg = (body) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">${body}</svg>`)}")`;
  const icons = {
    pause: svg('<rect x="5.5" y="3" width="4.4" height="18" rx="2.2"/><rect x="14.1" y="3" width="4.4" height="18" rx="2.2"/>'),
    play: svg('<path d="M7 4.2v15.6c0 1.1 1.2 1.8 2.2 1.2l12.4-7.8a1.4 1.4 0 0 0 0-2.4L9.2 3c-1-.6-2.2.1-2.2 1.2z"/>'),
    back: svg(
      '<path d="M12 4.5a7.5 7.5 0 1 1-7.1 5.1" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M12 1.6v5.8L8.6 4.5z"/><text x="12" y="15.4" font-family="-apple-system,system-ui,sans-serif" font-size="7.4" font-weight="700" text-anchor="middle">15</text>'
    ),
    forward: svg(
      '<path d="M12 4.5a7.5 7.5 0 1 0 7.1 5.1" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/><path d="M12 1.6v5.8l3.4-2.9z"/><text x="12" y="15.4" font-family="-apple-system,system-ui,sans-serif" font-size="7.4" font-weight="700" text-anchor="middle">15</text>'
    ),
    toTab: svg('<path d="M16.5 16.5L7 7M7 7v7.2M7 7h7.2" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
    close: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>'),
  };

  const style = document.createElementNS(HTML, "style");
  style.textContent = `
    :root[zia-dia] {
      --zia-pip-ease: cubic-bezier(0.2, 0.9, 0.3, 1);

      /* the dark tint over the video while the pointer is over it */
      & #controls::before {
        content: "";
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.32);
        opacity: 0;
        pointer-events: none;
        transition: opacity 150ms ease;
      }
      & #controls:is(:hover, [showing], [keying])::before {
        opacity: 1;
        transition-duration: 90ms;
      }

      & #controls-bottom-gradient,
      & #timestamp,
      & .end-controls,
      & .control-item::after {
        display: none !important;
      }

      & .control-item {
        transition: opacity 150ms ease, scale 150ms ease, background-color 120ms ease;
      }
      & #controls:is(:hover, [showing], [keying]) .control-item {
        opacity: 1;
        transition-duration: 90ms, 200ms, 120ms;
      }
      & #controls:hover .control-item:not(:hover) {
        opacity: 1;
      }

      /* "Back to Tab" and "Close" as frosted pills along the top */
      & #unpip,
      & #close {
        top: 12px !important;
        width: auto !important;
        max-width: none !important;
        height: 30px !important;
        padding: 0 12px 0 32px !important;
        border-radius: 9px !important;
        background-color: rgba(255, 255, 255, 0.14) !important;
        background-position: 11px center !important;
        background-size: 15px !important;
        backdrop-filter: blur(14px) saturate(1.4);
        color: white;
        font: 600 13px/30px -apple-system, system-ui, sans-serif;
        white-space: nowrap;
      }
      & #unpip:hover,
      & #close:hover {
        background-color: rgba(255, 255, 255, 0.24) !important;
      }
      & #unpip {
        left: 12px !important;
        right: auto !important;
        background-image: ${icons.toTab} !important;
        &::before {
          content: "Back to Tab";
        }
      }
      & #close {
        right: 12px !important;
        left: auto !important;
        background-image: ${icons.close} !important;
        &::before {
          content: "Close";
        }
      }

      & .zia-pip-host {
        position: absolute;
        top: 12px;
        left: 50%;
        translate: -50% 0;
        max-width: calc(100% - 260px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: white;
        font: 600 13px/30px -apple-system, system-ui, sans-serif;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        opacity: 0;
        pointer-events: none;
        transition: opacity 150ms ease;
      }
      & #controls:is(:hover, [showing], [keying]) .zia-pip-host {
        opacity: 1;
        transition-duration: 90ms;
      }

      /* skip back, play or pause, skip forward: large, in the middle */
      & #controls-bottom {
        position: static;
      }
      & .controls-bottom-lower {
        display: contents;
      }
      & .center-controls {
        position: absolute;
        top: 50%;
        left: 50%;
        translate: -50% -50%;
        gap: clamp(14px, 6vw, 34px);
        align-items: center;
      }
      & .center-controls .control-button {
        width: clamp(28px, 9vmin, 40px) !important;
        max-width: none !important;
        height: clamp(28px, 9vmin, 40px) !important;
        background-size: 100% !important;
        background-color: transparent !important;
        scale: 0.9;
      }
      & #playpause {
        width: clamp(40px, 15vmin, 64px) !important;
        height: clamp(40px, 15vmin, 64px) !important;
        background-size: 76% !important;
      }
      & #controls.playing #playpause {
        background-image: ${icons.pause} !important;
      }
      & #controls:not(.playing) #playpause {
        background-image: ${icons.play} !important;
      }
      & #seekBackward {
        background-image: ${icons.back} !important;
      }
      & #seekForward {
        background-image: ${icons.forward} !important;
      }
      & #controls:is(:hover, [showing], [keying]) .center-controls .control-button {
        scale: 1;
      }
      & .center-controls .control-button:active {
        scale: 0.92 !important;
      }

      /* a thin progress line along the bottom */
      & .controls-bottom-upper {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 12px;
        height: 14px;
      }
      & .scrubber-no-drag,
      & #scrubber {
        width: 100%;
        height: 14px;
        margin: 0;
      }
      & #scrubber {
        &::-moz-range-track {
          height: 3px;
          border-radius: 2px;
          background-color: rgba(255, 255, 255, 0.28);
        }
        &::-moz-range-progress {
          height: 3px;
          border-radius: 2px;
          background-color: white;
        }
        &::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border: none;
          border-radius: 50%;
          background-color: white;
          scale: 0;
          transition: scale 120ms ease;
        }
        &:hover::-moz-range-thumb {
          scale: 1;
        }
      }
    }

    /* tucked into the side of the screen: only a sliver shows, with sound bars */
    .zia-pip-sliver {
      display: none;
    }
    :root[zia-tucked] {
      & .zia-pip-sliver {
        display: flex;
        position: fixed;
        top: 0;
        bottom: 0;
        width: 18px;
        z-index: 10;
        align-items: center;
        justify-content: center;
        background: rgba(20, 20, 22, 0.88);
        -moz-window-dragging: drag;
        cursor: pointer;
      }
      & .zia-pip-sliver::after {
        content: "";
        width: 14px;
        height: 14px;
        background: url("chrome://sine/content/zia/icons/sound-still.svg") center / contain no-repeat;
        -moz-context-properties: fill;
        fill: white;
      }
      &:has(#controls.playing) .zia-pip-sliver::after {
        background-image: url("chrome://sine/content/zia/icons/sound-wave.svg");
      }
      & #controls {
        visibility: hidden;
      }
    }
    :root[zia-tucked="right"] .zia-pip-sliver {
      left: 0;
    }
    :root[zia-tucked="left"] .zia-pip-sliver {
      right: 0;
    }
  `;
  document.head.appendChild(style);

  const host = document.createElementNS(HTML, "div");
  host.className = "zia-pip-host";
  controls.appendChild(host);
  try {
    const { PictureInPicture } = ChromeUtils.importESModule("resource://gre/modules/PictureInPicture.sys.mjs");
    const browser = PictureInPicture.weakWinToBrowser?.get(window);
    host.textContent = browser?.currentURI?.host || "";
  } catch (err) {
  }

  const sliver = document.createElementNS(HTML, "div");
  sliver.className = "zia-pip-sliver";
  document.body.appendChild(sliver);

  const applyLook = () => root.toggleAttribute("zia-dia", pref("zia.pip.dia-style", true));
  applyLook();
  Services.prefs.addObserver("zia.pip.dia-style", applyLook);
  window.addEventListener("unload", () => Services.prefs.removeObserver("zia.pip.dia-style", applyLook));

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

  // Tucking: push the window against the left or right side of the screen
  // and it slides away until only a sliver shows. Point at the sliver and it
  // slides back out; move away and it tucks again. Drag it off the edge and
  // it stays out.
  const SLIVER = 18;
  const EDGE = 4;
  const MARGIN = 16;
  let state = "free";
  let side = null;
  let animating = false;
  let lastX = window.screenX;
  let lastY = window.screenY;
  let movedAt = 0;
  let stillSince = Date.now();
  let leaveTimer = 0;

  const screenBox = () => {
    const s = window.screen;
    return { left: s.availLeft, right: s.availLeft + s.availWidth };
  };
  const glide = (x) => {
    animating = true;
    const from = window.screenX;
    const y = window.screenY;
    const start = performance.now();
    const duration = 260;
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
    root.setAttribute("zia-tucked", edge);
    const box = screenBox();
    glide(edge === "right" ? box.right - SLIVER : box.left - window.outerWidth + SLIVER);
  };
  const slideOut = () => {
    state = "out";
    root.removeAttribute("zia-tucked");
    const box = screenBox();
    glide(side === "right" ? box.right - window.outerWidth - MARGIN : box.left + MARGIN);
  };
  const release = () => {
    clearTimeout(leaveTimer);
    state = "free";
    side = null;
    root.removeAttribute("zia-tucked");
  };

  document.addEventListener("mouseover", () => {
    clearTimeout(leaveTimer);
    if (state === "tucked" && !animating) {
      slideOut();
    }
  });
  document.documentElement.addEventListener("mouseleave", () => {
    if (state === "out") {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (state === "out") {
          tuck(side);
        }
      }, 700);
    }
  });

  setInterval(() => {
    if (animating || document.fullscreenElement || !pref("zia.pip.tuck", true)) {
      if (state !== "free" && !pref("zia.pip.tuck", true)) {
        release();
      }
      return;
    }
    const x = window.screenX;
    const y = window.screenY;
    if (x !== lastX || y !== lastY) {
      // Being dragged: a tucked or slid-out window that's moved is free again.
      lastX = x;
      lastY = y;
      movedAt = Date.now();
      stillSince = movedAt;
      if (state !== "free") {
        release();
      }
      return;
    }
    // Only after the user has just dragged it there, never where Firefox first
    // puts it.
    const justDragged = Date.now() - movedAt < 1500;
    if (state === "free" && justDragged && Date.now() - stillSince > 250) {
      const box = screenBox();
      if (x + window.outerWidth >= box.right - EDGE) {
        tuck("right");
      } else if (x <= box.left + EDGE) {
        tuck("left");
      }
    }
  }, 100);
})();
