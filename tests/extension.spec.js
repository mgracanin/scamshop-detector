import { test, expect, manualCheck } from "./fixtures.js";

test("whitelist persists on reload and removes an exact entry", async ({
  extension,
}) => {
  const { page } = extension;
  await page.locator('[data-tab="tab-settings"]').click();
  await page
    .locator("#whitelistAddInput")
    .fill("https://www.shop.example/private");
  await page.locator("#whitelistAddForm button").click();
  await expect(page.locator(".whitelist-domain")).toHaveText("shop.example");
  await page.reload();
  await page.locator('[data-tab="tab-settings"]').click();
  await expect(page.locator(".whitelist-domain")).toHaveText("shop.example");
  await page.locator(".btn-remove-whitelist").click();
  await expect(page.locator(".whitelist-domain")).toHaveCount(0);
});

test("manual scan sends hostname only and updates history and statistics", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await manualCheck(page, "https://shop.example/private?token=secret");
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Nema zabilježenih prijava",
  );
  expect(await worker.evaluate(() => globalThis.testApi.requests)).toEqual([
    { match: "shop.example" },
  ]);
  await page.locator('[data-tab="tab-history"]').click();
  await expect(page.locator(".hist-domain")).toHaveText("shop.example");
  await page.locator('[data-tab="tab-settings"]').click();
  await expect(page.locator("#statScanned")).toHaveText("1");
  await expect(page.locator("#statSafe")).toHaveText("1");
  const badge = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    return chrome.action.getBadgeText({ tabId: tabs[0].id });
  });
  expect(badge, "Manual checks must not label an unrelated active tab").toBe(
    "",
  );
});

test("warning and malformed responses remain distinct", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["warning.example"] = { payload: { exist: true } };
    globalThis.testApi.cases["broken.example"] = { payload: {} };
  });
  await manualCheck(page, "warning.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-warning/);
  await manualCheck(page, "broken.example");
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Pogreška pri provjeri",
  );
  expect(
    await worker.evaluate(
      () =>
        globalThis.testApi.requests.filter((x) => x.match === "broken.example")
          .length,
    ),
  ).toBe(1);
});

test("late responses cannot overwrite latest result or whitelist target", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["slow.example"] = {
      payload: { exist: true },
      delay: 600,
    };
  });
  await manualCheck(page, "slow.example");
  await expect
    .poll(() =>
      worker.evaluate(() =>
        globalThis.testApi.requests.some((x) => x.match === "slow.example"),
      ),
    )
    .toBe(true);
  await manualCheck(page, "latest.example");
  await expect(page.locator("#statusDomain")).toHaveText("latest.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const { history = [] } = await chrome.storage.local.get("history");
        return history.some((x) => x.domain === "slow.example");
      }),
    )
    .toBe(true);
  await expect(page.locator("#statusDomain")).toHaveText("latest.example");
  await page.locator("#btnWhitelistCurrent").click();
  await expect(page.locator("#statusVerdict")).toHaveText("Dozvoljena domena");
  await page.locator('[data-tab="tab-settings"]').click();
  await expect(page.locator(".whitelist-domain")).toHaveText("latest.example");
});

test("invalid input cancels rendering of a pending result", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["slow.example"] = {
      payload: { exist: true },
      delay: 500,
    };
  });
  await manualCheck(page, "slow.example");
  await expect
    .poll(() => worker.evaluate(() => globalThis.testApi.requests.length))
    .toBe(1);
  await manualCheck(page, "https://bad host/path");
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Pogreška pri provjeri",
  );
  await expect
    .poll(() =>
      worker.evaluate(
        async () =>
          (await chrome.storage.local.get("history")).history?.length || 0,
      ),
    )
    .toBe(1);
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Pogreška pri provjeri",
  );
});

test("subdomain allowance removal removes parent entry granting it", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await page.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "ADD_WHITELIST",
      domain: "shop.example",
    }),
  );
  await manualCheck(page, "sub.shop.example");
  await expect(page.locator("#statusVerdict")).toHaveText("Dozvoljena domena");
  expect(await worker.evaluate(() => globalThis.testApi.requests)).toEqual([]);
  await page.locator("#btnWhitelistCurrent").click();
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Nema zabilježenih prijava",
  );
  await page.locator('[data-tab="tab-settings"]').click();
  await expect(page.locator(".whitelist-domain")).toHaveCount(0);
});

test("history deletion uses stable IDs and clear preserves statistics", async ({
  extension,
}) => {
  const { page } = extension;
  await manualCheck(page, "first.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await manualCheck(page, "second.example");
  await expect(page.locator("#statusDomain")).toHaveText("second.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await page.locator('[data-tab="tab-history"]').click();
  await page
    .locator(".history-item")
    .filter({ hasText: "first.example" })
    .locator(".btn-delete-history")
    .click();
  await expect(page.locator(".hist-domain")).toHaveText("second.example");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btnClearHistory").click();
  await expect(page.locator(".hist-domain")).toHaveCount(0);
  await page.locator('[data-tab="tab-settings"]').click();
  await expect(page.locator("#statScanned")).toHaveText("2");
});

test("about page displays manifest version", async ({ extension }) => {
  const { context, extensionId } = extension;
  const about = await context.newPage();
  await about.goto(`chrome-extension://${extensionId}/popup/about.html`);
  const version = await about.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  await expect(about.locator(".version-tag")).toHaveText(`v${version}`);
});

test("repeated checks use cache while refresh explicitly scans again", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await manualCheck(page, "cached.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await manualCheck(page, "cached.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  expect(await worker.evaluate(() => globalThis.testApi.requests.length)).toBe(
    1,
  );
  await page.locator("#btnRefreshCheck").click();
  await expect
    .poll(() => worker.evaluate(() => globalThis.testApi.requests.length))
    .toBe(2);
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
});

test("link result popup scans its explicit target without changing page badge", async ({
  extension,
}) => {
  const { page, worker, extensionId } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["link.example"] = { payload: { exist: true } };
  });
  await page.goto(
    `chrome-extension://${extensionId}/popup/popup.html?check=${encodeURIComponent("https://link.example/private?secret=1")}`,
  );
  await expect(page.locator("#statusDomain")).toHaveText("link.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-warning/);
  expect(await worker.evaluate(() => globalThis.testApi.requests)).toEqual([
    { match: "link.example" },
  ]);
});

test("two open popups keep whitelist and displayed verdict in sync", async ({
  extension,
}) => {
  const { page, context, extensionId } = extension;
  await manualCheck(page, "shared.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  const second = await context.newPage();
  await second.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await expect(second.locator("#statusVerdict")).toHaveText("Interna stranica");
  await second.locator('[data-tab="tab-settings"]').click();
  await second.locator("#whitelistAddInput").fill("shared.example");
  await second.locator("#whitelistAddForm button").click();
  await expect(page.locator("#statusVerdict")).toHaveText("Dozvoljena domena");
  await second.locator(".btn-remove-whitelist").click();
  await expect(page.locator("#statusVerdict")).toHaveText(
    "Nema zabilježenih prijava",
  );
});

test("initial active-tab scan owns its badge and reopening uses cache", async ({
  extension,
}) => {
  const { page, context, worker } = extension;
  await context.route("https://active.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<title>Test shop</title>",
    }),
  );
  const shop = await context.newPage();
  await shop.goto("https://active.example/");
  const target = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({ url: "https://active.example/*" }))[0],
  );
  // A standalone test tab hosts the popup, so provide the real shop tab that an
  // action popup would receive from the browser's active-tab query.
  await page.addInitScript(
    (tab) => {
      const original = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = (query, callback) => {
        if (query.active && query.currentWindow) {
          if (callback) {
            callback([tab]);
            return;
          }
          return Promise.resolve([tab]);
        }
        return callback ? original(query, callback) : original(query);
      };
    },
    { id: target.id, url: target.url },
  );
  // An action popup is foreground UI. Do not leave its standalone test host
  // background-throttled after opening the shop tab.
  await page.bringToFront();
  await page.reload();
  await expect(page.locator("#statusDomain")).toHaveText("active.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await expect
    .poll(() =>
      worker.evaluate(
        (id) => chrome.action.getBadgeText({ tabId: id }),
        target.id,
      ),
    )
    .toBe("OK");
  await page.reload();
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  expect(await worker.evaluate(() => globalThis.testApi.requests)).toEqual([
    { match: "active.example" },
  ]);
});
