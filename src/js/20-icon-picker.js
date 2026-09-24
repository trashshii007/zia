  const ICON_DIR = "chrome://sine/content/zia/icons/phosphor";
  let iconNames = null;

  function phosphorNames() {
    if (iconNames) {
      return iconNames;
    }
    const holder = {};
    Services.scriptloader.loadSubScript(`${ICON_DIR.replace("/phosphor", "")}/phosphor-names.js`, holder);
    iconNames = holder.ZiaPhosphorNames || [];
    return iconNames;
  }

  function addIconPicker() {
    const picker = window.gZenEmojiPicker;
    const panel = document.getElementById("PanelUI-zen-emojis-picker");
    const pages = document.getElementById("PanelUI-zen-emojis-picker-pages");
    const tabs = document.getElementById("PanelUI-zen-emojis-buttons-wrapper");
    const search = document.getElementById("PanelUI-zen-emojis-picker-search");
    if (!picker || !panel || !pages || !tabs) {
      return;
    }

    const tab = document.createXULElement("toolbarbutton");
    tab.id = "zia-icons-tab";
    tab.setAttribute("label", "Zia");
    tabs.appendChild(tab);

    function nameZenTab() {
      const zenTab = document.getElementById("PanelUI-zen-emojis-picker-change-svg");
      if (zenTab && zenTab.getAttribute("label") !== "Zen") {
        zenTab.removeAttribute("data-l10n-id");
        zenTab.removeAttribute("data-l10n-args");
        zenTab.setAttribute("label", "Zen");
      }
    }

    const page = document.createXULElement("vbox");
    page.id = "zia-icons-page";
    const bar = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    bar.id = "zia-icons-searchbar";
    const box = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
    box.id = "zia-icons-search";
    box.setAttribute("type", "text");
    box.setAttribute("placeholder", "Search icons");
    bar.appendChild(box);
    const grid = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    grid.id = "zia-icons-grid";
    page.append(bar, grid);
    pages.appendChild(page);

    let built = false;
    let showing = false;
    let picked = false;
    let resolvePick = null;
    let options = null;

    function choose(url) {
      picked = true;
      options?.onSelect?.(url);
      resolvePick?.(url);
      if (options?.closeOnSelect !== false) {
        panel.hidePopup();
      }
    }

    function build() {
      if (built) {
        return;
      }
      built = true;
      const fragment = document.createDocumentFragment();
      for (const name of phosphorNames()) {
        const url = `${ICON_DIR}/${name}.svg`;
        const item = document.createXULElement("toolbarbutton");

        item.className = "toolbarbutton-1 zen-emojis-picker-svg zia-icon-item";
        item.setAttribute("tooltiptext", name.replace(/-/g, " "));
        item.setAttribute("zia-icon-name", name);
        item.style.listStyleImage = `url(${url})`;
        item.addEventListener("command", () => choose(url));
        fragment.appendChild(item);
      }
      grid.appendChild(fragment);
    }

    function show() {
      build();
      showing = true;
      box.focus({ preventScroll: true });
      page.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
      tab.classList.add("selected");
      for (const other of tabs.children) {
        if (other !== tab) {
          other.classList.remove("selected");
        }
      }
      filter();
    }

    function filter() {
      if (!built) {
        return;
      }
      const text = (box.value || "").trim().toLowerCase();
      for (const item of grid.children) {
        item.hidden = text ? !item.getAttribute("zia-icon-name").includes(text) : false;
      }
    }

    tab.addEventListener("command", show);

    panel.addEventListener("command", (event) => {
      if (event.target === tab) {
        return;
      }
      if (event.target.id?.startsWith("PanelUI-zen-emojis-picker-change")) {
        showing = false;
        tab.classList.remove("selected");
      }
    });

    function matchZenSearch() {
      const zenBox = document.getElementById("PanelUI-zen-emojis-picker-search");
      if (!zenBox) {
        return;
      }
      const from = getComputedStyle(zenBox);
      for (const prop of [
        "appearance", "padding", "border", "borderRadius", "backgroundColor",
        "backgroundImage", "color", "font", "fontSize", "fontFamily",
        "boxShadow", "outline", "minHeight", "height", "lineHeight", "width",
      ]) {
        const value = from[prop];
        if (value && value !== "auto") {
          box.style[prop] = value;
        }
      }

      const rect = zenBox.getBoundingClientRect();
      if (rect.height > 0) {
        box.style.boxSizing = "border-box";
        box.style.height = `${rect.height}px`;
        box.style.minHeight = `${rect.height}px`;
      }

      const header = document.getElementById("PanelUI-zen-emojis-picker-header");
      if (header) {
        const row = getComputedStyle(header);
        for (const prop of ["padding", "gap", "alignItems"]) {
          if (row[prop]) {
            bar.style[prop] = row[prop];
          }
        }
      }
      const zenList = document.getElementById("PanelUI-zen-emojis-picker-svgs");
      if (zenList) {
        const list = getComputedStyle(zenList);
        for (const prop of ["padding", "gap", "gridTemplateColumns"]) {
          if (list[prop]) {
            grid.style[prop] = list[prop];
          }
        }
      }
    }

    box.addEventListener("input", filter);

    search?.addEventListener("input", () => {
      if (showing) {
        box.value = search.value;
        filter();
      }
    });

    panel.addEventListener("popupshowing", () => {
      nameZenTab();
      matchZenSearch();
    });

    panel.addEventListener("popupshown", () => {
      nameZenTab();
      matchZenSearch();
      showing = false;
      tab.classList.remove("selected");
      if (search) {
        filter();
      }
    });

    const openPicker = picker.open.bind(picker);
    picker.open = function (anchor, settings = {}) {
      const zenPick = openPicker(anchor, settings);
      if (!zenPick) {
        return zenPick;
      }
      options = settings;
      picked = false;
      const ziaPick = new Promise((resolve) => {
        resolvePick = resolve;
      });

      return Promise.race([
        zenPick.catch((err) => {
          if (picked) {
            return ziaPick;
          }
          throw err;
        }),
        ziaPick,
      ]);
    };
  }

