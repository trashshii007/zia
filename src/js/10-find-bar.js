  function isOverPage(event) {
    const box = gBrowser.tabbox.getBoundingClientRect();
    const inPage =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    return inPage && !isOverCollapsedSidebar(event);
  }

  function isOverCollapsedSidebar(event) {
    if (root.getAttribute("zen-compact-mode") !== "true") {
      return false;
    }
    const toolbox = document.getElementById("navigator-toolbox");
    if (!toolbox) {
      return false;
    }
    const box = toolbox.getBoundingClientRect();

    if (box.right <= 0) {
      return false;
    }
    return event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
  }

  function shortenFindCount(findbar) {
    const label = findbar?.querySelector?.(".found-matches");
    if (!label || label.__ziaCount) {
      return;
    }
    label.__ziaCount = true;
    const update = () => {
      const numbers = (label.getAttribute("value") || label.textContent || "").match(/\d[\d,.]*/g);
      label.setAttribute("zia-count", numbers?.length >= 2 ? `${numbers[0]}/${numbers[1]}` : numbers?.[0] || "");
    };
    new MutationObserver(update).observe(label, { attributes: true, attributeFilter: ["value"], childList: true, characterData: true, subtree: true });
    update();
  }

  function watchFindBars() {
    gBrowser.tabContainer.addEventListener("TabFindInitialized", (event) => {
      shortenFindCount(gBrowser.getCachedFindBar?.(event.target));
    });
    for (const tab of gBrowser.tabs) {
      if (gBrowser.isFindBarInitialized?.(tab)) {
        shortenFindCount(gBrowser.getCachedFindBar(tab));
      }
    }
  }

