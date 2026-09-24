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

  const ZEN_FOLDER_ANIMATION_MS = 180;
  const FOLDER_SETTLE_MS = 180;
  const FOLDER_BOUNCE_PX = 1;
  const FOLDER_SELECTOR = "zen-folder, tab-group:not([split-view-group])";

  const isFolder = (el) =>
    el?.localName === "zen-folder" || (el?.localName === "tab-group" && !el.hasAttribute("split-view-group"));

  function bounceFolderBox(folder, opening) {
    const total = ZEN_FOLDER_ANIMATION_MS + FOLDER_SETTLE_MS;
    const arrive = (ZEN_FOLDER_ANIMATION_MS - 20) / total;
    const peak = (ZEN_FOLDER_ANIMATION_MS + 60) / total;
    for (const pseudoElement of ["::before", "::after"]) {
      const bottom = parseFloat(getComputedStyle(folder, pseudoElement).bottom) || 0;
      const past = opening ? bottom - FOLDER_BOUNCE_PX : bottom + FOLDER_BOUNCE_PX;
      folder.animate(
        [
          { bottom: `${bottom}px`, offset: 0 },
          { bottom: `${bottom}px`, offset: arrive, easing: "ease-out" },
          { bottom: `${past}px`, offset: peak, easing: "ease-in-out" },
          { bottom: `${bottom}px`, offset: 1 },
        ],
        { duration: total, pseudoElement }
      );
    }
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
    const tabs = document.getElementById("tabbrowser-tabs");
    if (!tabs) {
      return;
    }
    new MutationObserver((mutations) => {
      if (!Services.prefs.getBoolPref("zia.folders.bounce", true)) {
        return;
      }
      for (const mutation of mutations) {
        const folder = mutation.target;
        if (!isFolder(folder)) {
          continue;
        }
        const collapsedNow = folder.hasAttribute("collapsed");
        const wasCollapsed = mutation.oldValue !== null;
        if (collapsedNow === wasCollapsed) {
          continue;
        }
        try {
          bounceFolderBox(folder,  !collapsedNow);
        } catch (err) {
          console.error("[Zia] Folder bounce failed:", err);
        }
      }
    }).observe(tabs, {
      subtree: true,
      attributes: true,
      attributeFilter: ["collapsed"],
      attributeOldValue: true,
    });
    console.info("[Zia] Folder bounce ready");
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
    }
  }

