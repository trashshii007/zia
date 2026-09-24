  // Zia lets you make a folder before it has any tabs (Dia doesn't), so an
  // empty one says so: open, it shows a dashed "Drag tabs here" slot, which
  // lights up as "Drop to add" while a tab is dragged into it (chrome.css).
  // Zen keeps a hidden placeholder tab in every empty folder, so a folder
  // counts as empty when that's all it holds.
  function isEmptyFolder(folder) {
    const container = folder.querySelector(":scope > .tab-group-container");
    if (!container) {
      return false;
    }
    return ![...container.children].some(
      (child) => child.localName === "zen-folder" || (child.classList.contains("tabbrowser-tab") && !child.hasAttribute("zen-empty-tab"))
    );
  }

  function markEmptyFolders() {
    for (const folder of document.querySelectorAll("zen-folder")) {
      folder.toggleAttribute("zia-empty", isEmptyFolder(folder));
    }
  }

  function watchEmptyFolders() {
    const tabs = document.getElementById("tabbrowser-tabs");
    if (!tabs) {
      return;
    }
    let frame = 0;
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          markEmptyFolders();
        });
      }
    };
    new MutationObserver(schedule).observe(tabs, { childList: true, subtree: true });
    for (const type of ["TabGroupCreate", "TabGrouped", "TabUngrouped", "TabClose", "TabMove"]) {
      gBrowser.tabContainer.addEventListener(type, schedule);
    }
    window.addEventListener("ZenWorkspacesUIUpdate", schedule);
    schedule();
  }

