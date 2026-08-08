const MESSAGE_TYPE = "PROJECT1337_IAFD_PAGE";
const CHALLENGE_MARKERS = [
  "just a moment",
  "checking your browser",
  "verify you are human",
  "attention required",
  "performing security verification",
  "verification successful",
  "enable javascript and cookies to continue",
];

let deliveredSignature = "";
let attempts = 0;

function supportedPage() {
  return (
    /^\/results\.asp$/i.test(location.pathname) ||
    /^\/title\.rme(?:\/|$)/i.test(location.pathname) ||
    /^\/person\.rme(?:\/|$)/i.test(location.pathname)
  );
}

function challengeVisible() {
  const text = `${document.title || ""} ${document.body?.innerText || ""}`
    .toLowerCase()
    .slice(0, 32000);
  return (
    CHALLENGE_MARKERS.some((marker) => text.includes(marker)) ||
    Boolean(
      document.querySelector(
        'iframe[src*="challenges.cloudflare.com"]'
      )
    )
  );
}

function pageHasUsefulContent() {
  if (/^\/title\.rme/i.test(location.pathname)) {
    return Boolean(document.querySelector("h1"));
  }
  if (/^\/person\.rme/i.test(location.pathname)) {
    return Boolean(document.querySelector("h1, .bioheading, a[href*='title.rme']"));
  }
  return (
    Boolean(document.querySelector('a[href*="title.rme"]')) ||
    attempts >= 4
  );
}

function sanitizedPageHtml() {
  const clone = document.documentElement.cloneNode(true);
  clone
    .querySelectorAll(
      "script, style, noscript, iframe, canvas, svg, video, audio, source, picture"
    )
    .forEach((element) => element.remove());
  clone
    .querySelectorAll('link:not([rel="canonical"])')
    .forEach((element) => element.remove());
  clone.querySelectorAll("img").forEach((element) => {
    element.removeAttribute("src");
    element.removeAttribute("srcset");
    element.removeAttribute("sizes");
  });
  clone.querySelectorAll("*").forEach((element) => {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "nonce" || name === "integrity") {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return `<!doctype html>\n${clone.outerHTML}`;
}

async function deliverPage() {
  attempts += 1;
  if (
    !supportedPage() ||
    document.readyState === "loading" ||
    challengeVisible() ||
    !pageHasUsefulContent()
  ) {
    return;
  }

  const signature = `${location.href}|${document.body?.innerText?.length || 0}`;
  if (signature === deliveredSignature) return;

  const html = sanitizedPageHtml();
  if (!html || html.length > 4_000_000) return;
  deliveredSignature = signature;

  try {
    const response = await chrome.runtime.sendMessage({
      type: MESSAGE_TYPE,
      page_url: location.href,
      page_title: document.title,
      html,
    });
    if (!response?.ok) deliveredSignature = "";
  } catch {
    deliveredSignature = "";
  }
}

deliverPage();
const deliveryTimer = window.setInterval(() => {
  deliverPage();
  if (deliveredSignature || attempts >= 120) window.clearInterval(deliveryTimer);
}, 1000);
