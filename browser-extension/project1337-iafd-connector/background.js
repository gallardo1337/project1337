const MESSAGE_TYPE = "PROJECT1337_IAFD_PAGE";
const IAFD_HOSTS = new Set(["iafd.com", "www.iafd.com"]);
const IAFD_PATHS = [
  /^\/results\.asp$/i,
  /^\/title\.rme(?:\/|$)/i,
  /^\/person\.rme(?:\/|$)/i,
];
const MAX_HTML_CHARACTERS = 4_200_000;

function validIafdUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      url.protocol === "https:" &&
      IAFD_HOSTS.has(url.hostname.toLowerCase()) &&
      IAFD_PATHS.some((pattern) => pattern.test(url.pathname))
    );
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    message?.type !== MESSAGE_TYPE ||
    typeof message?.html !== "string" ||
    message.html.length > MAX_HTML_CHARACTERS ||
    !validIafdUrl(message?.page_url)
  ) {
    return false;
  }

  const openerTabId = sender.tab?.openerTabId;
  if (!Number.isInteger(openerTabId)) {
    sendResponse({ ok: false, error: "Project1337-Tab nicht gefunden." });
    return false;
  }

  chrome.tabs
    .sendMessage(openerTabId, {
      type: MESSAGE_TYPE,
      page_url: message.page_url,
      page_title: String(message.page_title || "").slice(0, 300),
      html: message.html,
    })
    .then(() => sendResponse({ ok: true }))
    .catch(() =>
      sendResponse({
        ok: false,
        error: "Der Project1337-Import-Assistent ist nicht geöffnet.",
      })
    );
  return true;
});
