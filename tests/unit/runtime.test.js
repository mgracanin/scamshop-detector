import test from "node:test";
import assert from "node:assert/strict";
import {
  getDomain,
  normalizeUrl,
  findWhitelistMatch,
} from "../../shared/domain.js";
import { createRuntime, adaptResponse } from "../../background/runtime.js";

function fixture(initial = {}) {
  const local = structuredClone(initial),
    session = {},
    badges = [],
    tab = { url: "https://a.example/path" };
  const area = (store) => ({
    get: async () => structuredClone(store),
    set: async (value) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      Object.assign(store, structuredClone(value));
    },
  });
  const chrome = {
    storage: { local: area(local), session: area(session) },
    tabs: { get: async () => ({ ...tab }) },
    action: {
      setBadgeText: async (x) => badges.push(x.text),
      setBadgeBackgroundColor: async () => {},
      setTitle: async () => {},
    },
  };
  return { chrome, local, session, badges, tab };
}
const response = (data) => ({ ok: true, json: async () => data });

test("domain parser rejects unsupported schemes and malformed input", () => {
  assert.equal(
    getDomain(" HTTPS://WWW.Example.com/a?q=secret "),
    "www.example.com",
  );
  assert.equal(getDomain("example.com:8080/a"), "example.com");
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "https://bad..example",
    "https://user:pass@example.com",
    "http://bad host",
    "https:///example.com",
  ])
    assert.equal(getDomain(value), "");
  assert.equal(normalizeUrl("example.com/a?x=1"), "https://example.com/a?x=1");
  assert.equal(
    findWhitelistMatch("sub.example.com", ["www.example.com"]),
    "example.com",
  );
  assert.equal(findWhitelistMatch("badexample.com", ["example.com"]), null);
});

test("response schema rejects ambiguous results", () => {
  assert.equal(adaptResponse({ exist: false }).verdict, "safe");
  assert.equal(adaptResponse({ message: "Nije u bazi" }).verdict, "safe");
  assert.throws(() => adaptResponse({ message: "unexpected" }));
  assert.throws(() => adaptResponse({ exist: "false" }));
});

test("concurrent commands preserve updates and migrate old history IDs", async () => {
  const f = fixture({ history: [{ domain: "old.example" }] });
  const runtime = createRuntime(f.chrome, async () =>
    response({ exist: false }),
  );
  await Promise.all(
    ["a.example", "b.example", "c.example"].map((domain) =>
      runtime.command({ type: "ADD_WHITELIST", domain }),
    ),
  );
  const state = (await runtime.command({ type: "GET_STATE" })).state;
  assert.deepEqual(state.whitelist.sort(), [
    "a.example",
    "b.example",
    "c.example",
  ]);
  assert.ok(state.history[0].id);
  assert.equal(
    (await runtime.command({ type: "GET_STATE" })).state.history[0].id,
    state.history[0].id,
  );
  await runtime.command({ type: "DELETE_HISTORY", id: state.history[0].id });
  assert.equal(f.local.history.length, 0);
});

test("checks singleflight, send hostname only, and persist cache across worker restarts", async () => {
  const f = fixture();
  let root = 0,
    posts = 0,
    sent;
  const fetcher = async (url, opts) => {
    if (!opts.method) {
      root++;
      return response({});
    }
    posts++;
    sent = JSON.parse(opts.body);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return response({ exist: false });
  };
  const runtime = createRuntime(f.chrome, fetcher);
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      runtime.command({
        type: "CHECK_URL",
        url: "https://a.example/private?q=secret",
      }),
    ),
  );
  assert.equal(root, 1);
  assert.equal(posts, 1);
  assert.deepEqual(sent, { match: "a.example" });
  assert.ok(results.every((x) => x.verdict === "safe"));
  assert.equal(f.local.stats.scanned, 1);
  const restarted = createRuntime(f.chrome, fetcher);
  assert.equal(
    (
      await restarted.command({
        type: "CHECK_URL",
        url: "https://a.example/other",
      })
    ).source,
    "cache",
  );
  assert.equal(posts, 1);
});

test("late scan cannot badge a navigated tab or a scan without badge permission", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const runtime = createRuntime(f.chrome, async (url, opts) => {
    if (opts.method) await gate;
    return response({ exist: true });
  });
  const pending = runtime.check({
    url: f.tab.url,
    tabId: 1,
    updateBadge: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  f.tab.url = "https://other.example/";
  release();
  await pending;
  await runtime.check({
    url: "https://a.example",
    tabId: 1,
    updateBadge: false,
  });
  assert.deepEqual(f.badges, []);
});

test("independent domains share session initialization and failed storage commands complete", async () => {
  const f = fixture();
  let roots = 0;
  const runtime = createRuntime(f.chrome, async (url, opts) => {
    if (!opts.method) {
      roots++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return response({ exist: false });
  });
  await Promise.all(
    ["a.example", "b.example"].map((url) =>
      runtime.check({ url, forceCheck: true }),
    ),
  );
  assert.equal(roots, 1);
  assert.equal(f.local.stats.scanned, 2);
  f.chrome.storage.local.set = async () => {
    throw new Error("unavailable");
  };
  assert.equal(
    (await runtime.command({ type: "CLEAR_HISTORY" })).error.code,
    "STORAGE_ERROR",
  );
});

import { createApi } from "../../background/api.js";

test("API retries only transient failures and refreshes expired sessions", async () => {
  async function scenario(sequence) {
    let roots = 0,
      posts = 0;
    const api = createApi({
      requestTimeoutMs: 50,
      fetchFn: async (_url, opts) => {
        if (!opts.method) {
          roots++;
          return response({});
        }
        const item = sequence[posts++];
        if (item === "malformed") return response({ unexpected: true });
        if (item === "expired")
          return response({ message: "Poslužitelj nije zaprimio zahtjev" });
        if (typeof item === "number") return { ok: false, status: item };
        return response({ exist: true });
      },
    });
    let error;
    try {
      await api.check("a.example");
    } catch (caught) {
      error = caught;
    }
    return { roots, posts, error };
  }
  for (const status of [400, 429]) {
    const result = await scenario([status, "ok"]);
    assert.equal(result.posts, 1);
    assert.equal(result.error.code, "HTTP_ERROR");
  }
  const malformed = await scenario(["malformed", "ok"]);
  assert.equal(malformed.posts, 1);
  assert.equal(malformed.error.code, "INVALID_RESPONSE");
  for (const failure of [401, "expired"]) {
    const result = await scenario([failure, "ok"]);
    assert.equal(result.posts, 2);
    assert.equal(result.roots, 2);
    assert.equal(result.error, undefined);
  }
  const transient = await scenario([503, "ok"]);
  assert.equal(transient.posts, 2);
  assert.equal(transient.error, undefined);
});

test("API deadline covers a stalled response body and retries once", async () => {
  let posts = 0;
  const api = createApi({
    requestTimeoutMs: 10,
    fetchFn: async (_url, opts) => {
      if (!opts.method) return response({});
      posts++;
      return { ok: true, json: () => new Promise(() => {}) };
    },
  });
  await assert.rejects(
    api.check("a.example"),
    (error) => error.code === "TIMEOUT",
  );
  assert.equal(posts, 2);
});

test("cache expiry, concurrent different domains, and storage failure recovery", async () => {
  const f = fixture();
  let time = 1000000,
    posts = 0;
  const runtime = createRuntime(
    f.chrome,
    async (_url, opts) => {
      if (opts.method) posts++;
      return response({ exist: false });
    },
    () => time,
    { log: () => {} },
  );
  await Promise.all(
    ["a.example", "b.example"].map((url) => runtime.check({ url })),
  );
  assert.equal(f.local.history.length, 2);
  assert.equal(f.local.stats.scanned, 2);
  assert.equal((await runtime.check({ url: "a.example" })).source, "cache");
  time += 600001;
  assert.equal((await runtime.check({ url: "a.example" })).source, "network");
  assert.equal(posts, 3);
  const originalSet = f.chrome.storage.local.set;
  f.chrome.storage.local.set = async () => {
    throw new Error("disk");
  };
  const success = await runtime.check({ url: "c.example", forceCheck: true });
  assert.equal(success.verdict, "safe");
  assert.equal(success.persistenceWarning, "HISTORY_WRITE_FAILED");
  f.chrome.storage.local.set = originalSet;
  await runtime.check({ url: "d.example", forceCheck: true });
  assert.equal(f.local.stats.scanned, 4);
});

test("state reads avoid writes after migration and ignore corrupt entries", async () => {
  const f = fixture({
    whitelist: [null, "a.example"],
    history: [null, { domain: "a.example" }],
    stats: null,
  });
  let writes = 0;
  const set = f.chrome.storage.local.set;
  f.chrome.storage.local.set = async (value) => {
    writes++;
    await set(value);
  };
  const runtime = createRuntime(f.chrome, async () => response({}), Date.now, {
    log: () => {},
  });
  const first = (await runtime.command({ type: "GET_STATE" })).state;
  const second = (await runtime.command({ type: "GET_STATE" })).state;
  assert.equal(writes, 1);
  assert.equal(first.history[0].id, second.history[0].id);
  assert.deepEqual(first.whitelist, ["a.example"]);
  assert.deepEqual(first.stats, { scanned: 0, safe: 0, warnings: 0 });
});

test("latest same-domain forced scan owns badge", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const runtime = createRuntime(f.chrome, async (_url, opts) => {
    if (opts.method) await gate;
    return response({ exist: true });
  });
  const first = runtime.check({
    url: f.tab.url,
    forceCheck: true,
    tabId: 1,
    updateBadge: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = runtime.check({
    url: f.tab.url,
    forceCheck: true,
    tabId: 1,
    updateBadge: true,
  });
  release();
  await Promise.all([first, second]);
  assert.deepEqual(f.badges, ["WRN"]);
});

test("context-menu link opens popup once without scanning; page scans and badges", async () => {
  const f = fixture();
  let posts = 0;
  const windows = [];
  f.chrome.runtime = { getURL: (path) => `chrome-extension://id/${path}` };
  f.chrome.windows = { create: async (options) => windows.push(options) };
  const runtime = createRuntime(
    f.chrome,
    async (_url, opts) => {
      if (opts.method) posts++;
      return response({ exist: false });
    },
    Date.now,
    { log: () => {} },
  );
  await runtime.contextMenu(
    {
      menuItemId: "scamshop-check",
      linkUrl: "https://link.example/private?q=1",
    },
    { id: 1 },
  );
  assert.equal(posts, 0);
  assert.equal(windows.length, 1);
  assert.equal(
    new URL(windows[0].url).searchParams.get("check"),
    "https://link.example/private?q=1",
  );
  await runtime.contextMenu(
    { menuItemId: "scamshop-check", linkUrl: "javascript:alert(1)" },
    { id: 1 },
  );
  assert.equal(windows.length, 1);
  await runtime.contextMenu(
    { menuItemId: "scamshop-check", pageUrl: f.tab.url },
    { id: 1 },
  );
  assert.equal(posts, 1);
  assert.deepEqual(f.badges, ["OK"]);
});

test("activation of non-whitelisted tab preserves existing and pending badges", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const runtime = createRuntime(f.chrome, async (_url, opts) => {
    if (opts.method) await gate;
    return response({ exist: true });
  });
  const scan = runtime.check({
    url: f.tab.url,
    forceCheck: true,
    tabId: 1,
    updateBadge: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await runtime.activate(1, f.tab.url);
  release();
  await scan;
  assert.deepEqual(f.badges, ["WRN"]);
  await runtime.activate(1, f.tab.url);
  assert.deepEqual(f.badges, ["WRN"]);
});

test("whitelist change invalidates a pending scan badge", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const runtime = createRuntime(f.chrome, async (_url, opts) => {
    if (opts.method) await gate;
    return response({ exist: true });
  });
  const scan = runtime.check({
    url: f.tab.url,
    forceCheck: true,
    tabId: 1,
    updateBadge: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await runtime.command({ type: "ADD_WHITELIST", domain: "a.example" });
  await runtime.navigate(1, f.tab.url);
  release();
  await scan;
  assert.deepEqual(f.badges, ["WHT"]);
});

test("history undo survives worker restart, preserves scan updates and consumes its token", async () => {
  let time = 100000;
  const old = { id: "old-id", domain: "old.example", timestamp: 100 };
  const f = fixture({
    history: [old],
    stats: { scanned: 1, safe: 1, warnings: 0 },
  });
  const fetcher = async () => response({ exist: false });
  const runtime = createRuntime(f.chrome, fetcher, () => time, {
    log: () => {},
  });
  const [deleted] = await Promise.all([
    runtime.command({ type: "DELETE_HISTORY", id: old.id }),
    runtime.check({ url: "new.example", forceCheck: true }),
  ]);
  assert.ok(deleted.undoToken);
  const restarted = createRuntime(f.chrome, fetcher, () => time, {
    log: () => {},
  });
  const restored = await restarted.command({
    type: "RESTORE_HISTORY",
    undoToken: deleted.undoToken,
    entry: { id: "injected" },
  });
  assert.equal(restored.ok, true);
  assert.deepEqual(
    restored.state.history.map((item) => item.domain),
    ["new.example", "old.example"],
  );
  assert.deepEqual(restored.state.stats, { scanned: 2, safe: 2, warnings: 0 });
  assert.equal(
    (
      await restarted.command({
        type: "RESTORE_HISTORY",
        undoToken: deleted.undoToken,
      })
    ).error.code,
    "INVALID_UNDO",
  );
  assert.equal(f.local.history.length, 2);
  time++;
});

test("undo expires, clear invalidates tokens, and session failure preserves history", async () => {
  let time = 1000;
  const entry = { id: "old-id", timestamp: 100 };
  const f = fixture({ history: [entry] });
  const runtime = createRuntime(
    f.chrome,
    async () => response({}),
    () => time,
    { log: () => {} },
  );
  const deleted = await runtime.command({
    type: "DELETE_HISTORY",
    id: entry.id,
  });
  time += 60000;
  assert.equal(
    (
      await runtime.command({
        type: "RESTORE_HISTORY",
        undoToken: deleted.undoToken,
      })
    ).error.code,
    "INVALID_UNDO",
  );
  f.local.history = [entry];
  const again = await runtime.command({ type: "DELETE_HISTORY", id: entry.id });
  await runtime.command({ type: "CLEAR_HISTORY" });
  assert.equal(
    (
      await runtime.command({
        type: "RESTORE_HISTORY",
        undoToken: again.undoToken,
      })
    ).error.code,
    "INVALID_UNDO",
  );
  f.local.history = [entry];
  f.chrome.storage.session.set = async () => {
    throw new Error("failure");
  };
  assert.equal(
    (await runtime.command({ type: "DELETE_HISTORY", id: entry.id })).error
      .code,
    "STORAGE_ERROR",
  );
  assert.deepEqual(f.local.history, [entry]);
});

test("undo map stays bounded and newest token survives identical timestamps", async () => {
  const entries = Array.from({ length: 21 }, (_, index) => ({
    id: `id-${index}`,
    timestamp: index,
  }));
  const f = fixture({ history: entries });
  const runtime = createRuntime(
    f.chrome,
    async () => response({}),
    () => 1000,
    { log: () => {} },
  );
  let last;
  for (const entry of entries)
    last = await runtime.command({ type: "DELETE_HISTORY", id: entry.id });
  assert.equal(Object.keys(f.session.historyUndo).length, 20);
  assert.equal(
    (
      await runtime.command({
        type: "RESTORE_HISTORY",
        undoToken: last.undoToken,
      })
    ).ok,
    true,
  );
});
