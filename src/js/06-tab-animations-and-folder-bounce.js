  function watchTabAnimations() {
    gBrowser.tabContainer.addEventListener("TabOpen", (event) => {
      const tab = event.target;
      if (tab.hasAttribute("zen-essential")) {
        return;
      }
      tab.setAttribute("zia-opening", "true");
      setTimeout(() => tab.removeAttribute("zia-opening"), 350);
    });

    const essentials = document.getElementById("zen-essentials");
    if (!essentials) {
      return;
    }
    const known = new WeakSet(essentials.querySelectorAll(".tabbrowser-tab"));
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!node.classList?.contains("tabbrowser-tab") || known.has(node)) {
            continue;
          }
          known.add(node);
          if (node.hasAttribute("zia-to-essential")) {
            continue;
          }
          node.setAttribute("zia-essential-enter", "true");
          setTimeout(() => node.removeAttribute("zia-essential-enter"), 450);
        }
      }
    }).observe(essentials, { childList: true, subtree: true });
  }

  // Zen slides a folder open and shut in 0.18s at an even pace. Zia turns
  // that slide into a spring: it eases in quickly, runs a few pixels past
  // where it's going, and settles back. Opening, the folder's box stretches a
  // little further than it needs to; closing, whatever is below the folder
  // bounces up a little. The overshoot is the same few pixels whatever the
  // folder's size, like the music player's, rather than growing with it.
  // Zen moves the element that starts a folder's contents by its top margin;
  // Zia only changes that one animation.
  const FOLDER_SPRING_MS = 420;
  const FOLDER_OVERSHOOT_PX = 3;
  const FOLDER_SELECTOR = "zen-folder, tab-group:not([split-view-group])";

  const isFolder = (el) =>
    el?.localName === "zen-folder" || (el?.localName === "tab-group" && !el.hasAttribute("split-view-group"));

  function springFolderAnimation(element, keyframes, options) {
    if (
      !element.classList?.contains("zen-tab-group-start") ||
      !isFolder(element.parentElement?.parentElement) ||
      !Array.isArray(keyframes) ||
      keyframes.length !== 2 ||
      !(typeof options === "object" && options?.duration > 0)
    ) {
      return null;
    }
    const from = parseFloat(keyframes[0]?.marginTop);
    const to = parseFloat(keyframes[1]?.marginTop);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) {
      return null;
    }
    try {
      if (!Services.prefs.getBoolPref("zia.folders.bounce", true)) {
        return null;
      }
    } catch (err) {
      return null;
    }
    // Opening, the margin rises to 0 and goes a little past; closing, it
    // falls and goes a little further, so the rows below rise past their
    // place and drop back.
    const past = to + Math.sign(to - from) * Math.min(FOLDER_OVERSHOOT_PX, Math.abs(to - from) / 4);
    return {
      closing: to < from,
      keyframes: [
        { marginTop: `${from}px`, offset: 0, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        { marginTop: `${past}px`, offset: 0.62, easing: "ease-in-out" },
        { marginTop: `${to}px`, offset: 1 },
      ],
      options: { ...options, duration: FOLDER_SPRING_MS, easing: "linear" },
    };
  }

  // Closing, the folder's contents shrink to nothing before the slide
  // overshoots, and a height can't go below nothing, so the overshoot alone
  // moves nothing. The folder's contents also pull up by the same few pixels
  // with a negative bottom margin as they arrive, so the folder's box and
  // everything below it rise past their place and drop back.
  function bounceUpAfterClosing(container, animate) {
    if (!container?.classList?.contains("tab-group-container")) {
      return;
    }
    animate.call(
      container,
      [
        { marginBottom: "0px", offset: 0 },
        { marginBottom: "0px", offset: 0.45, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        { marginBottom: `${-FOLDER_OVERSHOOT_PX}px`, offset: 0.66, easing: "ease-in-out" },
        { marginBottom: "0px", offset: 1 },
      ],
      { duration: FOLDER_SPRING_MS }
    );
  }

  function allowEmojiFolderIcons() {
    const picker = window.gZenEmojiPicker;
    if (!picker || typeof picker.open !== "function" || picker.open.__zia) {
      return;
    }
    const original = picker.open;
    const patched = function (anchor, options = {}) {
      if (options?.onlySvgIcons && anchor?.closest?.("zen-folder")) {
        options = { ...options, onlySvgIcons: false, emojiAsSVG: true };
      }
      return original.call(this, anchor, options);
    };
    patched.__zia = true;
    picker.open = patched;
  }

  function addFolderBounce() {
    const animate = Element.prototype.animate;
    if (animate.__zia) {
      return;
    }
    const patched = function (keyframes, options) {
      const spring = springFolderAnimation(this, keyframes, options);
      if (!spring) {
        return animate.call(this, keyframes, options);
      }
      if (spring.closing) {
        bounceUpAfterClosing(this.parentElement, animate);
      }
      return animate.call(this, spring.keyframes, spring.options);
    };
    patched.__zia = true;
    Element.prototype.animate = patched;
  }

  function hideWwwInUrlbar() {
    const original = gURLBar?._zenTrimURL;
    if (typeof original !== "function" || original.__zia) {
      return;
    }
    const wrapped = function (url) {
      let trimmed = original.call(this, url);
      if (typeof trimmed !== "string") {
        return trimmed;
      }
      trimmed = plainAddress(trimmed);
      if (gURLBar.hasAttribute("breakout-extend")) {
        return trimmed;
      }
      return trimmed;
    };
    wrapped.__zia = true;
    gURLBar._zenTrimURL = wrapped;
    try {
      gURLBar.setURI();
    } catch (err) {
      noteError("tab animations and folder bounce: hideWwwInUrlbar", err);
    }
  }

