

const THROTTLE_MS = 50;
const SETTLE_MS = 80;

export class ZiaChild extends JSWindowActorChild {
  #lastSent = 0;
  #trailingTimer = null;

  handleEvent(event) {
    switch (event.type) {
      case "scroll":
        this.#onScroll();
        break;
      case "DOMContentLoaded":
        this.#maybeDiaPdf();
        this.#onPageShown();
        break;
      case "pageshow":
        this.#onPageShown();
        break;
    }
  }

  // Firefox's PDF viewer (a PDF.js page) gets Dia's look, unless it's
  // switched off in Zia's settings.
  #maybeDiaPdf() {
    const doc = this.document;
    const win = this.contentWindow;
    if (!doc || !win) {
      return;
    }
    // Firefox's own viewer: its page runs from resource://pdf.js, which a
    // website's copy of PDF.js can't.
    let isViewer = false;
    try {
      isViewer =
        !!doc.getElementById("outerContainer") &&
        !!doc.getElementById("toolbarViewer") &&
        ((doc.nodePrincipal?.spec || "").startsWith("resource://pdf.js") ||
          !!doc.querySelector('script[src^="resource://pdf.js/"]'));
    } catch (err) {
      isViewer = false;
    }
    if (!isViewer || !Services.prefs.getBoolPref("zia.pdf.dia-style", true)) {
      return;
    }
    try {
      ChromeUtils.importESModule("chrome://sine/content/zia/actors/ZiaPdf.sys.mjs").diaPdf(win);
    } catch (err) {
      console.error("[Zia] PDF view:", err);
    }
  }

  #onScroll() {
    const now = Date.now();
    if (now - this.#lastSent >= THROTTLE_MS) {
      this.#sendScroll(now);
    }
    this.contentWindow?.clearTimeout(this.#trailingTimer);
    this.#trailingTimer = this.contentWindow?.setTimeout(() => this.#sendScroll(Date.now()), SETTLE_MS);
  }

  #sendScroll(now) {
    this.#lastSent = now;
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    try {
      this.sendAsyncMessage("Zia:Scrolled", { x: win.scrollX, y: win.scrollY });
    } catch (err) {
    }
  }

  #onPageShown() {
    const win = this.contentWindow;
    if (!win) {
      return;
    }
    win.requestAnimationFrame(() =>
      win.requestAnimationFrame(() => {
        try {
          this.sendAsyncMessage("Zia:Painted", {});
        } catch (err) {
        }
      })
    );
  }

  didDestroy() {
    this.contentWindow?.clearTimeout(this.#trailingTimer);
  }
}
