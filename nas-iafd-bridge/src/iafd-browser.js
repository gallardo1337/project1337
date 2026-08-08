import { chromium } from "playwright";
import { clearStaleChromiumProfileLocks } from "./chromium-profile.js";
import { BridgeError } from "./errors.js";
import {
  isBlockedBrowserUrl,
  isIafdHostname,
  normalizeTargetUrl,
} from "./security.js";

const BLOCKED_RESOURCE_TYPES = new Set(["media"]);
const CHALLENGE_HOST = "challenges.cloudflare.com";
const CLEARANCE_SETTLE_MS = 6000;

function isLocalBrowserDocument(value) {
  return (
    value === "about:blank" ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  );
}

function allowedDocumentUrl(value) {
  if (isLocalBrowserDocument(value)) return true;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "iafd.com" ||
      hostname === "www.iafd.com" ||
      hostname === CHALLENGE_HOST ||
      hostname.endsWith(`.${CHALLENGE_HOST}`)
    );
  } catch {
    return false;
  }
}

export function challengeDetected(title, bodyText) {
  const sample = `${title || ""} ${bodyText || ""}`.toLowerCase().slice(0, 32000);
  return [
    "just a moment",
    "checking your browser",
    "verify you are human",
    "attention required",
    "performing security verification",
    "verification successful",
    "enable javascript and cookies to continue",
  ].some((marker) => sample.includes(marker));
}

export function responseIsChallenge(response) {
  const value = response?.headers?.()?.["cf-mitigated"];
  return String(value || "").toLowerCase() === "challenge";
}

function challengeFrameDetected(page) {
  return page.frames().some((frame) => {
    try {
      const hostname = new URL(frame.url()).hostname.toLowerCase();
      return hostname === CHALLENGE_HOST || hostname.endsWith(`.${CHALLENGE_HOST}`);
    } catch {
      return false;
    }
  });
}

async function hasClearanceCookie(context) {
  const cookies = await context
    .cookies(["https://www.iafd.com", "https://iafd.com"])
    .catch(() => []);
  return cookies.some((cookie) => cookie.name === "cf_clearance");
}

async function readPageState(page, documentResponse) {
  const [title, bodyText] = await Promise.all([
    page.title().catch(() => ""),
    page.locator("body").innerText({ timeout: 2500 }).catch(() => ""),
  ]);
  const textChallenge = challengeDetected(title, bodyText);
  const frameChallenge = challengeFrameDetected(page);
  const headerChallenge = responseIsChallenge(documentResponse);
  return {
    title,
    bodyText,
    finalUrl: page.url(),
    textChallenge,
    frameChallenge,
    headerChallenge,
    challenged: textChallenge || frameChallenge || headerChallenge,
  };
}

function pageIsReady(state, documentResponse) {
  return (
    Boolean(documentResponse) &&
    !state.challenged &&
    isIafdHostname(state.finalUrl) &&
    state.bodyText.trim().length >= 80
  );
}

export class IafdBrowser {
  constructor(config) {
    this.config = config;
    clearStaleChromiumProfileLocks(this.config.browserDataDir);
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
      let documentResponse = null;
      const captureDocumentResponse = (response) => {
        if (
          response.request().resourceType() === "document" &&
          response.frame() === page.mainFrame()
        ) {
          documentResponse = response;
        }
      };
      page.on("response", captureDocumentResponse);

      const firstResponse = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.navigationTimeoutMs,
      });
      documentResponse ||= firstResponse;

      const challengeDeadline = Date.now() + this.config.challengeWaitMs;
      let sawChallenge = false;
      let state = await readPageState(page, documentResponse);

      while (!pageIsReady(state, documentResponse)) {
        sawChallenge ||= state.challenged;
        if (Date.now() >= challengeDeadline) break;
        await page.waitForTimeout(750);
        state = await readPageState(page, documentResponse);
      }

      sawChallenge ||= state.challenged;

      if (pageIsReady(state, documentResponse)) {
        // Cloudflare can inject JavaScript detection into the first real HTML
        // response. Keep the page alive briefly so the persistent profile can
        // receive cf_clearance before the tab is closed.
        const settleDeadline = Date.now() + CLEARANCE_SETTLE_MS;
        let clearanceCookie = await hasClearanceCookie(context);
        while (!clearanceCookie && Date.now() < settleDeadline) {
          await page.waitForTimeout(500);
          clearanceCookie = await hasClearanceCookie(context);
        }
        state = await readPageState(page, documentResponse);
      }

      if (state.challenged || !pageIsReady(state, documentResponse)) {
        const clearanceCookie = await hasClearanceCookie(context);
        throw new BridgeError(
          "IAFD hat die Browserprüfung nicht freigegeben.",
          "IAFD_CHALLENGE",
          503,
          {
            cf_mitigated: state.headerChallenge,
            challenge_text: state.textChallenge,
            challenge_frame: state.frameChallenge,
            clearance_cookie: clearanceCookie,
          }
        );
      }

      const status = documentResponse?.status() || 0;
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
        upstream_status: status || 200,
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
