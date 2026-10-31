import { getDomain, findWhitelistMatch } from "../shared/domain.js";

export function createBadges(chromeApi, storage) {
  const latest = new Map();
  let sequence = 0;
  function begin(tabId) {
    const token = ++sequence;
    if (Number.isInteger(tabId)) latest.set(tabId, token);
    return token;
  }
  async function current(tabId, token, domain) {
    if (latest.get(tabId) !== token) return false;
    const tab = await chromeApi.tabs.get(tabId);
    return latest.get(tabId) === token && getDomain(tab.url) === domain;
  }
  async function show(tabId, result, token) {
    if (!Number.isInteger(tabId) || !result.domain) return;
    try {
      if (!(await current(tabId, token, result.domain))) return;
      const mapping = {
        safe: ["OK", "#0f9d58"],
        warning: ["WRN", "#d93025"],
        error: ["ERR", "#808080"],
        whitelisted: ["WHT", "#1a73e8"],
      };
      const [text, color] = mapping[result.verdict];
      await chromeApi.action.setBadgeBackgroundColor({ tabId, color });
      if (!(await current(tabId, token, result.domain))) return;
      await chromeApi.action.setBadgeText({ tabId, text });
      if (!(await current(tabId, token, result.domain))) return;
      await chromeApi.action.setTitle({
        tabId,
        title: `ScamShop Detector: ${result.message}`,
      });
    } catch {
      /* Tab closed or navigated. */
    }
  }
  async function navigate(tabId, url) {
    const token = begin(tabId);
    try {
      const domain = getDomain(url);
      const entry = findWhitelistMatch(
        domain,
        (await storage.state()).whitelist,
      );
      if (entry) {
        await show(
          tabId,
          {
            domain,
            verdict: "whitelisted",
            message: "Domena je na popisu dozvoljenih.",
          },
          token,
        );
      } else if (latest.get(tabId) === token) {
        const tab = await chromeApi.tabs.get(tabId);
        if (latest.get(tabId) !== token || getDomain(tab.url) !== domain)
          return;
        await chromeApi.action.setBadgeText({ tabId, text: "" });
        if (latest.get(tabId) === token)
          await chromeApi.action.setTitle({
            tabId,
            title: "ScamShop Detector: Kliknite za provjeru domene",
          });
      }
    } catch {
      /* Tab closed or storage unavailable. */
    }
  }
  async function activate(tabId, url) {
    try {
      const domain = getDomain(url);
      if (!findWhitelistMatch(domain, (await storage.state()).whitelist))
        return;
      const tab = await chromeApi.tabs.get(tabId);
      if (getDomain(tab.url) !== domain) return;
      const token = begin(tabId);
      await show(
        tabId,
        {
          domain,
          verdict: "whitelisted",
          message: "Domena je na popisu dozvoljenih.",
        },
        token,
      );
    } catch {
      /* Tab closed or storage unavailable. */
    }
  }
  return {
    begin,
    show,
    navigate,
    activate,
    remove: (tabId) => latest.delete(tabId),
  };
}
