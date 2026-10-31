import { createRuntime } from "./background/runtime.js";

const runtime = createRuntime(chrome);
const safely = (promise) => {
  promise.catch(() => console.warn("ScamShop Detector: EVENT_FAILED"));
};
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  runtime.command(message).then(sendResponse, () =>
    sendResponse({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Neočekivana pogreška." },
    }),
  );
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() =>
    chrome.contextMenus.create({
      id: "scamshop-check",
      title: "Provjeri domenu sa servisom CERT iffy",
      contexts: ["page", "link"],
    }),
  );
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  safely(runtime.contextMenu(info, tab));
});
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url || change.status === "loading")
    safely(runtime.navigate(tabId, change.url || tab.url));
});
chrome.tabs.onActivated.addListener((info) => {
  safely(
    chrome.tabs
      .get(info.tabId)
      .then((tab) => runtime.activate(info.tabId, tab.url)),
  );
});
chrome.tabs.onRemoved.addListener((tabId) => runtime.removeTab(tabId));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.whitelist) {
    safely(
      chrome.tabs
        .query({ active: true })
        .then((tabs) =>
          Promise.all(
            tabs
              .filter((tab) => tab.id != null)
              .map((tab) => runtime.navigate(tab.id, tab.url)),
          ),
        ),
    );
  }
});
