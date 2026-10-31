const TTL = 10 * 60 * 1000;
const UNDO_TTL = 60 * 1000;
const MAX_UNDOS = 20;
const emptyStats = () => ({ scanned: 0, safe: 0, warnings: 0 });
const validCount = (value) =>
  Number.isFinite(value) && value >= 0 ? value : 0;

export function createStorage(chromeApi, now = Date.now) {
  let queue = Promise.resolve();
  const serialize = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function read() {
    const raw = await chromeApi.storage.local.get([
      "whitelist",
      "history",
      "stats",
    ]);
    const stats =
      raw.stats && typeof raw.stats === "object" ? raw.stats : emptyStats();
    return {
      whitelist: Array.isArray(raw.whitelist)
        ? raw.whitelist.filter((item) => typeof item === "string")
        : [],
      history: Array.isArray(raw.history)
        ? raw.history.filter(
            (item) => item && typeof item === "object" && !Array.isArray(item),
          )
        : [],
      stats: {
        scanned: validCount(stats.scanned),
        safe: validCount(stats.safe),
        warnings: validCount(stats.warnings),
      },
    };
  }
  function migrate(state) {
    let changed = false;
    const ids = new Set();
    state.history = state.history.map((item) => {
      if (typeof item.id === "string" && item.id && !ids.has(item.id)) {
        ids.add(item.id);
        return item;
      }
      changed = true;
      const id = crypto.randomUUID();
      ids.add(id);
      return { ...item, id };
    });
    return changed;
  }
  async function state() {
    return serialize(async () => {
      const value = await read();
      if (migrate(value))
        await chromeApi.storage.local.set({ history: value.history });
      return value;
    });
  }
  async function mutate(fn) {
    return serialize(async () => {
      const value = await read();
      const before = Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, JSON.stringify(item)]),
      );
      migrate(value);
      await fn(value);
      const changes = Object.fromEntries(
        Object.entries(value).filter(
          ([key, item]) => JSON.stringify(item) !== before[key],
        ),
      );
      if (Object.keys(changes).length)
        await chromeApi.storage.local.set(changes);
      return value;
    });
  }
  async function undoEntries() {
    const raw = await chromeApi.storage.session.get("historyUndo");
    const source =
      raw.historyUndo &&
      typeof raw.historyUndo === "object" &&
      !Array.isArray(raw.historyUndo)
        ? raw.historyUndo
        : {};
    return Object.fromEntries(
      Object.entries(source)
        .filter(
          ([, item]) =>
            item &&
            Number.isFinite(item.expiresAt) &&
            item.expiresAt > now() &&
            item.entry &&
            typeof item.entry.id === "string",
        )
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
        .slice(0, MAX_UNDOS),
    );
  }
  async function deleteHistory(id) {
    return serialize(async () => {
      const value = await read();
      migrate(value);
      const entry = value.history.find((item) => item.id === id);
      if (!entry) return { state: value, undoToken: null };
      const undoToken = crypto.randomUUID();
      const entries = await undoEntries();
      const bounded = Object.fromEntries([
        [undoToken, { entry, expiresAt: now() + UNDO_TTL }],
        ...Object.entries(entries).slice(0, MAX_UNDOS - 1),
      ]);
      // Persist the undo before deleting, so session storage failure cannot lose history.
      await chromeApi.storage.session.set({ historyUndo: bounded });
      value.history = value.history.filter((item) => item.id !== id);
      await chromeApi.storage.local.set({ history: value.history });
      return { state: value, undoToken };
    });
  }
  async function restoreHistory(undoToken) {
    return serialize(async () => {
      const entries = await undoEntries();
      if (!Object.hasOwn(entries, undoToken)) return null;
      const value = await read();
      migrate(value);
      const entry = entries[undoToken].entry;
      if (!value.history.some((item) => item.id === entry.id)) {
        value.history.push(entry);
        value.history.sort(
          (a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0),
        );
        value.history = value.history.slice(0, 100);
      }
      await chromeApi.storage.local.set({ history: value.history });
      delete entries[undoToken];
      await chromeApi.storage.session.set({ historyUndo: entries });
      return value;
    });
  }
  async function clearHistory() {
    return serialize(async () => {
      const value = await read();
      // Invalidate tokens first: a failed clear may retain history, but cannot undo a successful clear.
      await chromeApi.storage.session.set({ historyUndo: {} });
      value.history = [];
      await chromeApi.storage.local.set({ history: value.history });
      return value;
    });
  }
  async function cached(domain) {
    const raw = await chromeApi.storage.session.get("domainCache");
    const item = raw.domainCache?.[domain];
    const age = now() - item?.checkedAt;
    return item &&
      Number.isFinite(age) &&
      age >= 0 &&
      age < TTL &&
      ["safe", "warning"].includes(item.verdict) &&
      item.domain === domain &&
      item.url === domain &&
      typeof item.message === "string" &&
      typeof item.status_code === "number"
      ? item
      : null;
  }
  async function saveCache(domain, result) {
    return serialize(async () => {
      const raw = await chromeApi.storage.session.get("domainCache");
      const cache =
        raw.domainCache &&
        typeof raw.domainCache === "object" &&
        !Array.isArray(raw.domainCache)
          ? raw.domainCache
          : {};
      cache[domain] = result;
      const entries = Object.entries(cache)
        .filter(
          ([, item]) =>
            item &&
            Number.isFinite(item.checkedAt) &&
            now() - item.checkedAt >= 0 &&
            now() - item.checkedAt < TTL,
        )
        .sort((a, b) => b[1].checkedAt - a[1].checkedAt)
        .slice(0, 500);
      await chromeApi.storage.session.set({
        domainCache: Object.fromEntries(entries),
      });
    });
  }
  async function record(result) {
    return mutate((value) => {
      value.history.unshift({
        ...result,
        id: crypto.randomUUID(),
        timestamp: now(),
      });
      value.history = value.history.slice(0, 100);
      value.stats.scanned++;
      value.stats[result.verdict === "safe" ? "safe" : "warnings"]++;
    });
  }
  return {
    state,
    mutate,
    cached,
    saveCache,
    record,
    deleteHistory,
    restoreHistory,
    clearHistory,
  };
}
