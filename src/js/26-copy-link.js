  const TAB_CARD_DELAY = 600;
  const TAB_CARD_GRACE = 120;
  const TAB_CARD_GAP = 8;

  const ESSENTIAL_CARD_OVERLAP_X = 11;
  const ESSENTIAL_CARD_OVERLAP_Y = 2;
  const FOLDER_CARD_LIFT = 2;
  const DEFAULT_TAB_ICON = "chrome://sine/content/zia/icons/tab-default.svg";

  const TAB_CARD_ACTIONS = [
    {
      name: "essential",
      icon: "pin",
      label: "Add to Essentials",

      run: (tab) => gZenPinnedTabManager?.addToEssentials(tab),
      hidden: (tab) => tab.hasAttribute("zen-essential") || tab.pinned,
    },
    {
      name: "unpin",
      icon: "pinned-off",
      label: "Unpin",
      run: (tab) => {
        if (tab.hasAttribute("zen-essential")) {
          gZenPinnedTabManager?.removeEssentials(tab);
        } else {
          gBrowser.unpinTab(tab);
        }
      },
      hidden: (tab) => !tab.hasAttribute("zen-essential") && !tab.pinned,
    },
    {
      name: "bookmark",
      icon: "bookmark",
      label: "Bookmark",
      run: (tab) => bookmarkTab(tab),
      keepsCard: true,
    },
    {
      name: "split",
      icon: "layout-columns",
      label: "Add to Split",

      run: (tab) => {
        const other = tab === gBrowser.selectedTab ? lastUsedOtherTab(tab) : gBrowser.selectedTab;
        if (other) {
          gZenViewSplitter?.splitTabs(tab === gBrowser.selectedTab ? [tab, other] : [other, tab]);
        }
      },
      hidden: (tab) => !lastUsedOtherTab(tab),
    },
    {
      name: "copy",
      icon: "paperclip",
      label: "Copy link",
      run: (tab) => copyLink(tab),
      hidden: (tab) => tabCardKind(tab) !== "web",
      keepsCard: true,
    },
  ];

  function copyLink(tab) {
    const uri = tab?.linkedBrowser?.currentURI;
    if (!uri || !/^https?$/.test(uri.scheme)) {
      return;
    }
    if (tab === gBrowser.selectedTab && typeof window.gZenCommonActions?.copyCurrentURLToClipboard === "function") {
      window.gZenCommonActions.copyCurrentURLToClipboard();
      return;
    }
    Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(uri.displaySpec);
    try {
      window.gZenUIManager?.showToast?.("zen-copy-current-url-confirmation");
    } catch (err) {
      noteError("copy link: copyLink", err);
    }
  }

  function showCopied(button) {
    button.setAttribute("zia-copied", "true");
    const img = button.localName === "button" ? button.querySelector("img") : null;
    if (img) {
      img.setAttribute("src", "chrome://sine/content/zia/icons/tabler/outline/check.svg");
    }
    clearTimeout(button.ziaCopiedTimer);
    button.ziaCopiedTimer = setTimeout(() => {
      button.removeAttribute("zia-copied");
      img?.setAttribute("src", "chrome://sine/content/zia/icons/tabler/outline/paperclip.svg");
    }, 1200);
  }

  function addCopyLinkButton() {
    const siteData = document.getElementById("zen-site-data-icon-button");
    if (!siteData || document.getElementById("zia-copy-link-button")) {
      return;
    }
    const button = document.createXULElement("hbox");
    button.id = "zia-copy-link-button";
    button.className = "urlbar-page-action";
    button.setAttribute("role", "button");
    button.setAttribute("tooltiptext", "Copy link");
    const icon = document.createXULElement("image");
    icon.className = "urlbar-icon";
    button.appendChild(icon);
    button.addEventListener("click", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      try {
        copyLink(gBrowser.selectedTab);
        showCopied(button);
      } catch (err) {
        console.error("[Zia] Copy link failed:", err);
      }
    });
    siteData.before(button);
    const update = () => {
      const uri = gBrowser.selectedBrowser?.currentURI;
      button.hidden = !uri || !/^https?$/.test(uri.scheme);
    };

    const siteIcon = siteData.querySelector("image");
    if (siteIcon) {
      const style = getComputedStyle(siteIcon);
      icon.style.fill = style.fill;
      icon.style.fillOpacity = style.fillOpacity;
      icon.style.opacity = style.opacity;
      button.style.color = getComputedStyle(siteData).color;
    }
    gBrowser.tabContainer.addEventListener("TabSelect", update);
    gBrowser.addProgressListener({
      onLocationChange: (progress) => {
        if (progress.isTopLevel) {
          update();
        }
      },
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener", "nsISupportsWeakReference"]),
    });
    update();
  }

