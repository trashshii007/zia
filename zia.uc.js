(() => {
  if (window.__ziaLoaded) {
    return;
  }
  window.__ziaLoaded = true;

  const root = document.documentElement;

  function setFlag(name, on) {
    if (on === root.hasAttribute(name)) {
      return;
    }
    if (on) {
      root.setAttribute(name, "true");
    } else {
      root.removeAttribute(name);
    }
  }

  const STRIP_HEIGHT = 8;
  const STRIP_SCALE = 0.5;
  const FULL_VIEW_SCALE = 0.125;
  const SCROLL_SAMPLE_INTERVAL = 50;
  const scrollPositions = new WeakMap();
  const LIGHT_THRESHOLD = 150;
  const DARK_THRESHOLD = 30;
  const ERROR_PAGE_COLOR = [0, 0, 0];
  const ERROR_PAGES = /^about:(neterror|certerror|httpsonlyerror|blocked|tabcrashed)/;
  const errorBrowsers = new WeakSet();
  const colorCache = new WeakMap();
  let colorRequestId = 0;

  const MIN_COLOR_SHARE = 0.6;
  const SAME_COLOR_DISTANCE = 10;
  let pendingColor = null;

  let appliedColorKey = null;

  function applyColor(rgb) {
    const key = rgb ? rgb.join(",") : "fallback";
    if (key === appliedColorKey) {
      return;
    }
    appliedColorKey = key;
    if (!rgb) {
      root.style.removeProperty("--zia-site-bg");
      setFlag("zia-site-light", false);
      setFlag("zia-site-dark", true);
      return;
    }
    root.style.setProperty("--zia-site-bg", cssColor(rgb));
    const brightness = brightnessOf(rgb);
    setFlag("zia-site-light", brightness > LIGHT_THRESHOLD);
    setFlag("zia-site-dark", brightness < DARK_THRESHOLD);
  }

  function showFallbackColor() {
    colorRequestId++;
    applyColor(null);
  }

  function showErrorColor() {
    colorRequestId++;
    applyColor(ERROR_PAGE_COLOR);
  }

  function isErrorPage(browser) {
    if (!browser) {
      return false;
    }
    if (errorBrowsers.has(browser)) {
      return true;
    }
    const uris = [
      browser.browsingContext?.currentWindowGlobal?.documentURI?.spec,
      browser.documentURI?.spec,
    ];
    return uris.some((uri) => ERROR_PAGES.test(uri || ""));
  }

  function isLoading(browser) {
    if (!browser) {
      return false;
    }
    if (gBrowser.getTabForBrowser(browser)?.hasAttribute("busy")) {
      return true;
    }
    try {
      return !!browser.webProgress?.isLoadingDocument;
    } catch (err) {
      return false;
    }
  }

  async function sampleTopColor(browser) {
    const windowGlobal = browser?.browsingContext?.currentWindowGlobal;
    const width = browser?.clientWidth;
    if (!windowGlobal || !width) {
      return null;
    }
    const backing = browser.getAttribute("transparent") === "true" ? "transparent" : "rgb(255, 255, 255)";

    const pos = scrollPositions.get(browser);
    const bitmap = pos
      ? await windowGlobal.drawSnapshot(new DOMRect(pos.x, pos.y, width, STRIP_HEIGHT), STRIP_SCALE, backing)
      : await windowGlobal.drawSnapshot(null, FULL_VIEW_SCALE, backing);

    sampleTopColor.canvas ||= document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    const canvas = sampleTopColor.canvas;
    canvas.width = bitmap.width;
    canvas.height = pos ? bitmap.height : Math.min(1, bitmap.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 3) << 13) | ((data[i + 1] >> 3) << 8) | ((data[i + 2] >> 3) << 3) | (data[i + 3] >> 5);
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0, a: 0 };
      bucket.count++;
      bucket.r += data[i];
      bucket.g += data[i + 1];
      bucket.b += data[i + 2];
      bucket.a += data[i + 3];
      buckets.set(key, bucket);
    }
    let best = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) {
        best = bucket;
      }
    }
    if (!best) {
      return null;
    }
    let rgb = [best.r, best.g, best.b, best.a].map((v) => Math.round(v / best.count));
    if (rgb[3] < 255) {
      rgb = colorOver(rgb, chromeBackdrop(browser));
    }
    return {
      rgb: rgb[3] === 255 ? rgb.slice(0, 3) : rgb,
      share: best.count / (data.length / 4),
    };
  }
  function parseColor(text) {
    const parts = text.match(/[\d.]+/g)?.map(Number) || [];
    return parts.length >= 3 ? [parts[0], parts[1], parts[2], Math.round((parts[3] ?? 1) * 255)] : [0, 0, 0, 0];
  }

  function colorOver(top, bottom) {
    const ta = top[3] / 255;
    const ba = (bottom[3] / 255) * (1 - ta);
    const a = ta + ba;
    if (!a) {
      return [0, 0, 0, 0];
    }
    return [0, 1, 2].map((i) => Math.round((top[i] * ta + bottom[i] * ba) / a)).concat(Math.round(a * 255));
  }

  function chromeBackdrop(browser) {
    const shared = document.getElementById("zen-appcontent-navbar-wrapper")?.parentElement;
    const layers = [];
    for (let el = browser; el && el !== shared; el = el.parentElement) {
      layers.push(el);
    }
    let color = [0, 0, 0, 0];
    for (const el of layers.reverse()) {
      color = colorOver(parseColor(getComputedStyle(el).backgroundColor), color);
    }
    return color;
  }

  function cssColor([r, g, b, a = 255]) {
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  }

  function brightnessOf([r, g, b, a = 255]) {
    const behind = matchMedia("(prefers-color-scheme: dark)").matches ? 0 : 255;
    return ((r * 299 + g * 587 + b * 114) / 1000) * (a / 255) + behind * (1 - a / 255);
  }

  function colorDistance(a, b) {
    if (!a || !b) {
      return Infinity;
    }
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs((a[3] ?? 255) - (b[3] ?? 255));
  }

  async function updateColor(fromScroll = false, duringLoad = false) {
    const browser = gBrowser.selectedBrowser;

    if (isErrorPage(browser)) {
      showErrorColor();
      return;
    }
    if (isLoading(browser) && !duringLoad) {
      return;
    }

    const id = ++colorRequestId;
    let reading = null;
    try {
      reading = await sampleTopColor(browser);
    } catch (err) {
    }
    if (id !== colorRequestId || browser !== gBrowser.selectedBrowser || (isLoading(browser) && !duringLoad)) {
      return;
    }

    const known = colorCache.has(browser);
    const current = colorCache.get(browser) ?? null;
    let rgb = reading?.rgb ?? null;

    if (known && fromScroll) {
      if (reading && reading.share < MIN_COLOR_SHARE) {
        pendingColor = null;
        return;
      }

      if (colorDistance(rgb, current) <= SAME_COLOR_DISTANCE) {
        pendingColor = null;
        return;
      }

      if (rgb) {
        if (colorDistance(rgb, pendingColor) > SAME_COLOR_DISTANCE) {
          pendingColor = rgb;
          requestScrollSample();
          return;
        }
      }
    }
    pendingColor = null;
    applyColor(rgb);
    colorCache.set(browser, rgb);

    if (!fromScroll && rgb) {
      rememberSiteColor(browser, rgb);
    }
  }

  const SITE_COLORS_PREF = "zia.siteColors";
  const SITE_COLORS_MAX = 200;
  let siteColors = null;
  let siteColorsSaveTimer = null;

  function siteKey(browser) {
    try {
      const uri = browser.currentURI;
      return /^https?$/.test(uri.scheme) ? uri.host : "";
    } catch (err) {
      return "";
    }
  }

  function loadSiteColors() {
    if (siteColors) {
      return siteColors;
    }
    siteColors = new Map();
    try {
      const saved = JSON.parse(Services.prefs.getStringPref(SITE_COLORS_PREF, "{}"));
      for (const [host, value] of Object.entries(saved)) {
        siteColors.set(host, value);
      }
    } catch (err) {
    }
    return siteColors;
  }

  function rememberSiteColor(browser, rgb) {
    const host = siteKey(browser);
    if (!host) {
      return;
    }
    const colors = loadSiteColors();
    const value = rgb.join(",");
    if (colors.get(host) === value) {
      return;
    }
    colors.delete(host);
    colors.set(host, value);
    while (colors.size > SITE_COLORS_MAX) {
      colors.delete(colors.keys().next().value);
    }

    if (!siteColorsSaveTimer) {
      siteColorsSaveTimer = setTimeout(() => {
        siteColorsSaveTimer = null;
        Services.prefs.setStringPref(SITE_COLORS_PREF, JSON.stringify(Object.fromEntries(siteColors)));
      }, 20000);
    }
  }

  function rememberedSiteColor(browser) {
    const host = siteKey(browser);
    const value = host && loadSiteColors().get(host);
    return value ? value.split(",").map(Number) : null;
  }

  function snapColorForTab(browser) {
    pendingColor = null;
    setFlag("zia-color-snap", true);
    if (isErrorPage(browser)) {
      showErrorColor();
    } else if (isLoading(browser) || !colorCache.has(browser)) {
      showFallbackColor();
    } else {
      colorRequestId++;
      applyColor(colorCache.get(browser));
    }
    requestAnimationFrame(() => requestAnimationFrame(() => setFlag("zia-color-snap", false)));
  }

  function scheduleColor(delay) {
    setTimeout(() => updateColor(), delay);
  }

  let pageHelperWorks = false;
  let scrollTimer = null;
  let scrollSampling = false;
  let lastScrollSample = 0;

  function requestScrollSample() {
    if (scrollTimer) {
      return;
    }
    const wait = Math.max(0, SCROLL_SAMPLE_INTERVAL - (Date.now() - lastScrollSample));
    scrollTimer = setTimeout(async () => {
      scrollTimer = null;
      if (scrollSampling) {
        requestScrollSample();
        return;
      }
      scrollSampling = true;
      lastScrollSample = Date.now();
      try {
        await updateColor(true);
      } finally {
        scrollSampling = false;
      }
    }, wait);
  }

  window.ziaOnPagePainted = (browser) => {
    if (browser !== gBrowser.selectedBrowser || isErrorPage(browser)) {
      return;
    }
    updateColor(false, true);

    setTimeout(() => updateColor(false, isLoading(browser)), 150);
    setTimeout(() => updateColor(false, isLoading(browser)), 450);

    setTimeout(() => updateColor(false, isLoading(browser)), 1200);
    setTimeout(() => updateColor(false, isLoading(browser)), 2800);
  };

  window.ziaOnPageScroll = (browser, position) => {
    if (position) {
      pageHelperWorks = true;
      scrollPositions.set(browser, { x: position.x || 0, y: position.y || 0 });
    }
    if (browser !== gBrowser.selectedBrowser || isLoading(browser) || isErrorPage(browser)) {
      return;
    }
    requestScrollSample();
  };

  function watchScrollInput() {
    const panels = document.getElementById("tabbrowser-tabpanels");
    if (!panels) {
      return;
    }
    const SCROLL_KEYS = new Set([
      "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ",
    ]);
    let followUps = [];
    const onInput = () => {
      if (pageHelperWorks) {
        return;
      }
      window.ziaOnPageScroll(gBrowser.selectedBrowser);
      followUps.forEach(clearTimeout);
      followUps = [250, 600, 1200].map((ms) =>
        setTimeout(() => window.ziaOnPageScroll(gBrowser.selectedBrowser), ms)
      );
    };
    panels.addEventListener("wheel", onInput, { passive: true, capture: true });
    panels.addEventListener("mouseup", onInput, { capture: true });
    window.addEventListener("keyup", (event) => {
      if (SCROLL_KEYS.has(event.key)) {
        onInput();
      }
    });
  }

  function registerScrollActor() {
    try {
      ChromeUtils.registerWindowActor("Zia", {
        parent: { esModuleURI: "chrome://sine/content/zia/actors/ZiaParent.sys.mjs" },
        child: {
          esModuleURI: "chrome://sine/content/zia/actors/ZiaChild.sys.mjs",
          events: {
            scroll: { capture: true, mozSystemGroup: true },
            DOMContentLoaded: {},
            pageshow: {},
          },
        },
        allFrames: false,
        messageManagerGroups: ["browsers"],
      });
    } catch (err) {
      if (err?.name !== "NotSupportedError") {
        console.error("[Zia] Could not register scroll helper:", err);
      }
    }
  }

  const loader = {
    shown: 0,
    target: 0,
    active: false,
    finishing: false,
    estimateTimer: null,
    hideTimer: null,
    frame: null,
  };

  function urlbarElement() {
    return gURLBar.textbox || document.getElementById("urlbar");
  }

  function drawProgress() {
    urlbarElement()?.style.setProperty("--zia-load-progress", loader.shown.toFixed(4));
  }

  function animateLoader() {
    loader.frame = null;
    const diff = loader.target - loader.shown;
    const next = loader.shown + (Math.abs(diff) < 0.001 ? diff : diff * (loader.finishing ? 0.3 : 0.12));
    loader.shown = Math.max(loader.shown, next);
    drawProgress();

    if (loader.finishing && loader.shown >= 0.999) {
      loader.finishing = false;
      loader.hideTimer = setTimeout(() => setFlag("zia-loading", false), 150);
      return;
    }
    if (loader.active || loader.finishing) {
      loader.frame = requestAnimationFrame(animateLoader);
    }
  }

  function runLoader() {
    if (!loader.frame) {
      loader.frame = requestAnimationFrame(animateLoader);
    }
  }

  function stopLoaderTimers() {
    clearInterval(loader.estimateTimer);
    clearTimeout(loader.hideTimer);
    loader.estimateTimer = null;
    loader.hideTimer = null;
  }

  function startLoader(from = 0.02, fresh = false) {
    const stillShowing = loader.active || loader.finishing || root.hasAttribute("zia-loading");
    stopLoaderTimers();
    loader.active = true;
    loader.finishing = false;

    if (fresh || !stillShowing) {
      loader.shown = from;
      loader.target = Math.max(from, 0.25);
      drawProgress();
    } else {
      loader.target = Math.max(loader.target, loader.shown, from);
    }

    setFlag("zia-loading", true);

    loader.estimateTimer = setInterval(() => {
      if (loader.target < 0.9) {
        loader.target += (0.9 - loader.target) * 0.06;
      }
    }, 250);
    runLoader();
  }

  function reportRealProgress(fraction) {
    if (loader.active && fraction > loader.target) {
      loader.target = Math.min(0.95, fraction);
    }
  }

  function finishLoader() {
    if (!loader.active) {
      return;
    }
    stopLoaderTimers();
    loader.active = false;
    loader.finishing = true;
    loader.target = 1;
    runLoader();
  }

  function cancelLoader() {
    stopLoaderTimers();
    loader.active = false;
    loader.finishing = false;
    setFlag("zia-loading", false);
  }

  let titleEl = null;
  let plainEl = null;

  function createTitleElement() {
    const inputBox = gURLBar.inputField?.parentNode;
    if (!inputBox) {
      return;
    }
    titleEl = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    titleEl.id = "zia-url-title";
    const host = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    host.className = "zia-url-title-host";
    const rest = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    rest.className = "zia-url-title-rest";
    titleEl.append(host, rest);
    inputBox.append(titleEl);

    plainEl = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    plainEl.id = "zia-url-plain";
    const plainHost = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    plainHost.className = "zia-url-title-host";
    const plainRest = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
    plainRest.className = "zia-url-title-rest";
    plainEl.append(plainHost, plainRest);
    inputBox.append(plainEl);
  }

  function updateTitle() {
    if (!titleEl) {
      return;
    }
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");
    const browser = gBrowser.selectedBrowser;
    const uri = browser?.currentURI;

    let host = "";
    try {
      if (uri && /^https?$/.test(uri.scheme)) {
        host = uri.displayHost.replace(/^www\./, "");
      }
    } catch (err) {
      host = "";
    }

    const title = (browser?.contentTitle || "").trim();
    const valid = urlbar.getAttribute("pageproxystate") === "valid";

    if (!host || !valid || isErrorPage(browser)) {
      urlbar.removeAttribute("zia-has-title");
      return;
    }

    let isHomePage = false;
    try {
      const path = uri.filePath || "/";
      isHomePage = (path === "/" || path === "") && !uri.query && !uri.ref;
    } catch (err) {
      isHomePage = false;
    }
    titleEl.firstChild.textContent = host;
    titleEl.lastChild.textContent = !isHomePage && title && title !== host ? ` / ${title}` : "";

    if (plainEl) {
      let path = "";
      try {
        path = uri.pathQueryRef || "";
      } catch (err) {
        path = "";
      }
      plainEl.firstChild.textContent = host;
      plainEl.lastChild.textContent = path === "/" ? "" : path;
    }

    urlbar.setAttribute("zia-has-title", "true");
  }

  function keepWholeUrlSelected(urlbar) {
    const input = urlbar.querySelector(".urlbar-input") || gURLBar.inputField;
    if (!input) {
      return;
    }
    let closedLength = -1;
    urlbar.addEventListener(
      "mousedown",
      () => {
        closedLength = urlbar.hasAttribute("breakout-extend") ? -1 : input.value.length;
      },
      true
    );
    const fix = () => {
      if (closedLength < 0) {
        return;
      }
      const { selectionStart, selectionEnd, value } = input;
      if (selectionStart === 0 && selectionEnd === closedLength && closedLength < value.length) {
        input.select();
        closedLength = -1;
      }
    };
    new MutationObserver(() => {
      if (!urlbar.hasAttribute("breakout-extend")) {
        closedLength = -1;
        return;
      }
      requestAnimationFrame(fix);
      for (const ms of [30, 100, 200]) {
        setTimeout(fix, ms);
      }
      setTimeout(() => {
        closedLength = -1;
      }, 400);
    }).observe(urlbar, { attributes: true, attributeFilter: ["breakout-extend"] });
  }

  let openOffset = 0;

  function desiredOpenTop() {
    return parseFloat(getComputedStyle(root).getPropertyValue("--zia-urlbar-open-top")) || 0;
  }

  let closedTextRect = null;
  let openOffsetX = 0;

  let clickedUrlbarAt = 0;

  function rememberClosedText() {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");
    if (!urlbar || urlbar.hasAttribute("breakout-extend") || root.getAttribute("zia-split") === "true") {
      return;
    }
    const title = document.getElementById("zia-url-title");
    const input = urlbar.querySelector(".urlbar-input");
    const titleRect = title?.getBoundingClientRect();
    const rect = titleRect?.width ? titleRect : input?.getBoundingClientRect();
    if (rect?.width) {
      closedTextRect = { left: rect.left, centerY: rect.top + rect.height / 2 };
    }
  }

  function alignOpenedUrlbar() {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");

    if (urlbar?.getAttribute("zen-floating-urlbar") === "true") {
      root.style.setProperty("--zia-urlbar-open-offset", "0px");
      root.style.setProperty("--zia-urlbar-open-offset-x", "0px");
      return;
    }
    if (!urlbar?.hasAttribute("breakout-extend")) {
      return;
    }
    if (root.getAttribute("zia-split") === "true") {
      return;
    }
    const input = urlbar.querySelector(".urlbar-input");
    const inputRect = input?.getBoundingClientRect();

    const openedByClick = Date.now() - clickedUrlbarAt < 1500;
    if (!openedByClick && openOffsetX) {
      openOffsetX = 0;
      root.style.setProperty("--zia-urlbar-open-offset-x", "0px");
    }
    if (openedByClick && closedTextRect && inputRect?.width) {
      const dx = closedTextRect.left - inputRect.left;
      const dy = closedTextRect.centerY - (inputRect.top + inputRect.height / 2);
      if (Math.abs(dx) > 0.5) {
        openOffsetX += dx;
        root.style.setProperty("--zia-urlbar-open-offset-x", `${openOffsetX}px`);
      }
      if (Math.abs(dy) > 0.5) {
        openOffset += dy;
        root.style.setProperty("--zia-urlbar-open-offset", `${openOffset}px`);
      }
      return;
    }

    const top = urlbar.getBoundingClientRect().top;
    const diff = desiredOpenTop() - top;
    if (Math.abs(diff) > 0.5) {
      openOffset += diff;
      root.style.setProperty("--zia-urlbar-open-offset", `${openOffset}px`);
    }
  }

  function alignOpenedUrlbarSoon() {
    requestAnimationFrame(alignOpenedUrlbar);
    setTimeout(alignOpenedUrlbar, 60);
    setTimeout(alignOpenedUrlbar, 200);
  }

  let workspaceSlot = null;
  let movedIndicator = null;
  let movedFromSpace = null;
  let spaceAttrObserver = null;
  const MIRRORED_SPACE_ATTRS = ["haspinnedtabs", "collapsedpinnedtabs"];

  function createWorkspaceSlot() {
    const topButtons = document.getElementById("zen-sidebar-top-buttons");
    if (!topButtons || !window.gZenWorkspaces) {
      return;
    }
    workspaceSlot = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
    workspaceSlot.id = "zia-workspace-slot";
    const buttonBox = topButtons.querySelector(".titlebar-buttonbox-container");
    if (buttonBox) {
      buttonBox.after(workspaceSlot);
    } else {
      topButtons.prepend(workspaceSlot);
    }

    for (const type of ["ZenWorkspacesUIUpdate", "ZenWorkspaceDataChanged", "AfterWorkspacesSessionRestore"]) {
      window.addEventListener(type, () => setTimeout(placeWorkspaceIndicator, 0));
    }

    const onSpaceSwitch = () => setTimeout(placeWorkspaceIndicator, 0);
    Services.prefs.addObserver("zen.workspaces.active", onSpaceSwitch);
    window.addEventListener("unload", () => Services.prefs.removeObserver("zen.workspaces.active", onSpaceSwitch));
    gBrowser.tabContainer.addEventListener("TabSelect", onSpaceSwitch);
    placeWorkspaceIndicator();

    setTimeout(placeWorkspaceIndicator, 500);
    setTimeout(placeWorkspaceIndicator, 2000);
  }

  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  function syncSpaceLabel(indicator) {
    if (!indicator) {
      return;
    }
    let workspace = null;
    try {
      workspace = gZenWorkspaces.getActiveWorkspace();
    } catch (err) {
      return;
    }
    if (!workspace) {
      return;
    }

    let label = indicator.querySelector("#zia-space-label");
    if (!label) {
      label = document.createElementNS(XHTML_NS, "div");
      label.id = "zia-space-label";
      indicator.prepend(label);
    }

    const rawIcon = typeof workspace.icon === "string" ? workspace.icon : "";

    const visibleIcon = rawIcon.replace(/[\s\u200b-\u200f\u2060\ufe00-\ufe0f\p{Cf}]/gu, "");
    const hasIcon = visibleIcon !== "";
    const icon = hasIcon ? rawIcon.trim() : "";

    const blank = /^[\s\u200b-\u200f\u2060\ufe00-\ufe0f]+|[\s\u200b-\u200f\u2060\ufe00-\ufe0f]+$/gu;
    label.textContent = (workspace.name || "").replace(blank, "");

    if (!hasIcon) {
      label.removeAttribute("zia-icon");
      label.removeAttribute("zia-has-icon");
    } else if (icon.endsWith(".svg")) {
      label.removeAttribute("zia-icon");
      label.removeAttribute("zia-has-icon");
      const img = document.createElementNS(XHTML_NS, "img");
      img.src = icon;
      label.prepend(img);
    } else {
      label.setAttribute("zia-icon", icon);
      label.setAttribute("zia-has-icon", "true");
    }
  }

  function removeSpaceLabel(indicator) {
    indicator?.querySelector("#zia-space-label")?.remove();
  }

  function mirrorSpaceAttributes(space) {
    for (const name of MIRRORED_SPACE_ATTRS) {
      if (space?.hasAttribute(name)) {
        workspaceSlot.setAttribute(name, space.getAttribute(name));
      } else {
        workspaceSlot.removeAttribute(name);
      }
    }
  }

  function placeWorkspaceIndicator() {
    if (!workspaceSlot) {
      return;
    }
    let space = null;
    let indicator = null;
    try {
      space = gZenWorkspaces.activeWorkspaceElement;
      indicator = space?.indicator;
    } catch (err) {
      return;
    }

    if (movedIndicator && movedIndicator !== indicator && movedFromSpace?.isConnected) {
      removeSpaceLabel(movedIndicator);
      movedFromSpace.prepend(movedIndicator);
      movedIndicator = null;
      movedFromSpace = null;
    }

    if (indicator && indicator.parentNode !== workspaceSlot) {
      workspaceSlot.append(indicator);
      movedIndicator = indicator;
      movedFromSpace = space;
    }

    syncSpaceLabel(indicator);

    spaceAttrObserver?.disconnect();
    mirrorSpaceAttributes(space);
    if (space) {
      spaceAttrObserver = new MutationObserver(() => mirrorSpaceAttributes(space));
      spaceAttrObserver.observe(space, { attributes: true, attributeFilter: MIRRORED_SPACE_ATTRS });
    }
    setFlag("zia-workspace-slot", !!indicator);
  }

  function searchEngineHomePage(engine) {
    try {
      if (engine.searchForm) {
        return engine.searchForm;
      }
    } catch (err) {
    }
    try {
      const prePath = engine.getSubmission("zia").uri.prePath;
      return prePath ? `${prePath}/` : null;
    } catch (err) {
      return null;
    }
  }

  let searchHomeUrl = null;

  function newTabSearchEnabled() {
    return Services.prefs.getBoolPref("zia.newtab.search-engine", true);
  }

  async function applyNewTabPage() {
    try {
      const AboutNewTabModule =
        window.AboutNewTab ||
        ChromeUtils.importESModule("resource:///modules/AboutNewTab.sys.mjs").AboutNewTab;

      if (!newTabSearchEnabled()) {
        searchHomeUrl = null;
        AboutNewTabModule.resetNewTabURL();
        return;
      }

      const search =
        Services.search ||
        ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
      await search.init();
      const engine = await search.getDefault();
      searchHomeUrl = (engine && searchEngineHomePage(engine)) || null;
      if (!searchHomeUrl) {
        console.warn("[Zia] Couldn't find the search engine's home page; keeping Zen's new tab page.");
        return;
      }
      try {
        AboutNewTabModule.newTabURL = searchHomeUrl;
      } catch (err) {
      }
      console.info(`[Zia] New tabs open: ${searchHomeUrl}`);
    } catch (err) {
      console.error("[Zia] Could not set the new tab page:", err);
    }
  }

  function redirectBlankNewTab(browser, location, flags) {
    if (!searchHomeUrl || !newTabSearchEnabled()) {
      return;
    }
    if (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT) {
      return;
    }
    if (location?.spec !== "about:newtab") {
      return;
    }
    try {
      browser.loadURI(Services.io.newURI(searchHomeUrl), {
        triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
        loadFlags: Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY,
      });
    } catch (err) {
      console.error("[Zia] Could not open the search page in the new tab:", err);
    }
  }

  function closeNewTabUrlbar(tab) {
    if (!searchHomeUrl || !newTabSearchEnabled()) {
      return;
    }
    requestAnimationFrame(() => {
      try {
        const urlbar = gURLBar;
        if (!urlbar?.focused) {
          return;
        }
        if (gBrowser.selectedTab !== tab) {
          return;
        }
        urlbar.view?.close();
        urlbar.blur();
        gBrowser.selectedBrowser?.focus();
      } catch (err) {
      }
    });
  }

  function watchNewTabPage() {
    applyNewTabPage();
    gBrowser.tabContainer.addEventListener("TabOpen", (event) => closeNewTabUrlbar(event.target));
    Services.obs.addObserver(applyNewTabPage, "browser-search-engine-modified");
    Services.prefs.addObserver("zia.newtab.search-engine", applyNewTabPage);
    window.addEventListener("unload", () => {
      Services.obs.removeObserver(applyNewTabPage, "browser-search-engine-modified");
      Services.prefs.removeObserver("zia.newtab.search-engine", applyNewTabPage);
    });
  }

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
      const trimmed = original.call(this, url);
      if (typeof trimmed !== "string" || gURLBar.hasAttribute("breakout-extend")) {
        return trimmed;
      }
      return trimmed.replace(/^((?:https?:\/\/)?)www\./i, "$1");
    };
    wrapped.__zia = true;
    gURLBar._zenTrimURL = wrapped;
    try {
      gURLBar.setURI();
    } catch (err) {
    }
  }

  let edgeFrame = null;
  let edgeRetryTimer = null;
  let edgeRetries = 0;
  const EDGE_MAX_FIX = 24;
  const EDGE_RETRY_MS = 100;
  const EDGE_MAX_RETRIES = 30;

  function visibleRect(el) {
    const rect = el?.getBoundingClientRect();
    return rect && rect.width > 0 && rect.height > 0 ? rect : null;
  }

  function isSliding(el) {
    for (let node = el; node && node.id !== "navigator-toolbox"; node = node.parentElement) {
      const style = getComputedStyle(node);

      const transform = style.transform || "none";
      const moved =
        transform !== "none" &&
        !/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(transform) &&
        !/^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$/.test(transform);
      const translate = style.translate || "none";
      if (moved || !/^(none|0px( 0px)?( 0px)?)$/.test(translate)) {
        return true;
      }
    }
    return false;
  }

  function retryEdgeAlignSoon() {
    if (edgeRetryTimer || edgeRetries >= EDGE_MAX_RETRIES) {
      return;
    }
    edgeRetries++;
    edgeRetryTimer = setTimeout(() => {
      edgeRetryTimer = null;
      scheduleEdgeAlign(true);
    }, EDGE_RETRY_MS);
  }

  const halfPx = (value) => `${Math.round(value * 2) / 2}px`;

  function alignRightEdges() {
    edgeFrame = null;
    const sidebar = document.getElementById("navigator-toolbox");
    if (!sidebar || document.documentElement.getAttribute("zen-sidebar-expanded") !== "true") {
      return;
    }

    let essentialsRight = null;
    let essentialsLeft = null;
    let essentialTile = null;
    for (const bg of document.querySelectorAll(
      "#zen-essentials .tabbrowser-tab[zen-essential] > .tab-stack > .tab-background"
    )) {
      const rect = visibleRect(bg);
      if (rect) {
        essentialTile ||= bg;
        essentialsRight = Math.max(essentialsRight ?? -Infinity, rect.right);
        essentialsLeft = Math.min(essentialsLeft ?? Infinity, rect.left);
      }
    }
    if (essentialsRight === null) {
      root.style.removeProperty("--zia-tab-right-fix");
      root.style.removeProperty("--zia-folder-right-fix");
      root.style.removeProperty("--zia-folder-left-fix");
      alignFolderBottoms(gZenWorkspaces?.activeWorkspaceElement || sidebar);
      return;
    }

    const space = gZenWorkspaces?.activeWorkspaceElement || sidebar;

    if ((isSliding(space) || isSliding(essentialTile)) && edgeRetries < EDGE_MAX_RETRIES) {
      retryEdgeAlignSoon();
      return;
    }
    const currentFix = (name) => parseFloat(root.style.getPropertyValue(name)) || 0;
    let suspicious = false;

    const tab = [...space.querySelectorAll(".tabbrowser-tab:not([zen-essential])")].find(
      (t) => !t.closest(FOLDER_SELECTOR) && visibleRect(t.querySelector(".tab-background"))
    );
    if (tab) {
      const rect = visibleRect(tab.querySelector(".tab-background"));

      const fix = rect.right + currentFix("--zia-tab-right-fix") - essentialsRight;
      if (Math.abs(fix) <= EDGE_MAX_FIX) {
        root.style.setProperty("--zia-tab-right-fix", halfPx(fix));
      } else {
        suspicious = true;
      }
    }

    const folder = [...space.querySelectorAll(FOLDER_SELECTOR)].find((f) => !f.parentElement?.closest(FOLDER_SELECTOR) && visibleRect(f));
    if (folder) {
      const rect = visibleRect(folder);
      const rightFix = rect.right - essentialsRight;
      const leftFix = essentialsLeft - rect.left;
      if (Math.abs(rightFix) <= EDGE_MAX_FIX && Math.abs(leftFix) <= EDGE_MAX_FIX) {
        root.style.setProperty("--zia-folder-right-fix", halfPx(rightFix));
        root.style.setProperty("--zia-folder-left-fix", halfPx(leftFix));
      } else {
        suspicious = true;
      }
    }

    if (!alignFolderBottoms(space)) {
      suspicious = true;
    }

    if (suspicious) {
      retryEdgeAlignSoon();
    } else {
      edgeRetries = 0;
    }
  }

  function alignFolderBottoms(space) {
    let ok = true;
    for (const folder of space.querySelectorAll(FOLDER_SELECTOR)) {
      const rect = visibleRect(folder);
      const open = folder.hasAttribute("collapsed") === false;
      const container = folder.querySelector(":scope > .tab-group-container");
      let last = null;
      if (rect && open && container) {
        const items = [...container.children].filter(
          (el) => (isFolder(el) || el.classList.contains("tabbrowser-tab")) && visibleRect(el)
        );
        last = items[items.length - 1];
      }
      const current = parseFloat(folder.style.getPropertyValue("--zia-folder-bottom-extra")) || 0;
      if (!isFolder(last)) {
        if (current) {
          folder.style.removeProperty("--zia-folder-bottom-extra");
        }
        continue;
      }
      const gap = parseFloat(getComputedStyle(folder).getPropertyValue("--zia-folder-inner-gap")) || 5;
      const innerInset = parseFloat(getComputedStyle(last, "::before").bottom) || 0;
      const innerBoxBottom = last.getBoundingClientRect().bottom - innerInset;
      const outerInset = parseFloat(getComputedStyle(folder, "::before").bottom) || 0;
      const baseInset = outerInset + current;
      const wantedInset = rect.bottom - (innerBoxBottom + gap);
      const extra = Math.round((baseInset - wantedInset) * 2) / 2;
      if (Math.abs(extra) > EDGE_MAX_FIX) {
        ok = false;
        continue;
      }
      if (extra !== current) {
        folder.style.setProperty("--zia-folder-bottom-extra", `${extra}px`);
      }
    }
    return ok;
  }

  function scheduleEdgeAlign(isRetry = false) {
    if (isRetry !== true) {
      edgeRetries = 0;
    }
    if (!edgeFrame) {
      edgeFrame = requestAnimationFrame(alignRightEdges);
    }
  }

  function scheduleEdgeAlignAfterSwitch() {
    scheduleEdgeAlign();
    setTimeout(scheduleEdgeAlign, 350);
    setTimeout(scheduleEdgeAlign, 800);
  }

  function watchRightEdges() {
    const sidebar = document.getElementById("navigator-toolbox");
    if (!sidebar) {
      return;
    }
    new ResizeObserver(scheduleEdgeAlign).observe(sidebar);
    const essentials = document.getElementById("zen-essentials");
    if (essentials) {
      new ResizeObserver(scheduleEdgeAlign).observe(essentials);
      new MutationObserver(scheduleEdgeAlign).observe(essentials, { childList: true, subtree: true });
    }
    new MutationObserver(scheduleEdgeAlign).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["zen-sidebar-expanded"],
    });
    const tabs = document.getElementById("tabbrowser-tabs");
    if (tabs) {
      new MutationObserver(scheduleEdgeAlign).observe(tabs, {
        subtree: true,
        attributes: true,
        attributeFilter: ["collapsed"],
      });
    }
    gBrowser.tabContainer.addEventListener("TabSelect", () => scheduleEdgeAlign());
    const onSpaceSwitch = () => scheduleEdgeAlignAfterSwitch();
    for (const type of ["TabGroupExpand", "TabGroupCollapse", "TabGrouped", "TabUngrouped"]) {
      window.addEventListener(type, onSpaceSwitch);
    }
    Services.prefs.addObserver("zen.workspaces.active", onSpaceSwitch);
    window.addEventListener("ZenWorkspacesUIUpdate", onSpaceSwitch);
    window.addEventListener("unload", () => Services.prefs.removeObserver("zen.workspaces.active", onSpaceSwitch));
    scheduleEdgeAlign();
    setTimeout(scheduleEdgeAlign, 600);
    setTimeout(scheduleEdgeAlign, 2000);
  }

  const mediaColorCache = new Map();

  function artUrlOf(card) {
    const artwork = card.querySelector(".zen-media-focus-button[zia-art]")?.getAttribute("zia-art");
    if (artwork) {
      return artwork;
    }
    const favicon = card.querySelector(".zen-media-focus-button[zia-favicon]")?.getAttribute("zia-favicon");
    if (favicon) {
      return favicon;
    }
    const img = card.querySelector(".zen-media-focus-button image, .zen-media-focus-button .toolbarbutton-icon");
    if (!img) {
      return "";
    }
    const src = img.getAttribute("src") || img.src || "";
    if (src) {
      return src;
    }
    const listStyle = getComputedStyle(img).listStyleImage || "";
    const match = listStyle.match(/url\(["']?(.*?)["']?\)/);
    return match ? match[1] : "";
  }

  function boost([r, g, b]) {
    const avg = (r + g + b) / 3;
    const k = 1.6;
    return [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(avg + (v - avg) * k))));
  }

  function readArtColors(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const size = 24;
          const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, size, size);
          const { data } = ctx.getImageData(0, 0, size, size);
          const halves = [[0, 0, 0, 0], [0, 0, 0, 0]];
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              if (data[i + 3] < 128) {
                continue;
              }
              const h = halves[x < size / 2 ? 0 : 1];
              h[0] += data[i];
              h[1] += data[i + 1];
              h[2] += data[i + 2];
              h[3]++;
            }
          }
          const colors = halves.map((h) =>
            h[3] ? boost([h[0] / h[3], h[1] / h[3], h[2] / h[3]]) : null
          );
          if (!colors[0] && !colors[1]) {
            resolve(null);
            return;
          }
          const a = colors[0] || colors[1];
          const b = colors[1] || colors[0];
          resolve([`rgb(${a.join(", ")})`, `rgb(${b.join(", ")})`]);
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  const ARTWORK_WAIT_MS = 1500;

  async function updateCardGlow(card) {
    const url = artUrlOf(card);
    if (card.__ziaArtUrl === url) {
      return;
    }
    card.__ziaArtUrl = url;

    const isArtwork = !!card.querySelector(".zen-media-focus-button[zia-art]");
    if (!isArtwork) {
      if (!card.hasAttribute("zia-glow-ready")) {
        card.setAttribute("zia-glow-pending", "true");
      }
      await new Promise((resolve) => setTimeout(resolve, ARTWORK_WAIT_MS));
      if (card.__ziaArtUrl !== url) {
        return;
      }
    }

    let colors = mediaColorCache.get(url);
    if (colors === undefined) {
      colors = await readArtColors(url);
      mediaColorCache.set(url, colors);
    }
    if (card.__ziaArtUrl !== url) {
      return;
    }
    if (colors) {
      card.style.setProperty("--zia-media-glow-a", colors[0]);
      card.style.setProperty("--zia-media-glow-b", colors[1]);
    } else {
      card.style.removeProperty("--zia-media-glow-a");
      card.style.removeProperty("--zia-media-glow-b");
    }
    card.removeAttribute("zia-glow-pending");
    card.setAttribute("zia-glow-ready", "true");
    card.__ziaColors = colors;
    paintSoundBars(card, colors);
  }

  const soundBarCache = new Map();

  function lighten(color, amount = 0.35) {
    const m = String(color).match(/\d+(\.\d+)?/g);
    if (!m) {
      return "rgb(255, 255, 255)";
    }
    const [r, g, b] = m.map(Number).map((v) => Math.round(v + (255 - v) * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  let soundBarToken = 0;
  const BAR_X = [1.6, 5.2, 8.8, 12.4];
  const BAR_REST = [
    [4.5, 7],
    [2.5, 11],
    [3.5, 9],
    [5.25, 5.5],
  ];

  function soundBarImages(colors) {
    const key = colors ? colors.join("|") : "white";
    let images = soundBarCache.get(key);
    if (images) {
      return images;
    }
    const a = colors ? lighten(colors[0]) : "rgb(255, 255, 255)";
    const b = colors ? lighten(colors[1]) : "rgb(255, 255, 255)";
    const gradient = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="1.6" y1="0" x2="14.4" y2="0"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
    const moving = [[0.55], [0.68], [0.5], [0.74]];
    const wave =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${gradient}` +
      `<style>rect{transform-box:fill-box;transform-origin:center;animation:grow .26s cubic-bezier(.2,.9,.3,1) both,z .6s .26s ease-in-out infinite alternate}` +
      moving.map(([d], i) => `.b${i}{animation-duration:.26s,${d}s;animation-delay:0s,${(0.26 + i * 0.05).toFixed(2)}s}`).join("") +
      `@keyframes grow{from{height:2px;y:7px}to{height:11px;y:2.5px}}` +
      `@keyframes z{from{transform:scaleY(.22)}to{transform:scaleY(1)}}` +
      `@media (prefers-reduced-motion:reduce){rect{animation:none;transform:scaleY(.6)}}</style>` +
      `<g fill="url(#g)">` +
      BAR_X.map((x, i) => `<rect class="b${i}" x="${x}" y="2.5" width="2" height="11" rx="1"/>`).join("") +
      `</g></svg>`;
    const dots =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${gradient}` +
      `<style>rect{animation:shrink .28s cubic-bezier(.4,0,.2,1) forwards}@keyframes shrink{to{height:2px;y:7px}}` +
      `@media (prefers-reduced-motion:reduce){rect{animation-duration:1ms}}</style>` +
      `<g fill="url(#g)">` +
      BAR_X.map((x, i) => `<rect x="${x}" y="${BAR_REST[i][0]}" width="2" height="${BAR_REST[i][1]}" rx="1"/>`).join("") +
      `</g></svg>`;
    const encoded = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
    images = { waveData: encoded(wave), dotsData: encoded(dots) };
    soundBarCache.set(key, images);
    return images;
  }

  function freshSoundBars(colors) {
    const images = soundBarImages(colors);
    const n = ++soundBarToken;
    return { wave: `url("${images.waveData}#${n}")`, dots: `url("${images.dotsData}#${n}")` };
  }

  function applyCardSoundBars(element) {
    const fresh = freshSoundBars(element.__ziaColors ?? null);
    element.style.setProperty("--zia-sound-wave", fresh.wave);
    element.style.setProperty("--zia-sound-still", fresh.dots);
    element.style.setProperty("--zia-sound-muted", fresh.dots);
  }

  function watchCardSoundState(element) {
    if (element.__ziaSoundWatch) {
      return;
    }
    element.__ziaSoundWatch = true;
    let last = "";
    new MutationObserver(() => {
      const state = `${element.classList.contains("playing")}|${element.hasAttribute("muted")}`;
      if (state !== last) {
        last = state;
        applyCardSoundBars(element);
      }
    }).observe(element, { attributes: true, attributeFilter: ["class", "muted"] });
  }

  function paintSoundBars(card, colors) {
    card.__ziaColors = colors;
    applyCardSoundBars(card);
    watchCardSoundState(card);
  }

  function applyTabSoundBars(tab) {
    const fresh = freshSoundBars(null);
    tab.style.setProperty("--zia-sound-wave", fresh.wave);
    tab.style.setProperty("--zia-sound-muted", fresh.dots);
  }

  function paintTabSoundBars(tab) {
    if (tab?.hasAttribute("soundplaying") || tab?.hasAttribute("muted")) {
      applyTabSoundBars(tab);
    }
  }

  function watchTabSoundBars() {
    gBrowser.tabContainer.addEventListener("TabAttrModified", (event) => {
      const changed = event.detail?.changed || [];
      if (changed.includes("soundplaying") || changed.includes("muted")) {
        paintTabSoundBars(event.target);
      }
      if (changed.includes("image")) {
        for (const element of document.querySelectorAll(".zen-media-card")) {
          const card = element.__ziaCard;
          if (card?.browser === event.target.linkedBrowser) {
            try {
              card.updateIcon();
            } catch (err) {
            }
          }
        }
      }
    });
    for (const tab of gBrowser.tabs) {
      paintTabSoundBars(tab);
    }
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  let ringCount = 0;

  function ensureRing(button) {
    if (!button || button.querySelector(":scope > .zia-ring")) {
      return;
    }
    const id = `zia-ring-gradient-${++ringCount}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "zia-ring");
    svg.setAttribute("viewBox", "0 0 46 46");
    svg.setAttribute("aria-hidden", "true");

    const make = (tag, attrs, parent) => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) {
        el.setAttribute(name, value);
      }
      parent.appendChild(el);
      return el;
    };
    const gradient = make("linearGradient", { id, x1: "0", y1: "0", x2: "1", y2: "1" }, make("defs", {}, svg));
    make("stop", { offset: "0", style: "stop-color: var(--zia-media-glow-a)" }, gradient);
    make("stop", { offset: "1", style: "stop-color: var(--zia-media-glow-b)" }, gradient);
    const shape = { x: "1", y: "1", width: "44", height: "44", rx: "10", fill: "none", "stroke-width": "2", pathLength: "100" };
    make("rect", { ...shape, class: "zia-ring-track" }, svg);
    make("rect", {
      ...shape,
      class: "zia-ring-fill",
      stroke: `url(#${id})`,
      "stroke-linecap": "round",
      "stroke-dasharray": "0 100",
      "stroke-opacity": "0",
    }, svg);
    button.appendChild(svg);
  }

  const faviconTints = new Map();

  function tintFromColors(colors) {
    const m = String(colors?.[0] || "").match(/\d+(\.\d+)?/g);
    if (!m) {
      return "rgb(44, 44, 46)";
    }

    const [r, g, b] = m.map(Number).map((v) => Math.round(v * 0.32 + 26));
    return `rgb(${r}, ${g}, ${b})`;
  }

  async function showFaviconTile(card, button, art) {
    if (art) {
      button.removeAttribute("zia-favicon");
      button.removeAttribute("zia-initial");
      return;
    }
    const tab = card.browser && gBrowser.getTabForBrowser(card.browser);

    let icon =
      tab?.getAttribute("image") ||
      (tab && gBrowser.getIcon?.(tab)) ||
      card.browser?.mIconURL ||
      (card.browser?.currentURI?.spec ? `page-icon:${card.browser.currentURI.spec}` : "");
    if (/defaultFavicon|globe/i.test(icon)) {
      icon = "";
    }
    if (!icon) {
      let host = "";
      try {
        host = card.browser?.currentURI?.displayHost?.replace(/^www\./, "") || "";
      } catch (err) {
        host = "";
      }
      button.setAttribute("zia-favicon", "");
      button.setAttribute("zia-initial", (host[0] || "♪").toUpperCase());
      button.style.removeProperty("--zia-media-favicon");
      button.style.setProperty("--zia-favicon-tint", "rgb(52, 52, 56)");
      console.info("[Zia] Player: no site icon found for", host || card.browser?.currentURI?.spec, "- showing a letter tile.");
      return;
    }
    button.removeAttribute("zia-initial");
    button.setAttribute("zia-favicon", icon);
    button.style.setProperty("--zia-media-favicon", `url("${icon.replace(/"/g, "%22")}")`);
    let tint = faviconTints.get(icon);
    if (!tint) {
      let colors = mediaColorCache.get(icon);
      if (colors === undefined) {
        colors = await readArtColors(icon);
        mediaColorCache.set(icon, colors);
      }
      tint = tintFromColors(colors);
      faviconTints.set(icon, tint);
    }
    if (button.getAttribute("zia-favicon") === icon) {
      button.style.setProperty("--zia-favicon-tint", tint);
    }
  }

  const FLIP_OUT_MS = 200;
  const FLIP_IN_MS = 380;

  function flipArtwork(button, swap) {
    const icon = button.querySelector(":scope > .toolbarbutton-icon") || button.querySelector("image");
    if (!icon || typeof icon.animate !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      swap();
      return;
    }
    button.__ziaFlip?.cancel();
    const turnAway = icon.animate(
      [{ transform: "perspective(240px) rotateY(0deg)" }, { transform: "perspective(240px) rotateY(90deg)" }],
      { duration: FLIP_OUT_MS, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" }
    );
    button.__ziaFlip = turnAway;
    turnAway.finished
      .then(() => {
        swap();
        const turnBack = icon.animate(
          [
            { transform: "perspective(240px) rotateY(-90deg)" },
            { transform: "perspective(240px) rotateY(8deg)", offset: 0.75 },
            { transform: "perspective(240px) rotateY(0deg)" },
          ],
          { duration: FLIP_IN_MS, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" }
        );
        button.__ziaFlip = turnBack;
        turnAway.cancel();
      })
      .catch(() => {
      });
  }

  function setRing(card, fraction) {
    const fill = card.focusButton?.querySelector(".zia-ring-fill");
    if (!fill) {
      return;
    }
    const pct = Math.max(0, Math.min(1, fraction || 0)) * 100;

    fill.style.strokeDasharray = pct > 0.2 ? `${pct.toFixed(2)} 100` : "0 100";
    fill.style.strokeOpacity = pct > 0.2 ? "1" : "0";
  }

  function showTimeLeft(card) {
    const durationEl = card.durationEl;
    const bar = card.progressBar;
    if (!bar || !card.duration || card.duration >= 900_000) {
      setRing(card, 0);
      return;
    }
    const fraction = Number(bar.value) / 100;
    setRing(card, fraction);
    if (durationEl) {
      const played = fraction * card.duration;
      durationEl.textContent = `-${card.formatSecondsToTime(Math.max(0, card.duration - played))}`;
    }
  }

  function watchTimeLeft(card) {
    const el = card.currentTimeEl;
    if (!el || el.__ziaTimeLeft) {
      return;
    }
    el.__ziaTimeLeft = true;

    new MutationObserver(() => showTimeLeft(card)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  const isStandInArtwork = (src) =>
    !src || /^(jar|chrome|resource|moz-src):/i.test(src) || /defaultFavicon|globe/i.test(src);

  function bestArtwork(artwork) {
    if (!Array.isArray(artwork)) {
      return "";
    }
    artwork = artwork.filter((a) => !isStandInArtwork(a?.src));
    if (!artwork.length) {
      return "";
    }
    const area = (a) =>
      Math.max(
        0,
        ...String(a.sizes || "")
          .split(/\s+/)
          .map((size) => size.split("x").reduce((w, h) => (parseInt(w) || 0) * (parseInt(h) || 0)))
      );
    return [...artwork].sort((x, y) => area(y) - area(x))[0]?.src || "";
  }

  function useMediaArtwork() {
    const front = window.gZenMediaController?.frontCard;
    const proto = front && Object.getPrototypeOf(front);
    if (!proto || typeof proto.updateIcon !== "function" || proto.updateIcon.__zia) {
      return !!proto?.updateIcon?.__zia;
    }
    const originalPosition = proto.updatePosition;
    if (typeof originalPosition === "function") {
      proto.updatePosition = function (...args) {
        const result = originalPosition.apply(this, args);
        try {
          this.element.__ziaCard = this;
          watchTimeLeft(this);
          showTimeLeft(this);
        } catch (err) {
        }
        return result;
      };
    }

    const original = proto.updateIcon;
    const patched = function () {
      original.call(this);
      if (this.element) {
        this.element.__ziaCard = this;
      }
      const button = this.focusButton;
      let art = "";
      try {
        art = bestArtwork(this.controller?.getMetadata?.()?.artwork);
      } catch (err) {
      }
      if (!button) {
        return;
      }
      ensureRing(button);
      if (art) {
        const previous = button.getAttribute("zia-art");
        button.setAttribute("zia-art", art);
        const showArt = () => button.style.setProperty("--zia-media-art", `url("${art.replace(/"/g, "%22")}")`);
        if (previous && previous !== art) {
          flipArtwork(button, showArt);
        } else {
          showArt();
        }
      } else {
        button.removeAttribute("zia-art");
        button.style.removeProperty("--zia-media-art");
      }
      showFaviconTile(this, button, art);
    };
    patched.__zia = true;
    proto.updateIcon = patched;
    try {
      front.updateIcon();
      front.updatePosition?.();
    } catch (err) {
    }
    return true;
  }

  function watchMediaGlow() {
    const toolbar = document.getElementById("zen-media-controls-toolbar");
    if (!toolbar) {
      return;
    }
    let frame = null;
    let artworkReady = false;
    const refresh = () => {
      frame = null;
      if (!artworkReady) {
        artworkReady = useMediaArtwork();
      }
      for (const card of toolbar.querySelectorAll(".zen-media-card")) {
        updateCardGlow(card);
      }
    };
    new MutationObserver(() => {
      if (!frame) {
        frame = requestAnimationFrame(refresh);
      }
    }).observe(toolbar, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "style", "image", "hidden", "zia-art", "zia-favicon"],
    });
    refresh();
  }

  const TAB_DROP_TYPE = "application/x-moz-tabbrowser-tab";
  const HTML = "http://www.w3.org/1999/xhtml";
  const MAGNET_SHARE = 0.32;
  const MAGNET_PULL_X = 0.55;
  const MAGNET_PULL_Y = 0.35;

  const ZONE_EDGE = 44;
  const ZONE_ACTIVE_W = 350;
  const ZONE_ACTIVE_H = 580;
  const ZONE_PAGE_W = 272;
  const ZONE_PAGE_H = 452;

  const splitDrop = {
    overlay: null,
    zones: {},
    tab: null,
    target: null,
    lastSelect: null,
    dragStartedAt: 0,
    side: null,
    thumb: null,
    dragImageSet: false,
  };

  function draggedTabOf(event) {
    const dt = event.dataTransfer;
    if (!dt || !dt.types.includes(TAB_DROP_TYPE)) {
      return null;
    }
    try {
      return dt.mozGetDataAt(TAB_DROP_TYPE, 0) || null;
    } catch (err) {
      return null;
    }
  }

  const PRESS_SELECT_MS = 1500;

  function splitTargetFor(tab) {
    const last = splitDrop.lastSelect;
    const selectedByThisDrag =
      last &&
      last.tab === tab &&
      gBrowser.selectedTab === tab &&
      splitDrop.dragStartedAt - last.time < PRESS_SELECT_MS &&
      splitDrop.dragStartedAt >= last.time;
    const previous = last?.previous;
    if (selectedByThisDrag && previous && !previous.closing && previous.isConnected && !previous.hidden) {
      return previous;
    }
    return gBrowser.selectedTab;
  }

  function canSplitWith(tab, current = gBrowser.selectedTab) {
    const splitter = window.gZenViewSplitter;
    if (!splitter || !tab || !current || tab.closing || tab.hasAttribute("zen-empty-tab")) {
      return false;
    }
    if (tab.hasAttribute("zen-live-folder-item-id")) {
      return false;
    }

    if (tab === current && current.splitView) {
      return false;
    }

    if (tab !== current && tab.splitView && current.splitView && tab.group && tab.group === current.group) {
      return false;
    }
    const group = splitter._data?.find?.((g) => g.tabs.includes(current));
    return !(group && group.tabs.length >= (splitter.MAX_TABS || 4));
  }

  function makeZone(side) {
    const zone = document.createElementNS(HTML, "div");
    zone.className = "zia-split-zone";
    zone.setAttribute("side", side);
    const inner = document.createElementNS(HTML, "div");
    inner.className = "zia-split-zone-inner";
    const icon = document.createElementNS(HTML, "div");
    icon.className = "zia-split-zone-icon";
    const label = document.createElementNS(HTML, "div");
    label.className = "zia-split-zone-label";
    label.textContent = side === "left" ? "Add left split" : "Add right split";
    inner.append(icon, label);
    zone.appendChild(inner);
    return zone;
  }

  function ensureSplitOverlay() {
    if (splitDrop.overlay) {
      return splitDrop.overlay;
    }
    const overlay = document.createElementNS(HTML, "div");
    overlay.id = "zia-split-drop";
    splitDrop.zones.left = makeZone("left");
    splitDrop.zones.right = makeZone("right");
    overlay.append(splitDrop.zones.left, splitDrop.zones.right);

    overlay.addEventListener("dragover", onSplitDragOver);
    overlay.addEventListener("drop", onSplitDrop);
    overlay.addEventListener("dragleave", (event) => {
      if (!event.relatedTarget) {
        hideSplitDrop();
      }
    });
    document.documentElement.appendChild(overlay);
    splitDrop.overlay = overlay;
    return overlay;
  }

  const DRAG_PICTURE_W = 200;
  const DRAG_PICTURE_H = 125;
  let blankDragImage = null;
  const lastCursor = { x: 0, y: 0 };

  let lastBlankAt = 0;

  function hideSystemDragImage(dt, force = true) {
    if (!dt || (!force && Date.now() - lastBlankAt < 250)) {
      return;
    }
    lastBlankAt = Date.now();
    try {
      if (!blankDragImage) {
        blankDragImage = document.createElementNS(HTML, "canvas");
        blankDragImage.id = "zia-split-blank-drag-image";
        blankDragImage.width = 32;
        blankDragImage.height = 32;
        blankDragImage.getContext("2d").clearRect(0, 0, 32, 32);
        document.documentElement.appendChild(blankDragImage);
      }
      dt.updateDragImage(blankDragImage, 16, 16);
      splitDrop.dragImageSet = true;
    } catch (err) {
    }
  }

  function movePicture(x, y) {
    lastCursor.x = x;
    lastCursor.y = y;
    const canvas = splitDrop.thumb;
    if (canvas?.hasAttribute("following")) {
      canvas.style.translate = `${Math.round(x - DRAG_PICTURE_W / 2)}px ${Math.round(y - DRAG_PICTURE_H / 2)}px`;
    }
  }

  async function makeDragPicture(tab) {
    const width = DRAG_PICTURE_W;
    const height = DRAG_PICTURE_H;
    const canvas = splitDrop.thumb || document.createElementNS(HTML, "canvas");
    canvas.id = "zia-split-drag-picture";
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    if (!canvas.isConnected) {
      document.documentElement.appendChild(canvas);
    }
    splitDrop.thumb = canvas;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, height - 1, 7);
    ctx.clip();
    ctx.fillStyle = "#1f1f1f";
    ctx.fillRect(0, 0, width, height);
    try {
      const browser = tab.linkedBrowser;
      const pageW = browser?.clientWidth;
      const pageH = browser?.clientHeight;
      if (!browser?.drawSnapshot || !pageW || !pageH) {
        throw new Error("page not drawable");
      }
      const cover = Math.max(width / pageW, height / pageH);
      const cropW = width / cover;
      const cropH = height / cover;

      const scroll = scrollPositions.get(browser) || { x: 0, y: 0 };
      const bitmap = await browser.drawSnapshot(
        scroll.x + (pageW - cropW) / 2,
        scroll.y,
        cropW,
        cropH,
        cover * ratio,
        "rgb(31, 31, 31)"
      );
      if (!bitmap) {
        throw new Error("no snapshot");
      }
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
    } catch (err) {
      console.warn("[Zia] Drag picture: couldn't draw the page, showing its icon instead.", err);
      const icon = new Image();
      icon.src = tab.getAttribute("image") || "";
      await icon.decode().catch(() => {});
      if (icon.naturalWidth) {
        ctx.drawImage(icon, width / 2 - 12, height / 2 - 12, 24, 24);
      }
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, width - 1, height - 1, 7);
    ctx.stroke();
    return canvas;
  }

  function showSplitDrop(tab, event) {
    const overlay = ensureSplitOverlay();
    const box = gBrowser.tabbox.getBoundingClientRect();
    overlay.style.setProperty("--zia-drop-left", `${box.left}px`);
    overlay.style.setProperty("--zia-drop-top", `${box.top}px`);
    overlay.style.setProperty("--zia-drop-width", `${box.width}px`);
    overlay.style.setProperty("--zia-drop-height", `${box.height}px`);
    splitDrop.tab = tab;
    splitDrop.side = null;
    splitDrop.dragImageSet = false;

    const picture = makeDragPicture(tab);
    const target = splitDrop.target;
    let switched = false;
    const showTarget = () => {
      if (switched) {
        return;
      }
      switched = true;
      if (target && splitDrop.tab === tab && overlay.hasAttribute("open") && gBrowser.selectedTab !== target) {
        gBrowser.selectedTab = target;
      }
    };
    picture.finally(showTarget);
    setTimeout(showTarget, 450);
    overlay.setAttribute("open", "true");

    requestAnimationFrame(() => {
      if (overlay.hasAttribute("open")) {
        overlay.setAttribute("shown", "true");
      }
    });

    const dt = event.dataTransfer;
    picture.then((canvas) => {
      if (splitDrop.tab !== tab || !overlay.hasAttribute("open")) {
        return;
      }
      splitDrop.dataTransfer = dt;
      hideSystemDragImage(dt);
      canvas.setAttribute("following", "true");
      movePicture(lastCursor.x, lastCursor.y);
    });
  }

  function hideSplitDrop(event) {
    const overlay = splitDrop.overlay;
    if (!overlay?.hasAttribute("open")) {
      return;
    }
    overlay.removeAttribute("shown");
    overlay.removeAttribute("open");
    splitDrop.thumb?.removeAttribute("following");
    setDropSide(null);
    if (splitDrop.dragImageSet && event?.dataTransfer) {
      try {
        const original = gBrowser.tabContainer.tabDragAndDrop?.originalDragImageArgs;
        if (original) {
          event.dataTransfer.updateDragImage(...original);
        }
      } catch (err) {
      }
    }
    splitDrop.tab = null;
    splitDrop.target = null;
    splitDrop.dataTransfer = null;
    splitDrop.dragImageSet = false;
  }

  function setDropSide(side, cursorX = 0, cursorY = 0) {
    splitDrop.side = side;
    const overlay = splitDrop.overlay;
    if (!overlay) {
      return;
    }
    overlay.toggleAttribute("has-side", !!side);
    for (const [name, zone] of Object.entries(splitDrop.zones)) {
      const active = name === side;
      zone.toggleAttribute("active", active);
      if (!active) {
        zone.style.setProperty("--zia-zone-tx", "0px");
        zone.style.setProperty("--zia-zone-ty", "0px");
        continue;
      }

      const box = overlay.getBoundingClientRect();
      const w = Math.min(ZONE_ACTIVE_W, box.width * 0.45);
      const h = Math.min(ZONE_ACTIVE_H, box.height * 0.86);
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      let tx;
      if (name === "left") {
        const baseCentre = box.left + ZONE_EDGE + w / 2;
        tx = clamp((cursorX - baseCentre) * MAGNET_PULL_X, 8 - (box.left + ZONE_EDGE), box.width / 2 - ZONE_EDGE - w);
      } else {
        const baseCentre = box.right - ZONE_EDGE - w / 2;
        tx = clamp((cursorX - baseCentre) * MAGNET_PULL_X, -(box.width / 2 - ZONE_EDGE - w), window.innerWidth - 8 - (box.right - ZONE_EDGE));
      }
      const room = Math.max(0, box.height / 2 - h / 2 - 8);
      const ty = clamp((cursorY - (box.top + box.height / 2)) * MAGNET_PULL_Y, -room, room);
      zone.style.setProperty("--zia-zone-tx", `${tx.toFixed(1)}px`);
      zone.style.setProperty("--zia-zone-ty", `${ty.toFixed(1)}px`);
    }
  }

  function sideAt(event) {
    const box = gBrowser.tabbox.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) {
      return null;
    }
    const x = event.clientX - box.left;
    if (x < box.width * MAGNET_SHARE) {
      return "left";
    }
    if (x > box.width * (1 - MAGNET_SHARE)) {
      return "right";
    }
    return null;
  }

  function followDrag(event) {
    movePicture(event.clientX, event.clientY);
    if (splitDrop.thumb?.hasAttribute("following")) {
      hideSystemDragImage(event.dataTransfer, false);
    }
    const side = sideAt(event);
    if (side !== splitDrop.side && side) {
      Services.zen?.playHapticFeedback?.();
    }
    setDropSide(side, event.clientX, event.clientY);
  }

  function onSplitDragOver(event) {
    if (!splitDrop.tab) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }

  function onSplitDrop(event) {
    const tab = splitDrop.tab;
    const target = splitDrop.target;
    const side = splitDrop.side;
    event.preventDefault();
    event.stopPropagation();
    hideSplitDrop(event);
    if (!tab || !side) {
      return;
    }

    setTimeout(() => {
      try {
        splitTabToSide(tab, side, target);
      } catch (err) {
        console.error("[Zia] Split on drop failed:", err);
      }
    }, 0);
  }

  function splitTabToSide(tab, side, onTab = gBrowser.selectedTab) {
    const splitter = window.gZenViewSplitter;
    const glance = window.gZenGlanceManager;
    const base = onTab && !onTab.closing ? onTab : gBrowser.selectedTab;
    let target = glance?.getTabOrGlanceParent?.(base) ?? base;
    let dragged = glance?.getTabOrGlanceParent?.(tab) ?? tab;

    if (dragged === target) {
      const url = searchHomeUrl && newTabSearchEnabled() ? searchHomeUrl : "about:newtab";
      const newTab = gBrowser.addTrustedTab(url, { inBackground: true });
      const left = side === "left";
      splitter.splitTabs(left ? [target, newTab] : [newTab, target], "vsep", left ? 1 : 0);
      gBrowser.selectedTab = newTab;
      return;
    }

    const pair = [dragged, target];
    const anyEssential = pair.some((t) => t.hasAttribute("zen-essential"));
    const somePinned = pair.some((t) => t.pinned) && !pair.every((t) => t.pinned);
    if (anyEssential || somePinned) {
      [dragged, target] = pair.map((t) => (t.pinned ? gBrowser.duplicateTab(t, true) : t));
    }

    const left = side === "left";
    splitter.splitTabs(left ? [dragged, target] : [target, dragged], "vsep", left ? 0 : 1);
    gBrowser.selectedTab = dragged;
  }

  function watchSplitDrop() {
    if (!window.gZenViewSplitter || !gBrowser.tabbox) {
      return;
    }
    window.addEventListener(
      "dragover",
      (event) => {
        const open = splitDrop.overlay?.hasAttribute("open");
        const overPage = isOverPage(event);
        if (open) {
          if (overPage) {
            gBrowser.tabContainer.tabDragAndDrop?.clearSpaceSwitchTimer?.();
          }
          followDrag(event);
          return;
        }
        if (!overPage) {
          return;
        }
        const tab = draggedTabOf(event);
        const target = tab && splitTargetFor(tab);
        if (tab && canSplitWith(tab, target)) {
          splitDrop.target = target;
          gBrowser.tabContainer.tabDragAndDrop?.clearSpaceSwitchTimer?.();
          showSplitDrop(tab, event);
          followDrag(event);
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
    window.addEventListener("dragend", hideSplitDrop, true);

    gBrowser.tabContainer.addEventListener("TabSelect", (event) => {
      splitDrop.lastSelect = { tab: event.target, previous: event.detail?.previousTab || null, time: Date.now() };
    });
    window.addEventListener("dragstart", () => (splitDrop.dragStartedAt = Date.now()), true);
    window.addEventListener(
      "drop",
      (event) => {
        if (!event.target?.closest?.("#zia-split-drop")) {
          hideSplitDrop(event);
        }
      },
      true
    );
  }

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

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const ICONS = "chrome://sine/content/zia/icons/";
  const paneColorTimers = new WeakMap();

  function splitContainers() {
    const panels = gBrowser.tabpanels;
    if (panels?.getAttribute("zen-split-view") !== "true") {
      return [];
    }
    return [...panels.querySelectorAll(":scope > .browserSidebarContainer[zen-split='true']")].filter(
      (container) => !container.classList.contains("zen-glance-overlay")
    );
  }

  function paneBrowser(container) {
    return container.querySelector("browser");
  }

  function paneOfBrowser(browser) {
    const container = browser?.closest?.(".browserSidebarContainer");
    return container?.querySelector(":scope .zia-pane-bar") ? container : null;
  }

  function paneButton(name, label, onClick) {
    const button = document.createElementNS(HTML_NS, "button");
    button.className = `zia-pane-button zia-pane-${name}`;
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    const img = document.createElementNS(HTML_NS, "img");
    img.setAttribute("src", `${ICONS}${name}.svg`);
    img.setAttribute("alt", "");
    button.appendChild(img);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick(event, button);
    });
    return button;
  }

  function createPaneBar(container) {
    const bar = document.createElementNS(HTML_NS, "div");
    bar.className = "zia-pane-bar";
    const tabOf = () => gBrowser.getTabForBrowser(paneBrowser(container));

    bar.addEventListener("mousedown", () => {
      const tab = tabOf();
      if (tab && gBrowser.selectedTab !== tab) {
        gBrowser.selectedTab = tab;
      }
    });

    bar.appendChild(
      paneButton("sidebar", "Toggle sidebar", () => {
        document.getElementById("zen-toggle-compact-mode")?.doCommand?.();
      })
    );
    bar.appendChild(paneButton("back", "Back", () => paneBrowser(container)?.goBack()));
    bar.appendChild(paneButton("forward", "Forward", () => paneBrowser(container)?.goForward()));
    bar.appendChild(
      paneButton("reload", "Reload", () => {
        const browser = paneBrowser(container);
        const tab = tabOf();
        if (tab?.hasAttribute("busy")) {
          browser?.stop();
        } else {
          browser?.reload();
        }
      })
    );

    const address = document.createElementNS(HTML_NS, "div");
    address.className = "zia-pane-address";
    const host = document.createElementNS(HTML_NS, "span");
    host.className = "zia-pane-host";
    const rest = document.createElementNS(HTML_NS, "span");
    rest.className = "zia-pane-rest";
    address.append(host, rest);
    address.addEventListener("click", () => {
      const tab = tabOf();
      if (tab && gBrowser.selectedTab !== tab) {
        gBrowser.selectedTab = tab;
      }

      requestAnimationFrame(() => {
        placeOpenedAddressBar();
        const command = document.getElementById("Browser:OpenLocation");
        if (command) {
          command.doCommand();
        } else {
          gURLBar.select();
        }
      });
    });
    bar.appendChild(address);

    bar.appendChild(
      paneButton("site-settings", "Site settings and extensions", () => {
        const tab = tabOf();
        if (tab && gBrowser.selectedTab !== tab) {
          gBrowser.selectedTab = tab;
        }
        placeOpenedAddressBar();

        requestAnimationFrame(() => document.getElementById("zen-site-data-icon-button")?.click());
      })
    );

    bar.appendChild(
      paneButton("close", "Remove from split", (event) => {
        window.gZenViewSplitter?.removeTabFromSplit?.(event, container);
      })
    );

    const stack = container.querySelector(".browserStack");
    const holder = stack?.parentNode || container.querySelector(".browserContainer") || container;
    holder.insertBefore(bar, holder.firstChild);
    return bar;
  }

  const paneLoads = new WeakMap();

  function setPaneProgress(container, value) {
    const address = container.querySelector(".zia-pane-address");
    if (!address) {
      return;
    }
    const state = paneLoads.get(container) || { progress: 0, timer: null };
    state.progress = Math.max(state.progress, Math.min(1, value));
    paneLoads.set(container, state);
    address.style.setProperty("--zia-load-progress", state.progress.toFixed(3));
  }

  function startPaneLoad(container) {
    const address = container.querySelector(".zia-pane-address");
    if (!address) {
      return;
    }
    const old = paneLoads.get(container);
    clearInterval(old?.timer);
    const state = { progress: 0, timer: null };
    paneLoads.set(container, state);
    address.style.setProperty("--zia-load-progress", "0");
    address.setAttribute("zia-loading", "true");
    state.startedAt = Date.now();
    setPaneProgress(container, 0.12);

    state.timer = setInterval(() => {
      if (state.progress < 0.85) {
        setPaneProgress(container, state.progress + (0.85 - state.progress) * 0.08);
      }
    }, 120);
  }

  function finishPaneLoad(container) {
    const address = container.querySelector(".zia-pane-address");
    const state = paneLoads.get(container);
    clearInterval(state?.timer);
    if (!address || !address.hasAttribute("zia-loading")) {
      return;
    }

    const shownFor = Date.now() - (state?.startedAt || 0);
    const stillThisLoad = () => paneLoads.get(container) === state;
    setTimeout(() => stillThisLoad() && setPaneProgress(container, 1), Math.max(0, 450 - shownFor));
    setTimeout(() => {
      if (!stillThisLoad()) {
        return;
      }
      address.removeAttribute("zia-loading");
      setTimeout(() => {
        if (!address.hasAttribute("zia-loading")) {
          address.style.setProperty("--zia-load-progress", "0");
          paneLoads.delete(container);
        }
      }, 320);
    }, 250 + Math.max(0, 450 - shownFor));
  }

  function updatePaneBar(container) {
    const bar = container.querySelector(".zia-pane-bar");
    const browser = paneBrowser(container);
    if (!bar || !browser) {
      return;
    }
    const tab = gBrowser.getTabForBrowser(browser);

    let host = "";
    try {
      const uri = browser.currentURI;
      if (uri && /^https?$/.test(uri.scheme)) {
        host = uri.displayHost.replace(/^www\./, "");
      } else if (uri && uri.spec !== "about:blank") {
        host = uri.spec;
      }
    } catch (err) {
      host = "";
    }
    const title = (browser.contentTitle || tab?.label || "").trim();

    let isHomePage = false;
    try {
      const uri = browser.currentURI;
      isHomePage = (uri.filePath === "/" || uri.filePath === "") && !uri.query && !uri.ref;
    } catch (err) {
      isHomePage = false;
    }
    bar.querySelector(".zia-pane-host").textContent = host || title || "New Tab";
    bar.querySelector(".zia-pane-rest").textContent =
      host && title && title !== host && !isHomePage ? ` / ${title}` : "";

    bar.querySelector(".zia-pane-back").disabled = !browser.canGoBack;
    bar.querySelector(".zia-pane-forward").disabled = !browser.canGoForward;
    const busy = !!tab?.hasAttribute("busy");
    const reload = bar.querySelector(".zia-pane-reload");
    reload.querySelector("img").setAttribute("src", `${ICONS}${busy ? "stop" : "reload"}.svg`);
    reload.setAttribute("title", busy ? "Stop" : "Reload");
  }

  async function colorPaneBar(container) {
    const bar = container.querySelector(".zia-pane-bar");
    const browser = paneBrowser(container);
    if (!bar || !browser) {
      return;
    }
    let reading = null;
    try {
      reading = await sampleTopColor(browser);
    } catch (err) {
    }
    if (!reading?.rgb) {
      return;
    }
    bar.style.setProperty("--zia-pane-bg", cssColor(reading.rgb));
    bar.toggleAttribute("light", brightnessOf(reading.rgb) > LIGHT_THRESHOLD);
  }

  function colorPaneSoon(container, delay = 60) {
    if (!container || paneColorTimers.get(container)) {
      return;
    }
    paneColorTimers.set(
      container,
      setTimeout(() => {
        paneColorTimers.delete(container);
        colorPaneBar(container);
      }, delay)
    );
  }

  let paneFrame = null;

  function refreshPanes() {
    paneFrame = null;
    const containers = splitContainers();
    setFlag("zia-split", containers.length > 1);

    for (const bar of gBrowser.tabpanels.querySelectorAll(".zia-pane-bar")) {
      const container = bar.closest(".browserSidebarContainer");
      if (!containers.includes(container)) {
        bar.remove();
      }
    }
    if (containers.length < 2) {
      return;
    }

    let leftmost = null;
    for (const container of containers) {
      if (!container.querySelector(".zia-pane-bar")) {
        createPaneBar(container);
        colorPaneSoon(container, 0);
      }
      const rect = container.getBoundingClientRect();
      if (!leftmost || rect.left < leftmost.rect.left - 1 || (Math.abs(rect.left - leftmost.rect.left) <= 1 && rect.top < leftmost.rect.top)) {
        leftmost = { container, rect };
      }
      updatePaneBar(container);
    }
    for (const container of containers) {
      container.querySelector(".zia-pane-bar")?.toggleAttribute("first", container === leftmost?.container);
    }
    placeOpenedAddressBar(containers);
  }

  function placeOpenedAddressBar(containers = splitContainers()) {
    const focused = containers.find((c) => c.classList.contains("deck-selected")) || containers[0];
    const bar = focused?.querySelector(".zia-pane-bar");
    if (!bar) {
      return;
    }
    const rect = bar.getBoundingClientRect();
    root.style.setProperty("--zia-pane-url-left", `${Math.round(rect.left + 6)}px`);
    root.style.setProperty("--zia-pane-url-top", `${Math.round(rect.top + 4)}px`);
    root.style.setProperty("--zia-pane-url-width", `${Math.round(rect.width - 12)}px`);
  }

  function schedulePanes() {
    if (!paneFrame) {
      paneFrame = requestAnimationFrame(refreshPanes);
    }
  }

  function watchSplitPanes() {
    const panels = gBrowser.tabpanels;
    if (!panels) {
      return;
    }
    new MutationObserver(schedulePanes).observe(panels, {
      attributes: true,
      subtree: true,
      attributeFilter: ["zen-split-view", "zen-split"],
    });
    gBrowser.tabContainer.addEventListener("TabSelect", schedulePanes);
    gBrowser.tabContainer.addEventListener("TabAttrModified", (event) => {
      const container = paneOfBrowser(event.target.linkedBrowser);
      if (container) {
        updatePaneBar(container);
      }
    });
    window.addEventListener("resize", schedulePanes);

    const { STATE_STOP, STATE_IS_WINDOW } = Ci.nsIWebProgressListener;
    gBrowser.addTabsProgressListener({
      onProgressChange(browser, webProgress, request, curSelf, maxSelf, curTotal, maxTotal) {
        const container = paneOfBrowser(browser);
        if (container && maxTotal > 0) {
          setPaneProgress(container, 0.12 + (curTotal / maxTotal) * 0.8);
        }
      },
      onLocationChange(browser, webProgress) {
        const container = webProgress.isTopLevel && paneOfBrowser(browser);
        if (container) {
          updatePaneBar(container);
          colorPaneSoon(container, 150);
        }
      },
      onStateChange(browser, webProgress, request, stateFlags) {
        const container = webProgress.isTopLevel && paneOfBrowser(browser);
        if (!container) {
          return;
        }
        updatePaneBar(container);
        if (stateFlags & Ci.nsIWebProgressListener.STATE_START && stateFlags & STATE_IS_WINDOW) {
          startPaneLoad(container);
        }
        if (stateFlags & STATE_STOP && stateFlags & STATE_IS_WINDOW) {
          finishPaneLoad(container);
          colorPaneSoon(container, 50);
          colorPaneSoon(container, 800);
        }
      },
    });

    const onScroll = window.ziaOnPageScroll;
    window.ziaOnPageScroll = (browser, position) => {
      onScroll?.(browser, position);
      const container = paneOfBrowser(browser);
      if (container) {
        colorPaneSoon(container);
      }
    };
    const onPainted = window.ziaOnPagePainted;
    window.ziaOnPagePainted = (browser) => {
      onPainted?.(browser);
      const container = paneOfBrowser(browser);
      if (container) {
        colorPaneSoon(container, 0);
      }
    };

    schedulePanes();
  }

  function updateSpaceColored() {
    let colored = false;
    if (root.getAttribute("zen-default-theme") !== "true") {
      const value = getComputedStyle(root).getPropertyValue("--zen-primary-color").trim();
      const m = value.match(/\d+(\.\d+)?/g);
      if (m && m.length >= 3) {
        const [r, g, b] = m.slice(0, 3).map(Number);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        colored = saturation > 0.18 && max > 40;
      }
    }
    setFlag("zia-space-colored", colored);
  }

  function watchSpaceColor() {
    let frame = null;
    let lastKey = null;
    const schedule = () => {
      const key = `${root.getAttribute("zen-default-theme")}|${root.style.getPropertyValue("--zen-primary-color")}|${Services.prefs.getStringPref("zen.workspaces.active", "")}`;
      if (key === lastKey) {
        return;
      }
      lastKey = key;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = null;
          updateSpaceColored();
        });
      }
    };
    new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ["zen-default-theme", "style"] });
    window.addEventListener("ZenWorkspacesUIUpdate", schedule);
    Services.prefs.addObserver("zen.workspaces.active", schedule);
    window.addEventListener("unload", () => Services.prefs.removeObserver("zen.workspaces.active", schedule));
    schedule();
  }

  function animateEssentialsAdds() {
    const manager = window.gZenPinnedTabManager;
    if (!manager || typeof manager.addToEssentials !== "function" || manager.addToEssentials.__zia) {
      return;
    }
    let fromMenu = false;
    const original = manager.addToEssentials;
    const patched = function (tab, ...rest) {
      fromMenu = !tab;
      try {
        return original.call(this, tab, ...rest);
      } finally {
        setTimeout(() => (fromMenu = false), 0);
      }
    };
    patched.__zia = true;
    manager.addToEssentials = patched;

    window.addEventListener("TabAddedToEssentials", (event) => {
      if (!fromMenu || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      const tab = event.detail?.tab || event.target;

      const hideNow = tab?.querySelector?.(".tab-stack") || tab;
      if (hideNow?.style) {
        hideNow.style.opacity = "0";
      }

      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const tile = tab?.querySelector?.(".tab-stack") || tab;
          if (!tile?.animate) {
            tile?.style?.removeProperty?.("opacity");
            return;
          }

          tile.style.willChange = "transform, opacity, filter";
          const animation = tile.animate(
            [
              { transform: "scale(0.75)", filter: "blur(5px)", opacity: 0 },
              { transform: "scale(1)", filter: "blur(0px)", opacity: 1 },
            ],
            { duration: 820, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
          tile.style.removeProperty("opacity");
          const cleanUp = () => tile.style.removeProperty("will-change");
          animation.finished.then(cleanUp, cleanUp);
        })
      );
    });
  }

  const UNDO_WINDOW_MS = 10000;
  const undoState = { count: 0, closedAt: 0 };

  function reopenOneTab() {
    try {
      if (window.SessionStore?.undoCloseTab) {
        window.SessionStore.undoCloseTab(window, 0);
        return true;
      }
    } catch (err) {
    }
    try {
      if (typeof window.undoCloseTab === "function") {
        window.undoCloseTab();
        return true;
      }
    } catch (err) {
    }
    try {
      const command = document.getElementById("History:UndoCloseTab");
      if (command) {
        command.doCommand();
        return true;
      }
    } catch (err) {
    }
    return false;
  }

  function undoClosedTabs() {
    const count = Math.max(1, undoState.count);
    undoState.count = 0;
    undoState.closedAt = 0;
    for (let i = 0; i < count; i++) {
      if (!reopenOneTab()) {
        console.warn("[Zia] Undo close: this build didn't reopen the tab.");
        break;
      }
    }
  }

  function watchUndoClose() {
    gBrowser.tabContainer.addEventListener("TabClose", (event) => {
      const tab = event.target;
      const url = tab.linkedBrowser?.currentURI?.spec || "";
      if (tab.hasAttribute("zen-empty-tab") || url === "about:blank" || url === "about:newtab") {
        return;
      }
      const recent = Date.now() - undoState.closedAt < 1000;
      undoState.count = recent ? undoState.count + 1 : 1;
      undoState.closedAt = Date.now();
    });

    window.addEventListener(
      "keydown",
      (event) => {
        if (Date.now() - undoState.closedAt > UNDO_WINDOW_MS || event.defaultPrevented) {
          return;
        }
        const accel = AppConstants.platform === "macosx" ? event.metaKey : event.ctrlKey;
        if (!accel || event.shiftKey || event.altKey || event.key.toLowerCase() !== "z") {
          return;
        }
        const target = event.composedTarget || event.target;
        if (target?.localName === "input" || target?.localName === "textarea" || target?.isContentEditable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        undoClosedTabs();
      },
      true
    );
  }

  function defaultEngineName() {
    try {
      const search =
        Services.search ||
        ChromeUtils.importESModule("moz-src:///toolkit/components/search/SearchService.sys.mjs").SearchService;
      return search.defaultEngine?.name || "";
    } catch (err) {
      return "";
    }
  }

  function updateTypedIcon() {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");
    const value = (gURLBar.value || "").trim();
    const host = value.match(/^(?:https?:\/\/)?([\w-]+(?:\.[\w-]+)+)/i)?.[1];
    if (host) {
      urlbar.style.setProperty("--zia-typed-icon", `url("page-icon:https://${host}/")`);
    } else {
      urlbar.style.removeProperty("--zia-typed-icon");
    }
  }

  function shortenEngineActions(results) {
    const name = defaultEngineName();
    if (!name) {
      return;
    }
    for (const action of results.querySelectorAll(".urlbarView-action")) {
      if (action.classList.contains("urlbarView-switchToTab") ||
          action.closest(".urlbarView-row")?.getAttribute("type") === "switchtab") {
        continue;
      }
      const text = action.textContent || "";
      if (!text || text === name) {
        continue;
      }

      if (!text.includes(name) && !action.hasAttribute("data-l10n-id")) {
        continue;
      }
      action.removeAttribute("data-l10n-id");
      action.removeAttribute("data-l10n-args");
      action.textContent = name;
    }
  }

  const POP_STEP = 0.5;
  let popIconStart = null;
  let popTextGap = null;
  let popLayout = null;

  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function alignTypedTextWithRows(results, passesLeft = 8) {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");

    if (!urlbar?.hasAttribute("breakout-extend")) {
      popIconStart = null;
      popTextGap = null;
      return;
    }
    const row = results.querySelector(".urlbarView-row");
    const icon = row?.querySelector(".urlbarView-favicon, .urlbarView-type-icon");
    const title = row?.querySelector(".urlbarView-title");
    const barRect = urlbar?.getBoundingClientRect();
    const iconRect = icon?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();
    if (!barRect?.width || !iconRect?.width || !titleRect?.width) {
      return;
    }

    const layout = `${Math.round(barRect.left)}:${Math.round(barRect.width)}`;
    if (layout !== popLayout) {
      popLayout = layout;
      popIconStart = null;
      popTextGap = null;
    }

    if (popIconStart === null) {
      popIconStart = clamp(iconRect.left - barRect.left, 0, 60);
      popTextGap = clamp(titleRect.left - iconRect.right, 0, 40);
      urlbar.style.setProperty("--zia-pop-icon-start", `${popIconStart}px`);
      urlbar.style.setProperty("--zia-pop-text-gap", `${popTextGap}px`);
    }

    const barIcon = document.getElementById("identity-icon");
    const input = urlbar.querySelector(".urlbar-input");
    const barIconRect = barIcon?.getBoundingClientRect();
    const inputRect = input?.getBoundingClientRect();
    if (!barIconRect?.width || !inputRect?.width) {
      return;
    }
    const textLeft = inputRect.left + (parseFloat(getComputedStyle(input).paddingInlineStart) || 0);
    const iconError = iconRect.left - barIconRect.left;
    const textError = titleRect.left - textLeft;

    const gapError = textError - iconError;

    let moved = false;
    if (Math.abs(iconError) > 0.3) {
      popIconStart = clamp(popIconStart + iconError * POP_STEP, 0, 60);
      urlbar.style.setProperty("--zia-pop-icon-start", `${popIconStart}px`);
      moved = true;
    }
    if (Math.abs(gapError) > 0.3) {
      popTextGap = clamp(popTextGap + gapError * POP_STEP, 0, 40);
      urlbar.style.setProperty("--zia-pop-text-gap", `${popTextGap}px`);
      moved = true;
    }
    if (moved && passesLeft > 0) {
      requestAnimationFrame(() => alignTypedTextWithRows(results, passesLeft - 1));
    }
  }

  const POP_BOTTOM_WANT = 8;
  let popBottomTrim = null;

  function fitPopoverBottom(passesLeft = 8) {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");
    if (!urlbar?.hasAttribute("breakout-extend")) {
      popBottomTrim = null;
      root.removeAttribute("zia-pop-scrolls");
      urlbar?.style.removeProperty("--zia-pop-bottom-trim");
      return;
    }
    const view = urlbar.querySelector(".urlbarView");
    const background = urlbar.querySelector(".urlbar-background");
    const rows = urlbar.querySelectorAll(".urlbarView-row");
    const last = rows[rows.length - 1];
    if (!view || !background || !last) {
      return;
    }

    const scrolls = [view, ...view.querySelectorAll("*")].some((el) => el.scrollHeight > el.clientHeight + 1);
    if (scrolls) {
      root.setAttribute("zia-pop-scrolls", "true");
      popBottomTrim = 0;
      urlbar.style.setProperty("--zia-pop-bottom-trim", "0px");
      return;
    }
    root.removeAttribute("zia-pop-scrolls");

    if (popBottomTrim === null) {
      popBottomTrim = parseFloat(getComputedStyle(urlbar).getPropertyValue("--zia-pop-bottom-trim")) || 0;
    }
    const error = background.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom - POP_BOTTOM_WANT;
    if (Math.abs(error) > 0.3 && passesLeft > 0) {
      popBottomTrim += error * POP_STEP;
      urlbar.style.setProperty("--zia-pop-bottom-trim", `${popBottomTrim}px`);
      requestAnimationFrame(() => fitPopoverBottom(passesLeft - 1));
    }
  }

  function watchTypedAddress() {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");
    const input = urlbar?.querySelector(".urlbar-input");
    if (!input) {
      return;
    }
    input.addEventListener("input", updateTypedIcon);
    urlbar.addEventListener("focus", updateTypedIcon, true);
    urlbar.addEventListener("blur", () => urlbar.style.removeProperty("--zia-typed-icon"), true);

    const results = document.getElementById("urlbar-results");
    if (results) {
      new MutationObserver(() => {
        shortenEngineActions(results);
        alignTypedTextWithRows(results);
        fitPopoverBottom();

        requestAnimationFrame(() => {
          alignTypedTextWithRows(results);
          fitPopoverBottom();
        });
      }).observe(results, { childList: true, subtree: true, characterData: true });

      new MutationObserver(() => fitPopoverBottom()).observe(urlbar, {
        attributes: true,
        attributeFilter: ["breakout-extend"],
      });
    }
  }

  function applyZenDefaults() {
    const defaults = Services.prefs.getDefaultBranch("");
    const set = (name, value) => {
      try {
        defaults.setBoolPref(name, value);
      } catch (err) {
        console.error(`[Zia] Could not set default for ${name}:`, err);
      }
    };
    set("zen.widget.mac.mono-window-controls", false);
    set("zen.urlbar.replace-newtab", false);
    set("zen.splitView.enable-tab-drop", false);

    for (const feature of FEATURES) {
      set(`zia.features.${feature}`, true);
    }

    set("zia.features.folder-icon-suggest", false);
  }

  const FEATURES = ["media-player", "find-bar", "icon-picker", "undo-close", "folder-icon-suggest"];

  function featureOn(name) {
    try {
      return Services.prefs.getBoolPref(`zia.features.${name}`, true);
    } catch (err) {
      return true;
    }
  }

  function ifOn(feature, name, fn) {
    if (featureOn(feature)) {
      safely(name, fn);
    }
  }

  function addDownloadProgress() {
    const button = document.getElementById("downloads-button");
    const commons = window.DownloadsCommon;
    if (!button || !commons?.getData) {
      return;
    }

    const NS = "http://www.w3.org/2000/svg";
    const ring = document.createElementNS(NS, "svg");
    ring.id = "zia-download-ring";
    ring.setAttribute("viewBox", "0 0 100 100");
    const track = document.createElementNS(NS, "circle");
    const arc = document.createElementNS(NS, "circle");

    const RADIUS = 46;
    const STROKE = 7;
    for (const circle of [track, arc]) {
      circle.setAttribute("cx", "50");
      circle.setAttribute("cy", "50");
      circle.setAttribute("r", `${RADIUS}`);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke-width", `${STROKE}`);
      ring.appendChild(circle);
    }
    track.setAttribute("class", "zia-download-ring-track");
    arc.setAttribute("class", "zia-download-ring-arc");
    arc.setAttribute("stroke-linecap", "round");

    arc.setAttribute("transform", "rotate(-90 50 50)");
    const circumference = 2 * Math.PI * RADIUS;
    arc.setAttribute("stroke-dasharray", `${circumference}`);
    arc.setAttribute("stroke-dashoffset", `${circumference}`);
    button.appendChild(ring);

    function draw(fraction) {
      arc.setAttribute("stroke-dashoffset", `${circumference * (1 - fraction)}`);
    }

    function update(downloads) {
      let done = 0;
      let total = 0;
      let running = false;
      for (const download of downloads) {
        if (download.succeeded || download.canceled || download.error) {
          continue;
        }

        if (download.hasProgress && download.totalBytes > 0) {
          done += download.currentBytes || 0;
          total += download.totalBytes;
        }
        running = true;
      }
      if (!running || total <= 0) {
        button.removeAttribute("zia-downloading");
        draw(0);
        return;
      }
      button.setAttribute("zia-downloading", "true");
      draw(Math.min(1, done / total));
    }

    const data = commons.getData(window);
    const seen = new Set();
    const view = {
      onDownloadAdded(download) {
        seen.add(download);
        update(seen);
      },
      onDownloadChanged(download) {
        seen.add(download);
        update(seen);
      },
      onDownloadRemoved(download) {
        seen.delete(download);
        update(seen);
      },
    };
    data.addView(view);
  }

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

  function watchCompactTopRow() {
    const navBar = document.getElementById("nav-bar");
    if (!navBar) {
      return;
    }

    function inCompactMode() {
      return root.getAttribute("zen-compact-mode") === "true";
    }

    function windowButtons() {
      return window.gZenVerticalTabsManager?.actualWindowButtons || null;
    }

    function moveTopRow() {
      if (!inCompactMode()) {
        return;
      }
      const titlebar = document.getElementById("titlebar");
      const topButtons = document.getElementById("zen-sidebar-top-buttons");
      if (!titlebar || !topButtons) {
        return;
      }
      if (topButtons.parentElement !== titlebar) {
        titlebar.prepend(topButtons);
      }
      const buttons = windowButtons();
      if (buttons && buttons.parentElement !== topButtons) {
        topButtons.prepend(buttons);
      }
    }

    const watcher = new MutationObserver(() => moveTopRow());
    watcher.observe(navBar, { childList: true });

    const toolbox = document.getElementById("navigator-toolbox");
    const SIDEBAR_SHOWN_ATTRS = ["zen-has-hover", "zen-user-show", "zen-has-empty-tab", "flash-popup", "has-popup-menu", "movingtab", "zen-compact-mode-active"];

    function syncPanelOpen() {
      const shown = inCompactMode() && !!toolbox && SIDEBAR_SHOWN_ATTRS.some((name) => toolbox.hasAttribute(name));
      setFlag("zia-panel-open", shown);
    }

    if (toolbox) {
      const panelWatcher = new MutationObserver(syncPanelOpen);
      panelWatcher.observe(toolbox, { attributes: true, attributeFilter: SIDEBAR_SHOWN_ATTRS });
    }

    const modeWatcher = new MutationObserver(() => {
      moveTopRow();
      syncPanelOpen();
    });
    modeWatcher.observe(root, { attributes: true, attributeFilter: ["zen-compact-mode"] });

    moveTopRow();
    syncPanelOpen();
  }

  const ICON_SYNONYMS = {
    flight: "airplane", flights: "airplane", fly: "airplane", airline: "airplane",
    travel: "airplane", trip: "suitcase", holiday: "suitcase", vacation: "suitcase",
    hike: "mountains", hikes: "mountains", hiking: "mountains", trail: "mountains",
    walk: "mountains", climb: "mountains", outdoors: "tree", camping: "tent",
    shop: "shopping-cart", shopping: "shopping-cart", buy: "shopping-cart",
    order: "package", orders: "package", delivery: "truck",
    money: "wallet", bank: "bank", budget: "wallet", invoice: "invoice",
    pay: "credit-card", payment: "credit-card", finance: "chart-line-up",
    code: "code", coding: "code", github: "github-logo", git: "git-branch",
    dev: "terminal", api: "brackets-curly", server: "hard-drives",
    docs: "file-text", doc: "file-text", notes: "note", note: "note",
    read: "book-open", reading: "book-open", book: "book", books: "books",
    music: "music-notes", song: "music-notes", playlist: "playlist",
    video: "video", videos: "video", film: "film-slate", movie: "film-slate",
    movies: "film-slate", watch: "monitor-play", stream: "broadcast",
    game: "game-controller", games: "game-controller", gaming: "game-controller",
    health: "heartbeat", medical: "first-aid-kit", doctor: "stethoscope",
    fitness: "barbell", gym: "barbell", run: "person-simple-run",
    food: "fork-knife", recipe: "cooking-pot", recipes: "cooking-pot",
    cook: "cooking-pot", coffee: "coffee", drink: "beer-stein",
    work: "briefcase", job: "briefcase", jobs: "briefcase", career: "briefcase",
    meeting: "users-three", team: "users-three", email: "envelope",
    mail: "envelope", inbox: "tray", calendar: "calendar", schedule: "calendar",
    home: "house", house: "house", rent: "house", property: "buildings",
    car: "car", cars: "car", drive: "car", train: "train", transport: "bus",
    photo: "image", photos: "images", picture: "image", design: "palette",
    art: "palette", draw: "pencil", ai: "sparkle", chat: "chat-circle",
    news: "newspaper", weather: "cloud-sun", forecast: "cloud-sun",
    learn: "graduation-cap", course: "graduation-cap", study: "student",
    school: "graduation-cap", plan: "list-checks", todo: "list-checks",
    tasks: "list-checks", project: "kanban", idea: "lightbulb",
    settings: "gear", tools: "wrench", security: "shield-check",
    password: "key", login: "sign-in", account: "user-circle",
    pet: "paw-print", dog: "dog", cat: "cat", garden: "plant",
    gift: "gift", wedding: "heart", baby: "baby", kids: "baby",
  };

  const ICON_STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "your", "you", "that", "this", "new",
    "how", "what", "when", "why", "are", "was", "will", "can", "all", "our",
    "www", "com", "net", "org", "html", "php", "index", "home", "page", "site",
    "search", "google", "best", "top", "free", "online", "official", "site",
    "folder", "group", "tab", "tabs", "untitled",
  ]);

  function iconWords(text) {
    return String(text || "")
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2 && !ICON_STOPWORDS.has(word));
  }

  function folderWordWeights(folder) {
    const weights = new Map();
    const add = (text, weight) => {
      for (const word of iconWords(text)) {
        weights.set(word, (weights.get(word) || 0) + weight);
      }
    };
    add(folder.label || folder.getAttribute("label"), 3);
    for (const tab of folder.tabs || []) {
      add(tab.label, 1);
      try {
        add(tab.linkedBrowser?.currentURI?.host?.replace(/^www\./, ""), 0.5);
      } catch (err) {
      }
    }
    return weights;
  }

  function suggestFolderIcon(folder) {
    const weights = folderWordWeights(folder);
    if (!weights.size) {
      return null;
    }
    const names = phosphorNames();
    if (!names.length) {
      return null;
    }

    let best = null;
    let bestScore = 0;
    for (const name of names) {
      const parts = name.split("-");
      let score = 0;
      for (const [word, weight] of weights) {
        if (name === word) {
          score += weight * 4;
          continue;
        }

        if (parts.includes(word)) {
          score += weight * 2;
          continue;
        }

        if (ICON_SYNONYMS[word] === name) {
          score += weight * 3;
        }
      }
      if (!score) {
        continue;
      }

      score -= (parts.length - 1) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = name;
      }
    }

    return bestScore >= 2 ? `${ICON_DIR}/${best}.svg` : null;
  }

  const DEFAULT_FOLDER_NAMES = /^(new folder|folder|untitled|new group)$/i;

  function titleCase(text) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => (word.length > 3 ? word[0].toUpperCase() + word.slice(1) : word.toUpperCase()))
      .join(" ");
  }

  function folderTabHosts(folder) {
    const hosts = [];
    for (const tab of folder.tabs || []) {
      try {
        const host = tab.linkedBrowser?.currentURI?.host?.replace(/^www\./, "");
        if (host) {
          hosts.push(host);
        }
      } catch (err) {
      }
    }
    return hosts;
  }

  function suggestFolderName(folder) {
    const tabs = folder.tabs || [];
    if (tabs.length < 2) {
      return null;
    }

    const hosts = folderTabHosts(folder);
    if (hosts.length === tabs.length && new Set(hosts).size === 1) {
      const parts = hosts[0].split(".");
      const brand = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      if (brand && brand.length > 2) {
        return titleCase(brand);
      }
    }

    const pieces = new Map();
    for (const tab of tabs) {
      const seen = new Set();
      for (const piece of String(tab.label || "").split(/\s[-|—·]\s/)) {
        const trimmed = piece.trim();
        if (trimmed.length > 2 && trimmed.length < 30 && !seen.has(trimmed)) {
          seen.add(trimmed);
          pieces.set(trimmed, (pieces.get(trimmed) || 0) + 1);
        }
      }
    }
    for (const [piece, count] of pieces) {
      if (count === tabs.length) {
        return piece;
      }
    }

    const inside = new Map();
    for (const tab of tabs) {
      for (const word of iconWords(tab.label)) {
        inside.set(word, (inside.get(word) || 0) + 1);
      }
    }
    const outside = new Map();
    for (const tab of gBrowser.tabs) {
      if (tabs.includes(tab)) {
        continue;
      }
      for (const word of new Set(iconWords(tab.label))) {
        outside.set(word, (outside.get(word) || 0) + 1);
      }
    }
    const top = [...inside.entries()]
      .filter(([, count]) => count > 1)
      .map(([word, count]) => [word, count / (1 + (outside.get(word) || 0))])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([word]) => word);
    return top.length ? titleCase(top.join(" ")) : null;
  }

  const EMBED_CACHE = "zia-icon-vectors.json";
  const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
  let embedEngine = null;
  let iconVectors = null;

  async function textEmbedder() {
    if (embedEngine) {
      return embedEngine;
    }
    const { createEngine } = ChromeUtils.importESModule(
      "chrome://global/content/ml/EngineProcess.sys.mjs"
    );
    embedEngine = await createEngine({
      taskName: "feature-extraction",
      featureId: "simple-text-embedder",
      modelId: EMBED_MODEL,
      dtype: "q8",
    });
    return embedEngine;
  }

  function readVectors(result, count) {
    if (!result) {
      return null;
    }
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result;
    }
    const flat = result.data || result.output || result;
    if (!flat || typeof flat.length !== "number") {
      return null;
    }
    const dims = Math.floor(flat.length / count);
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(Array.from(flat.slice(i * dims, (i + 1) * dims)));
    }
    return out;
  }

  function normalise(vector) {
    let sum = 0;
    for (const value of vector) {
      sum += value * value;
    }
    const length = Math.sqrt(sum) || 1;
    return vector.map((value) => value / length);
  }

  async function embedTexts(texts) {
    const engine = await textEmbedder();
    const result = await engine.run({
      args: [texts],
      options: { pooling: "mean", normalize: true },
    });
    const vectors = readVectors(result, texts.length);
    return vectors ? vectors.map(normalise) : null;
  }

  function cachePath() {
    return PathUtils.join(PathUtils.profileDir, EMBED_CACHE);
  }

  async function loadIconVectors() {
    if (iconVectors) {
      return iconVectors;
    }
    try {
      const raw = JSON.parse(await IOUtils.readUTF8(cachePath()));
      if (raw.model === EMBED_MODEL && raw.names?.length && raw.data) {
        const bytes = Uint8Array.from(atob(raw.data), (c) => c.charCodeAt(0));
        iconVectors = { names: raw.names, dims: raw.dims, data: new Int8Array(bytes.buffer) };
        return iconVectors;
      }
    } catch (err) {
    }
    return null;
  }

  function iconPhrase(name) {
    return `${name.split("-").join(" ")} icon`;
  }

  async function buildIconVectors() {
    const names = phosphorNames();
    if (!names.length) {
      return null;
    }
    console.info(`[Zia] Embedding ${names.length} icon names, once.`);
    const all = [];
    let dims = 0;
    for (let i = 0; i < names.length; i += 64) {
      const batch = names.slice(i, i + 64);
      const vectors = await embedTexts(batch.map(iconPhrase));
      if (!vectors) {
        return null;
      }
      dims = vectors[0].length;
      for (const vector of vectors) {
        all.push(vector);
      }
    }

    const data = new Int8Array(all.length * dims);
    all.forEach((vector, row) => {
      vector.forEach((value, col) => {
        data[row * dims + col] = Math.max(-127, Math.min(127, Math.round(value * 127)));
      });
    });
    iconVectors = { names, dims, data };
    try {
      await IOUtils.writeUTF8(
        cachePath(),
        JSON.stringify({
          model: EMBED_MODEL,
          dims,
          names,
          data: btoa(String.fromCharCode(...new Uint8Array(data.buffer))),
        })
      );
    } catch (err) {
      console.warn("[Zia] Couldn't save the icon vectors; they'll be built again next time.", err);
    }
    return iconVectors;
  }

  function nearestIcon(vector, vectors) {
    const { names, dims, data } = vectors;
    let best = null;
    let bestScore = -1;
    for (let row = 0; row < names.length; row++) {
      let score = 0;
      for (let col = 0; col < dims; col++) {
        score += vector[col] * (data[row * dims + col] / 127);
      }
      if (score > bestScore) {
        bestScore = score;
        best = names[row];
      }
    }
    return { name: best, score: bestScore };
  }

  function folderText(folder) {
    const parts = [];
    const label = (folder.name || folder.label || "").trim();
    if (label && !DEFAULT_FOLDER_NAMES.test(label)) {
      parts.push(label);
    }
    for (const tab of (folder.tabs || []).slice(0, 8)) {
      const title = String(tab.label || "").trim();
      if (title) {
        parts.push(title);
      }
    }
    return parts.join(". ");
  }

  async function suggestIconByMeaning(folder) {
    const text = folderText(folder);
    if (!text) {
      return null;
    }
    const vectors = (await loadIconVectors()) || (await buildIconVectors());
    if (!vectors) {
      return null;
    }
    const embedded = await embedTexts([text]);
    if (!embedded) {
      return null;
    }
    const { name, score } = nearestIcon(embedded[0], vectors);
    console.info(`[Zia] Closest icon to "${text.slice(0, 60)}": ${name} (${score.toFixed(3)})`);

    return score >= 0.28 ? `${ICON_DIR}/${name}.svg` : null;
  }

  let nameEngine = null;
  let nameEngineTried = false;

  async function namingEngine() {
    if (nameEngineTried) {
      return nameEngine;
    }
    nameEngineTried = true;
    const { createEngine } = ChromeUtils.importESModule(
      "chrome://global/content/ml/EngineProcess.sys.mjs"
    );
    for (const options of [
      { taskName: "text2text-generation", featureId: "smart-tab-topic" },
      { taskName: "text2text-generation" },
    ]) {
      try {
        nameEngine = await createEngine(options);
        console.info(`[Zia] Naming engine: ${options.featureId || options.taskName}`);
        return nameEngine;
      } catch (err) {
        console.warn("[Zia] Naming engine not available:", options, err.message);
      }
    }
    return null;
  }

  function readGeneratedText(result) {
    if (!result) {
      return "";
    }
    if (typeof result === "string") {
      return result;
    }
    if (Array.isArray(result)) {
      return readGeneratedText(result[0]);
    }
    return result.generated_text || result.text || result.output || "";
  }

  function tidyName(raw, tabs) {
    let name = String(raw || "")
      .replace(/["'`]/g, "")
      .replace(/^(a|an|the)\s+/i, "")
      .split(/[\n.:;]/)[0]
      .trim();
    if (!name) {
      return null;
    }
    const words = name.split(/\s+/).slice(0, 3);
    name = words.join(" ");

    const echoed = tabs.some((tab) => String(tab.label || "").toLowerCase().startsWith(name.toLowerCase()));
    if (name.length < 3 || name.length > 28 || echoed) {
      return null;
    }
    return titleCase(name);
  }

  async function suggestNameByModel(folder) {
    const tabs = (folder.tabs || []).slice(0, 8);
    if (tabs.length < 2) {
      return null;
    }
    const engine = await namingEngine();
    if (!engine) {
      return null;
    }
    const titles = tabs.map((tab) => `- ${String(tab.label || "").slice(0, 80)}`).join("\n");
    const prompt = `Give a short two word label for this group of browser tabs:\n${titles}\nLabel:`;
    const result = await engine.run({ args: [prompt], options: { max_new_tokens: 8 } });
    const name = tidyName(readGeneratedText(result), tabs);
    console.info(`[Zia] Suggested name: ${name || "(nothing usable)"}`);
    return name;
  }

  function findNameEditor(folder) {
    const roots = [folder.labelElement, folder.labelElement?.shadowRoot, folder, folder.shadowRoot];
    for (const root of roots) {
      const editor = root?.querySelector?.("input, textarea, [contenteditable='true']");
      if (editor) {
        return editor;
      }
    }
    const active = folder.ownerDocument.activeElement;
    return folder.contains(active) || folder.labelElement?.contains?.(active) ? active : null;
  }

  function renameFolder(folder, name) {
    const label = folder.labelElement;

    const editor = findNameEditor(folder);
    if (editor) {
      if ("value" in editor) {
        editor.value = name;
      } else {
        editor.textContent = name;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      for (const type of ["keydown", "keypress", "keyup"]) {
        editor.dispatchEvent(
          new KeyboardEvent(type, { key: "Enter", keyCode: 13, bubbles: true })
        );
      }
      editor.blur?.();
    }

    if (typeof label?.onRenameFinished === "function") {
      label.onRenameFinished(name);
    } else {
      folder.name = name;
      folder.dispatchEvent(new CustomEvent("ZenFolderRenamed", { bubbles: true }));
    }

    for (const method of ["finishRename", "stopRename", "stopEditing", "blur"]) {
      try {
        label?.[method]?.();
      } catch (err) {
      }
    }
    label?.removeAttribute?.("editing");
    folder.removeAttribute("editing");
    folder.ownerDocument.activeElement?.blur?.();
    console.info(`[Zia] Renamed the folder to "${name}"${editor ? " (field was open)" : ""}.`);
  }

  function showFolderSkeleton(folder) {
    try {
      const container = folder.querySelector(".tab-group-label-container") || folder;
      if (container.querySelector(".zia-skeleton-overlay")) {
        return;
      }
      const doc = folder.ownerDocument;
      const containerRect = container.getBoundingClientRect();
      const iconEl = folder.querySelector(".tab-group-folder-icon");
      const iconRect = iconEl?.getBoundingClientRect();

      const label = folder.labelElement;
      const fontSize = parseFloat(getComputedStyle(label || container).fontSize) || 13;
      const size = Math.max(9, Math.round(fontSize * 0.85));

      const iconCentre = iconRect?.width
        ? iconRect.left - containerRect.left + iconRect.width / 2
        : 16;
      const iconLeft = Math.round(iconCentre - size / 2);

      const labelRect = label?.getBoundingClientRect();
      const textLeft = Math.round(
        labelRect?.width
          ? labelRect.left - containerRect.left
          : (iconRect?.right || 0) - containerRect.left + 8
      );

      const overlay = doc.createElement("div");
      overlay.className = "zia-skeleton-overlay";
      overlay.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;`;

      const block = (left, width, height, radius) => {
        const el = doc.createElement("div");
        el.className = "zia-skeleton-block";
        el.style.cssText =
          `position:absolute;left:${left}px;top:50%;transform:translateY(-50%);` +
          `width:${width}px;height:${height}px;border-radius:${radius}px;`;
        return el;
      };

      overlay.appendChild(block(iconLeft, size, size, Math.round(size / 3.5)));
      overlay.appendChild(block(textLeft, 88, size, Math.round(size / 3.5)));

      if (getComputedStyle(container).position === "static") {
        container.style.position = "relative";
      }
      container.setAttribute("zia-skeleton-on", "true");
      container.appendChild(overlay);
    } catch (err) {
      console.warn("[Zia] Couldn't show the folder placeholder:", err);
    }
  }

  function hideFolderSkeleton(folder) {
    const container = folder.querySelector(".tab-group-label-container") || folder;
    container.querySelector(".zia-skeleton-overlay")?.remove();
    container.removeAttribute("zia-skeleton-on");
    container.style.removeProperty("position");
  }
  const isDefaultName = (name) => !name || DEFAULT_FOLDER_NAMES.test(name);

  function currentFolderName(folder) {
    const editor = findNameEditor(folder);
    const name = editor ? ("value" in editor ? editor.value : editor.textContent) : folder.name;
    return (name || "").trim();
  }

  function folderIconURL(folder) {
    if (folder.localName === "zen-folder") {
      return folder.iconURL;
    }
    const icon = folder.querySelector(":scope > .tab-group-label-container .tab-group-icon > :is(.group-icon, label)");
    if (icon) {
      return icon.localName === "label" ? icon.textContent : icon.getAttribute("src");
    }
    return window.advancedTabGroups?.savedIcons?.[folder.id] || "";
  }

  function setFolderIcon(folder, icon) {
    if (folder.localName === "zen-folder") {
      window.gZenFolders?.setFolderUserIcon(folder, icon);
    } else {
      window.advancedTabGroups?.applyGroupIcon(folder, icon);
    }
  }

  function applySuggestedFolderIcon(folder) {
    if (!featureOn("folder-icon-suggest")) {
      return;
    }
    if (!isFolder(folder) || folderIconURL(folder)) {
      return;
    }

    folder.setAttribute("zia-suggesting", "true");
    showFolderSkeleton(folder);
    setTimeout(async () => {
      try {
        if (!folder.isConnected) {
          return;
        }
        if (!folderIconURL(folder)) {
          let icon = null;
          try {
            icon = await suggestIconByMeaning(folder);
          } catch (err) {
            console.warn("[Zia] The embedding model wasn't available:", err);
          }
          icon = icon || suggestFolderIcon(folder);
          if (icon && !folderIconURL(folder)) {
            setFolderIcon(folder, icon);
            folder.dispatchEvent(new CustomEvent("TabGroupUpdate", { bubbles: true }));
          }
        }
        if (isDefaultName(currentFolderName(folder))) {
          let name = null;
          try {
            name = await suggestNameByModel(folder);
          } catch (err) {
            console.warn("[Zia] Couldn't name the folder with the model:", err);
          }
          name = name || suggestFolderName(folder);
          if (name && isDefaultName(currentFolderName(folder))) {
            renameFolder(folder, name);
          }
        }
      } catch (err) {
        console.error("[Zia] Could not suggest a folder icon or name:", err);
      } finally {
        folder.removeAttribute("zia-suggesting");
        hideFolderSkeleton(folder);
      }
    }, 600);
  }

  function watchNewFolders() {
    gBrowser.tabContainer.addEventListener("TabGroupCreate", (event) => {
      requestAnimationFrame(() => requestAnimationFrame(() => applySuggestedFolderIcon(event.target)));
    });
  }

  const FOLDER_DEFAULT_COLOR = "white";

  const FOLDER_COLORS = [
    ["white", "#fbfbfb"],
    ["green", "#008b5d"],
    ["blue", "#007fbd"],
    ["purple", "#625da5"],
    ["amber", "#c98400"],
    ["pink", "#bd556b"],
    ["red", "#cc4a55"],
    ["orange", "#c95125"],
  ];

  const FOLDER_COLOR_PREF = "zia.folder-colors";

  function readFolderColors() {
    try {
      return JSON.parse(Services.prefs.getStringPref(FOLDER_COLOR_PREF, "{}")) || {};
    } catch (err) {
      return {};
    }
  }

  function writeFolderColors(map) {
    try {
      Services.prefs.setStringPref(FOLDER_COLOR_PREF, JSON.stringify(map));
    } catch (err) {
      console.error("[Zia] Could not save the folder colours:", err);
    }
  }

  function folderColorOf(value) {
    if (!value) {
      return null;
    }
    if (typeof value === "string") {
      return value;
    }
    return value.color || null;
  }

  function paintFolder(folder, value) {
    if (!folder) {
      return;
    }
    const color = folderColorOf(value);
    if (color) {
      folder.setAttribute("zia-folder-color", color);
    } else {
      folder.removeAttribute("zia-folder-color");
    }
  }

  function setFolderColor(folder, color) {
    if (!folder?.id) {
      return;
    }
    const map = readFolderColors();
    if (color) {
      map[folder.id] = color;
    } else {
      delete map[folder.id];
    }
    writeFolderColors(map);
    paintFolder(folder, color);
  }

  function restoreFolderColors() {
    const map = readFolderColors();
    for (const folder of document.querySelectorAll("zen-folder")) {
      if (map[folder.id]) {
        paintFolder(folder, map[folder.id]);
      }
    }
  }

  function folderFromNode(node) {
    if (!node) {
      return null;
    }
    if (gBrowser.isTabGroupLabel?.(node)) {
      return node.group;
    }
    if (gBrowser.isTabGroupLabel?.(node.parentElement)) {
      return node.parentElement.group;
    }
    if (node.parentElement?.isZenFolder && node.classList?.contains("tab-group-label-container")) {
      return node.parentElement;
    }
    return node.closest?.("zen-folder") || null;
  }

  function colorDotIcon(hex) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="7" fill="${hex}"/></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  function buildFolderColorMenu() {
    const submenu = document.createXULElement("menu");
    submenu.id = "zia-folder-color-menu";
    submenu.setAttribute("label", "Folder Color");
    const popup = document.createXULElement("menupopup");
    for (const [name, hex] of FOLDER_COLORS) {
      const item = document.createXULElement("menuitem");
      item.className = "menuitem-iconic";
      item.setAttribute("type", "radio");
      item.setAttribute("name", "zia-folder-color");
      item.setAttribute("label", name[0].toUpperCase() + name.slice(1));
      item.setAttribute("image", colorDotIcon(hex));
      item.setAttribute("zia-color", name);
      item.addEventListener("command", () => {
        const folder = submenu.ziaFolder;

        const same = folder?.getAttribute("zia-folder-color") === name;
        const clear = name === FOLDER_DEFAULT_COLOR || same;
        setFolderColor(folder, clear ? null : name);
      });
      popup.appendChild(item);
    }
    submenu.appendChild(popup);
    return submenu;
  }

  function addFolderColorPicker() {
    let submenu = null;

    document.addEventListener(
      "popupshowing",
      (event) => {
        const menu = event.target;
        if (menu?.id !== "zenFolderActions") {
          return;
        }

        const trigger = menu.triggerNode || event.explicitOriginalTarget;
        const folder = folderFromNode(trigger);
        if (!folder?.isZenFolder) {
          if (submenu) {
            submenu.hidden = true;
          }
          return;
        }

        if (!submenu) {
          submenu = buildFolderColorMenu();

          const rename = document.getElementById("context_zenFolderRename");
          if (rename?.parentElement === menu) {
            menu.insertBefore(submenu, rename);
          } else {
            menu.appendChild(submenu);
          }
        }

        submenu.hidden = false;
        submenu.ziaFolder = folder;

        const current = folder.getAttribute("zia-folder-color") || FOLDER_DEFAULT_COLOR;
        for (const item of submenu.querySelector("menupopup").children) {
          item.toggleAttribute("checked", item.getAttribute("zia-color") === current);
        }
      },
      true
    );
  }

  function watchFolderColors() {
    restoreFolderColors();

    setTimeout(restoreFolderColors, 1500);
    gBrowser.tabContainer.addEventListener("TabGroupCreate", (event) => {
      const saved = readFolderColors()[event.target?.id];
      if (saved) {
        paintFolder(event.target, saved);
      }
    });
  }

  function addFolderCloseButton(folder) {
    if (!folder?.isZenFolder) {
      return;
    }
    const header = folder.querySelector(":scope > .tab-group-label-container");
    if (!header || header.querySelector(":scope > .zia-folder-close")) {
      return;
    }
    const button = document.createXULElement("image");
    button.className = "zia-folder-close";
    button.setAttribute("role", "button");
    button.setAttribute("keyNav", "false");
    button.setAttribute("tooltiptext", "Delete Folder");

    button.addEventListener("mousedown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.stopPropagation();
      event.preventDefault();

      const removal =
        typeof folder.delete === "function"
          ? folder.delete()
          : gBrowser.removeTabGroup(folder, { isUserTriggered: true });
      Promise.resolve(removal).catch((err) => console.error("[Zia] Couldn't delete the folder:", err));
    });

    header.appendChild(button);
  }

  function watchFolderCloseButtons() {
    const addAll = () => {
      for (const folder of document.querySelectorAll("zen-folder")) {
        addFolderCloseButton(folder);
      }
    };
    addAll();

    setTimeout(addAll, 1500);
    gBrowser.tabContainer.addEventListener("TabGroupCreate", (event) => addFolderCloseButton(event.target));
  }

  function resolveColor(text) {
    if (!text) {
      return null;
    }
    let probe = document.getElementById("zia-color-probe");
    if (!probe) {
      probe = document.createElementNS(XHTML_NS, "div");
      probe.id = "zia-color-probe";
      probe.hidden = true;
      root.appendChild(probe);
    }
    probe.style.color = "";
    probe.style.color = text.trim();
    if (!probe.style.color) {
      return null;
    }
    return parseColor(getComputedStyle(probe).color);
  }

  const COLOR_TOKEN = /(?:rgba?|hsla?|color-mix|light-dark|oklch|oklab|lab|lch|color)\((?:[^()]|\([^()]*\))*\)|#[0-9a-fA-F]{3,8}\b|\btransparent\b/g;

  function paintColor(value) {
    if (!/gradient\(/.test(value)) {
      return resolveColor(value);
    }
    const stops = (value.match(COLOR_TOKEN) || []).map(resolveColor).filter(Boolean);
    if (!stops.length) {
      return null;
    }
    return [0, 1, 2, 3].map((i) => Math.round(stops.reduce((sum, c) => sum + c[i], 0) / stops.length));
  }

  function syncSidebarPaint() {
    const compact = root.getAttribute("zen-compact-mode") === "true";
    const layer = document.getElementById(compact ? "zen-toolbar-background" : "zen-browser-background");
    if (!layer) {
      return;
    }
    const name = compact ? "--zen-main-browser-background-toolbar" : "--zen-main-browser-background";
    const paint = paintColor(getComputedStyle(layer).getPropertyValue(name));
    const rootStyle = getComputedStyle(root);
    const tint = resolveColor(rootStyle.getPropertyValue("--zia-media-bg"));
    const base = resolveColor(rootStyle.getPropertyValue("--zia-media-card-base"));
    if (!paint || !tint || !base) {
      root.style.removeProperty("--zia-media-rest");
      root.style.removeProperty("--zia-media-solid");
      return;
    }

    root.style.setProperty("--zia-media-rest", cssColor(colorOver(tint, paint)));

    root.style.setProperty("--zia-media-solid", cssColor(colorOver(tint, colorOver(paint, base))));
  }

  function watchSidebarPaint() {
    syncSidebarPaint();
    const watcher = new MutationObserver(syncSidebarPaint);
    for (const id of ["zen-browser-background", "zen-toolbar-background"]) {
      const layer = document.getElementById(id);
      if (layer) {
        watcher.observe(layer, { attributes: true, attributeFilter: ["style"] });
      }
    }
    watcher.observe(root, { attributes: true, attributeFilter: ["zen-compact-mode"] });
  }

  function keepWindowButtonsInSidebar() {
    const manager = window.gZenVerticalTabsManager;
    if (!manager || manager.isWindowsStyledButtons) {
      return;
    }
    const wanted =
      root.getAttribute("zen-right-side") === "true" &&
      root.getAttribute("zen-compact-mode") !== "true" &&
      root.hasAttribute("zen-sidebar-expanded");
    if (!wanted) {
      return;
    }
    const buttons = manager.actualWindowButtons;
    const topButtons = document.getElementById("zen-sidebar-top-buttons");
    if (buttons && topButtons && buttons.parentNode !== topButtons) {
      topButtons.prepend(buttons);
    }
  }

  function watchWindowButtonsSide() {
    const soon = () => setTimeout(keepWindowButtonsInSidebar, 0);
    soon();
    setTimeout(keepWindowButtonsInSidebar, 1000);
    const watcher = new MutationObserver(soon);
    watcher.observe(root, {
      attributes: true,
      attributeFilter: ["zen-right-side", "zen-compact-mode", "zen-sidebar-expanded", "zen-single-toolbar"],
    });
    const navBar = document.getElementById("nav-bar");
    if (navBar) {
      watcher.observe(navBar, { childList: true });
    }
  }

  function safely(name, fn) {
    try {
      fn();
    } catch (err) {
      console.error(`[Zia] ${name} failed:`, err);
    }
  }

  function start() {
    const urlbar = gURLBar.textbox || document.getElementById("urlbar");

    safely("applyZenDefaults", applyZenDefaults);
    safely("watchNewTabPage", watchNewTabPage);
    safely("createWorkspaceSlot", createWorkspaceSlot);
    safely("watchTabAnimations", watchTabAnimations);
    safely("addFolderBounce", addFolderBounce);
    safely("allowEmojiFolderIcons", allowEmojiFolderIcons);
    safely("hideWwwInUrlbar", hideWwwInUrlbar);
    safely("watchRightEdges", watchRightEdges);
    ifOn("media-player", "watchMediaGlow", watchMediaGlow);
    safely("watchTabSoundBars", watchTabSoundBars);
    safely("watchSplitDrop", watchSplitDrop);
    safely("watchSplitPanes", watchSplitPanes);
    ifOn("find-bar", "watchFindBars", watchFindBars);
    safely("watchSpaceColor", watchSpaceColor);
    safely("animateEssentialsAdds", animateEssentialsAdds);
    ifOn("undo-close", "watchUndoClose", watchUndoClose);
    safely("watchTypedAddress", watchTypedAddress);
    safely("registerScrollActor", registerScrollActor);
    safely("watchScrollInput", watchScrollInput);
    safely("createTitleElement", createTitleElement);
    safely("addDownloadProgress", addDownloadProgress);
    ifOn("icon-picker", "addIconPicker", addIconPicker);
    safely("watchCompactTopRow", watchCompactTopRow);
    safely("watchNewFolders", watchNewFolders);
    safely("watchFolderColors", watchFolderColors);
    safely("addFolderColorPicker", addFolderColorPicker);
    safely("watchFolderCloseButtons", watchFolderCloseButtons);
    safely("watchSidebarPaint", watchSidebarPaint);
    safely("watchWindowButtonsSide", watchWindowButtonsSide);

    gBrowser.tabContainer.addEventListener("TabSelect", () => {
      const browser = gBrowser.selectedBrowser;
      if (isLoading(browser) && !isErrorPage(browser)) {
        startLoader(0.25,  true);
      } else {
        cancelLoader();
      }
      snapColorForTab(browser);
      scheduleColor(60);
      scheduleColor(400);
      updateTitle();
    });

    gBrowser.tabContainer.addEventListener("TabAttrModified", (event) => {
      if (event.target === gBrowser.selectedTab) {
        updateTitle();
      }
    });

    const { STATE_START, STATE_STOP, STATE_IS_WINDOW } = Ci.nsIWebProgressListener;
    const { LOCATION_CHANGE_SAME_DOCUMENT, LOCATION_CHANGE_ERROR_PAGE } = Ci.nsIWebProgressListener;

    gBrowser.addTabsProgressListener({
      onStateChange(browser, webProgress, request, stateFlags) {
        if (!webProgress.isTopLevel || !(stateFlags & STATE_IS_WINDOW)) {
          return;
        }
        if (browser !== gBrowser.selectedBrowser) {
          return;
        }
        if (stateFlags & STATE_START) {
          scrollPositions.delete(browser);
          startLoader();

          colorRequestId++;
        } else if (stateFlags & STATE_STOP) {
          if (isErrorPage(browser)) {
            cancelLoader();
            showErrorColor();
          } else {
            finishLoader();
            scheduleColor(50);
            scheduleColor(800);
            scheduleColor(2000);
            scheduleColor(4500);
          }
          updateTitle();
        }
      },

      onProgressChange(browser, webProgress, request, curSelf, maxSelf, curTotal, maxTotal) {
        if (browser === gBrowser.selectedBrowser && maxTotal > 0) {
          reportRealProgress(curTotal / maxTotal);
        }
      },

      onLocationChange(browser, webProgress, request, location, flags) {
        if (!webProgress.isTopLevel) {
          return;
        }
        redirectBlankNewTab(browser, location, flags);

        if (flags & LOCATION_CHANGE_ERROR_PAGE) {
          errorBrowsers.add(browser);
        } else if (!(flags & LOCATION_CHANGE_SAME_DOCUMENT)) {
          errorBrowsers.delete(browser);
          scrollPositions.delete(browser);
        }
        if (browser !== gBrowser.selectedBrowser) {
          return;
        }
        if (flags & LOCATION_CHANGE_ERROR_PAGE) {
          cancelLoader();
          showErrorColor();
        } else if (flags & LOCATION_CHANGE_SAME_DOCUMENT) {
          scheduleColor(150);
        } else {
          const known = rememberedSiteColor(browser);
          if (known) {
            applyColor(known);
          }
        }
        updateTitle();
      },
    });

    new MutationObserver(updateTitle).observe(urlbar, {
      attributes: true,
      attributeFilter: ["pageproxystate"],
    });

    urlbar.addEventListener("mouseenter", rememberClosedText);
    urlbar.addEventListener(
      "mousedown",
      () => {
        rememberClosedText();
        clickedUrlbarAt = Date.now();
      },
      true
    );
    gBrowser.tabContainer.addEventListener("TabSelect", () => requestAnimationFrame(rememberClosedText));
    window.addEventListener("resize", () => requestAnimationFrame(rememberClosedText));
    setTimeout(rememberClosedText, 800);
    new MutationObserver(alignOpenedUrlbarSoon).observe(urlbar, {
      attributes: true,
      attributeFilter: ["breakout-extend"],
    });
    window.addEventListener("resize", alignOpenedUrlbarSoon);

    safely("keepWholeUrlSelected", () => keepWholeUrlSelected(urlbar));

    updateColor();
    updateTitle();
  }

  if (window.gBrowserInit?.delayedStartupFinished) {
    start();
  } else {
    const observer = (subject) => {
      if (subject === window) {
        Services.obs.removeObserver(observer, "browser-delayed-startup-finished");
        start();
      }
    };
    Services.obs.addObserver(observer, "browser-delayed-startup-finished");
  }
})();
