import { chromium } from "playwright";
import { BridgeError } from "./errors.js";
import {
  isBlockedBrowserUrl,
  isIafdHostname,
  normalizeTargetUrl,
} from "./security.js";

const BLOCKED_RESOURCE_TYPES = new Set(["image", "media", "font"]);
const ALLOWED_DOCUMENT_HOSTS = new Set([
  "iafd.com",
  "www.iafd.com",
  "challenges.cloudflare.com",
]);

function allowedDocumentUrl(value) {
  try {
    return ALLOWED_DOCUMENT_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function challengeDetected(title, bodyText) {
  const sample = `${title || ""} ${bodyText || ""}`.toLowerCase().slice(0, 16000);
  return [
    "just a moment",
    "checking your browser",
    "verify you are human",
    "attention required",
    "performing security verification",
  ].some((marker) => sample.includes(marker));
}

export class IafdBrowser {
  constructor(config) {
    this.config = config;
    this.contextPromise = null;
    this.queue = Promise.resolve();
    this.cache = new Map();
  }

  stats() {
    return {
      browser_started: Boolean(this.contextPromise),
      cached_pages: this.cache.size,
    };
  }

  async close() {
    if (!this.contextPromise) return;
    try {
      const context = await this.contextPromise;
      await context.close();
    } finally {
      this.contextPromise = null;
    }
  }

  async fetchHtml(value) {
    const url = normalizeTargetUrl(value);
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, cached: true };
    }
    if (cached) this.cache.delete(url);

    const task = this.queue.then(() => this.#fetchUncached(url));
    this.queue = task.catch(() => undefined);
    const valueFromBrowser = await task;
    if (this.config.cacheTtlMs > 0) {
      this.cache.set(url, {
        expiresAt: Date.now() + this.config.cacheTtlMs,
        value: valueFromBrowser,
      });
      this.#pruneCache();
    }
    return { ...valueFromBrowser, cached: false };
  }

  #pruneCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(key);
    }
    while (this.cache.size > 100) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async #context() {
    if (!this.contextPromise) {
      this.contextPromise = chromium
        .launchPersistentContext(this.config.browserDataDir, {
          headless: this.config.headless,
          viewport: { width: 1440, height: 1000 },
          locale: "en-US",
          timezoneId: "Europe/Berlin",
          acceptDownloads: false,
          chromiumSandbox: false,
        })
        .then(async (context) => {
          context.setDefaultNavigationTimeout(this.config.navigationTimeoutMs);
          context.setDefaultTimeout(5000);
          await context.route("**/*", async (route) => {
            const request = route.request();
            const requestUrl = request.url();
            if (
              isBlockedBrowserUrl(requestUrl) ||
              (request.resourceType() === "document" && !allowedDocumentUrl(requestUrl)) ||
              BLOCKED_RESOURCE_TYPES.has(request.resourceType())
            ) {
              await route.abort("blockedbyclient").catch(() => undefined);
              return;
            }
            await route.continue().catch(() => undefined);
          });
          return context;
        })
        .catch((error) => {
          this.contextPromise = null;
          throw error;
        });
    }
    return this.contextPromise;
  }

  async #fetchUncached(url) {
    let page;
    try {
      const context = await this.#context();
      page = await context.newPage();
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.navigationTimeoutMs,
      });

      const status = response?.status() || 0;
      const waitUntil = Date.now() + this.config.challengeWaitMs;
      let title = "";
      let bodyText = "";
      let sawChallenge = false;
      do {
        title = await page.title().catch(() => "");
        bodyText = await page.locator("body").innerText({ timeout: 2500 }).catch(() => "");
        const challenged = challengeDetected(title, bodyText);
        sawChallenge ||= challenged;
        if (!challenged) break;
        await page.waitForTimeout(1000);
      } while (Date.now() < waitUntil);

      if (challengeDetected(title, bodyText)) {
        throw new BridgeError(
          "IAFD hat die Browserprüfung nicht freigegeben.",
          "IAFD_CHALLENGE",
          503
        );
      }
      if (status >= 400 && !sawChallenge) {
        throw new BridgeError(
          `IAFD antwortet mit HTTP ${status}.`,
          "UPSTREAM_HTTP",
          status === 429 ? 503 : 502
        );
      }

      const finalUrl = page.url();
      if (!isIafdHostname(finalUrl)) {
        throw new BridgeError(
          "IAFD hat auf eine unerwartete Adresse umgeleitet.",
          "UNEXPECTED_REDIRECT",
          502
        );
      }

      const html = await page.content();
      const bytes = Buffer.byteLength(html, "utf8");
      if (bytes > this.config.maxHtmlBytes) {
        throw new BridgeError(
          "Die IAFD-Seite ist unerwartet groß.",
          "HTML_TOO_LARGE",
          502
        );
      }
      if (!html || !/<html[\s>]/i.test(html)) {
        throw new BridgeError(
          "IAFD hat keine HTML-Seite geliefert.",
          "INVALID_UPSTREAM_RESPONSE",
          502
        );
      }

      return {
        html,
        final_url: finalUrl,
        upstream_status: sawChallenge ? 200 : status || 200,
      };
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (/timeout/i.test(String(error?.message || ""))) {
        throw new BridgeError(
          "IAFD hat nicht rechtzeitig geantwortet.",
          "NAVIGATION_TIMEOUT",
          504
        );
      }
      throw new BridgeError(
        "Der IAFD-Browser konnte die Seite nicht laden.",
        "BROWSER_UNAVAILABLE",
        503
      );
    } finally {
      await page?.close().catch(() => undefined);
    }
  }
}
