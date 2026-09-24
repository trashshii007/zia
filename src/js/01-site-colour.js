  const STRIP_HEIGHT = 8;
  const STRIP_SCALE = 0.5;
  const FULL_VIEW_SCALE = 0.125;
  const SCROLL_SAMPLE_INTERVAL = 50;
  const scrollPositions = new WeakMap();
  const LIGHT_THRESHOLD = 150;
  const INK_MAX = 90;
  const ERROR_PAGE_COLOR = [0, 0, 0];
  const ERROR_PAGES = /^about:(neterror|certerror|httpsonlyerror|blocked|tabcrashed)/;
  const errorBrowsers = new WeakSet();
  const colorCache = new WeakMap();
  let colorRequestId = 0;

  const MIN_COLOR_SHARE = 0.6;
  const SAME_COLOR_DISTANCE = 10;
  let pendingColor = null;

  let appliedColorKey = null;

  // Off leaves the toolbar in the theme's own colour instead of the site's.
  const siteColorOn = () => Services.prefs.getBoolPref("zia.toolbar.site-color", true);

  function applyColor(rgb) {
    if (!siteColorOn()) {
      rgb = null;
    }
    const key = rgb ? rgb.join(",") : "fallback";
    if (key === appliedColorKey) {
      return;
    }
    appliedColorKey = key;
    if (!rgb) {
      root.style.removeProperty("--zia-site-bg");
      setFlag("zia-site-light", false);
      setFlag("zia-site-dark", true);

      const fallback = fallbackColor();
      updateDarkSiteInk(fallback, brightnessOf(fallback),  true);
      return;
    }
    root.style.setProperty("--zia-site-bg", cssColor(rgb));
    const brightness = brightnessOf(rgb);
    setFlag("zia-site-light", brightness > LIGHT_THRESHOLD);
    setFlag("zia-site-dark", brightness < INK_MAX);
    updateDarkSiteInk(rgb, brightness);
  }

  function updateDarkSiteInk(rgb, brightness, inkOnly = false) {
    if (!rgb || brightness >= INK_MAX) {
      root.style.removeProperty("--zia-dark-ink");
      root.style.removeProperty("--zia-urlbar-hover-bg");
      return;
    }
    const base = rgb.slice(0, 3);
    const t = brightness <= 1 ? 0 : Math.min(1, (brightness - 1) / 46);
    const level = brightness <= 1 ? 251 : Math.round(150 + t * 26);
    root.style.setProperty("--zia-dark-ink", `rgb(${level}, ${level}, ${level})`);
    if (inkOnly) {
      root.style.removeProperty("--zia-urlbar-hover-bg");
      return;
    }
    const hover =

      brightness >= 10 ? base.map((c) => Math.round(c * 0.45)) : base.map((c) => Math.round(c + (255 - c) * 0.1));
    root.style.setProperty("--zia-urlbar-hover-bg", `rgb(${hover.join(", ")})`);
  }

  function fallbackColor() {
    const text = getComputedStyle(root).getPropertyValue("--zia-fallback-bg").trim();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
    if (hex) {
      const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
      return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    }
    const parsed = parseColor(text);
    return parsed[3] ? parsed.slice(0, 3) : [18, 18, 18];
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
    if (!siteColorOn()) {
      applyColor(null);
      return;
    }

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

