import {
  getDomain,
  normalizeDomain,
  normalizeUrl,
  findWhitelistMatch,
} from "../shared/domain.js";
import { createApi } from "./api.js";
import { createStorage } from "./storage.js";
import { createBadges } from "./badges.js";
export { adaptResponse } from "./api.js";

export function createRuntime(
  chromeApi,
  fetchFn = (...args) => globalThis.fetch(...args),
  now = Date.now,
  options = {},
) {
  const storage = createStorage(chromeApi, now);
  const api = createApi({
    fetchFn,
    requestTimeoutMs: options.requestTimeoutMs,
  });
  const badges = createBadges(chromeApi, storage);
  const inflight = new Map();
  const log =
    options.log || ((code) => console.warn(`ScamShop Detector: ${code}`));

  function invalid() {
    return {
      verdict: "error",
      status_code: 400,
      message: "Neispravna domena ili nepodržani protokol.",
      domain: "",
      url: "",
      checkedAt: now(),
      source: "validation",
      errorCode: "INVALID_URL",
    };
  }
  /** @returns {Promise<import('../shared/contracts.js').CheckResult>} */
  async function networkScan(domain) {
    let apiResult;
    try {
      apiResult = await api.check(domain);
    } catch (error) {
      const code = error.code || "NETWORK_ERROR";
      log(code);
      return {
        verdict: "error",
        status_code: error.status || 500,
        message:
          error.message || "Pogreška pri povezivanju sa servisom CERT iffy.",
        domain,
        url: domain,
        checkedAt: now(),
        source: "network",
        errorCode: code,
      };
    }
    const result = {
      ...apiResult,
      domain,
      url: domain,
      checkedAt: now(),
      source: "network",
    };
    const failures = [];
    try {
      await storage.saveCache(domain, result);
    } catch {
      failures.push("CACHE_WRITE_FAILED");
    }
    try {
      await storage.record(result);
    } catch {
      failures.push("HISTORY_WRITE_FAILED");
    }
    if (failures.length) {
      failures.forEach(log);
      result.persistenceWarning = failures.join(",");
    }
    return result;
  }
  async function scan(input, force = false) {
    const domain = getDomain(input);
    if (!domain) return invalid();
    const state = await storage.state();
    const whitelistEntry = findWhitelistMatch(domain, state.whitelist);
    if (whitelistEntry)
      return {
        verdict: "whitelisted",
        status_code: 200,
        message: "Domena se nalazi na vašem popisu dozvoljenih.",
        domain,
        url: domain,
        checkedAt: now(),
        source: "whitelist",
        whitelistEntry,
      };
    if (!force) {
      try {
        const item = await storage.cached(domain);
        if (item) return { ...item, source: "cache" };
      } catch {
        log("CACHE_READ_FAILED");
      }
    }
    if (inflight.has(domain)) return inflight.get(domain);
    const promise = networkScan(domain);
    inflight.set(domain, promise);
    try {
      return await promise;
    } finally {
      inflight.delete(domain);
    }
  }
  async function check(message) {
    const token =
      message.updateBadge === true ? badges.begin(message.tabId) : null;
    const result = await scan(message.url, message.forceCheck === true);
    if (message.updateBadge === true)
      await badges.show(message.tabId, result, token);
    return result;
  }
  async function command(message) {
    try {
      if (message?.type === "CHECK_URL") return await check(message);
      if (message?.type === "GET_STATE")
        return { ok: true, state: await storage.state() };
      if (
        message?.type === "ADD_WHITELIST" ||
        message?.type === "REMOVE_WHITELIST"
      ) {
        const domain = normalizeDomain(message.domain);
        if (!domain)
          return {
            ok: false,
            error: { code: "INVALID_DOMAIN", message: "Neispravna domena." },
          };
        const state = await storage.mutate((value) => {
          value.whitelist = value.whitelist.filter(
            (item) => normalizeDomain(item) !== domain,
          );
          if (message.type === "ADD_WHITELIST") value.whitelist.push(domain);
        });
        return { ok: true, state };
      }
      if (message?.type === "DELETE_HISTORY") {
        if (typeof message.id !== "string" || !message.id)
          return {
            ok: false,
            error: {
              code: "INVALID_ID",
              message: "Neispravna stavka povijesti.",
            },
          };
        const deleted = await storage.deleteHistory(message.id);
        return { ok: true, ...deleted };
      }
      if (message?.type === "RESTORE_HISTORY") {
        if (
          typeof message.undoToken !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(message.undoToken)
        ) {
          return {
            ok: false,
            error: {
              code: "INVALID_UNDO",
              message: "Vraćanje stavke više nije dostupno.",
            },
          };
        }
        const state = await storage.restoreHistory(message.undoToken);
        return state
          ? { ok: true, state }
          : {
              ok: false,
              error: {
                code: "INVALID_UNDO",
                message: "Vraćanje stavke više nije dostupno.",
              },
            };
      }
      if (message?.type === "CLEAR_HISTORY")
        return { ok: true, state: await storage.clearHistory() };
      return {
        ok: false,
        error: { code: "UNKNOWN_COMMAND", message: "Nepoznata naredba." },
      };
    } catch {
      log("STORAGE_ERROR");
      return message?.type === "CHECK_URL"
        ? {
            ...invalid(),
            errorCode: "STORAGE_ERROR",
            message: "Pogreška pri čitanju ili spremanju podataka.",
          }
        : {
            ok: false,
            error: {
              code: "STORAGE_ERROR",
              message: "Pogreška pri čitanju ili spremanju podataka.",
            },
          };
    }
  }
  async function contextMenu(info, tab) {
    if (info.menuItemId !== "scamshop-check") return;
    if (info.linkUrl) {
      const url = normalizeUrl(info.linkUrl);
      if (!url || url.length > 8192) {
        log("INVALID_CONTEXT_URL");
        return;
      }
      try {
        await chromeApi.windows.create({
          url: chromeApi.runtime.getURL(
            `popup/popup.html?check=${encodeURIComponent(url)}`,
          ),
          type: "popup",
          width: 440,
          height: 640,
        });
      } catch {
        log("CONTEXT_WINDOW_FAILED");
      }
      return;
    }
    if (info.pageUrl)
      await command({
        type: "CHECK_URL",
        url: info.pageUrl,
        forceCheck: true,
        tabId: tab?.id,
        updateBadge: true,
      });
  }
  return {
    command,
    check,
    contextMenu,
    navigate: badges.navigate,
    activate: badges.activate,
    removeTab: badges.remove,
  };
}
