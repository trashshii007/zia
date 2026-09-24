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

  // Zen slides a folder open and shut in 0.18s at an even pace. Zia gives
  // that slide a spring with a slight overshoot instead, the same one the
  // music player uses (--zia-spring), so the folder settles into place. Zen
  // moves the element that starts a folder's contents by its top margin;
  // Zia only changes the timing of that one animation.
  const FOLDER_SPRING = { duration: 420, easing: "cubic-bezier(0.32, 1.25, 0.5, 1)" };

  const FOLDER_SELECTOR = "zen-folder, tab-group:not([split-view-group])";

  const isFolder = (el) =>
    el?.localName === "zen-folder" || (el?.localName === "tab-group" && !el.hasAttribute("split-view-group"));

  const movesTopMargin = (keyframes) =>
    Array.isArray(keyframes) ? keyframes.some((frame) => frame && "marginTop" in frame) : !!keyframes && "marginTop" in keyframes;

  function springFolderAnimation(element, keyframes, options) {
    if (
      !element.classList?.contains("zen-tab-group-start") ||
      !isFolder(element.parentElement?.parentElement) ||
      !movesTopMargin(keyframes) ||
      !(typeof options === "object" && options?.duration > 0)
    ) {
      return options;
    }
    try {
      if (!Services.prefs.getBoolPref("zia.folders.bounce", true)) {
        return options;
      }
    } catch (err) {
      return options;
    }
    return { ...options, ...FOLDER_SPRING };
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
      return animate.call(this, keyframes, springFolderAnimation(this, keyframes, options));
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

