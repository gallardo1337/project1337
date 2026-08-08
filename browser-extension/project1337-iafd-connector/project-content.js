const APP_SOURCE = "project1337-app";
const CONNECTOR_SOURCE = "project1337-iafd-connector";
const MESSAGE_TYPE = "PROJECT1337_IAFD_PAGE";

function announceReady() {
  window.postMessage(
    {
      source: CONNECTOR_SOURCE,
      type: "PROJECT1337_IAFD_CONNECTOR_READY",
      version: "1.0.0",
    },
    window.location.origin
  );
}

window.addEventListener("message", (event) => {
  if (
    event.source === window &&
    event.data?.source === APP_SOURCE &&
    event.data?.type === "PROJECT1337_IAFD_CONNECTOR_PING"
  ) {
    announceReady();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== MESSAGE_TYPE) return false;
  window.postMessage(
    {
      source: CONNECTOR_SOURCE,
      type: MESSAGE_TYPE,
      page_url: message.page_url,
      page_title: message.page_title,
      html: message.html,
    },
    window.location.origin
  );
  return false;
});

announceReady();
window.setTimeout(announceReady, 1000);
