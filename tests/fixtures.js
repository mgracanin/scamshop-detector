import { test as base, expect, chromium } from "@playwright/test";
import path from "node:path";

// Worker fetch must be mocked in the worker: page routes do not cover this API.
export const test = base.extend({
  extension: async ({ headless }, use) => {
    const extensionPath = path.resolve(process.env.EXTENSION_PATH || ".");
    const context = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });
    try {
      const worker =
        context.serviceWorkers()[0] ||
        (await context.waitForEvent("serviceworker"));
      const extensionId = new URL(worker.url()).host;
      await worker.evaluate(() => {
        globalThis.testApi = { cases: {}, requests: [] };
        globalThis.fetch = async (url, options = {}) => {
          if (
            url !== "https://iffy.cert.hr" &&
            url !== "https://iffy.cert.hr/validate"
          ) {
            throw new Error("Unexpected request outside test API");
          }
          if (!options.method) return new Response("", { status: 200 });
          const body = JSON.parse(options.body);
          globalThis.testApi.requests.push(body);
          const fixture = globalThis.testApi.cases[body.match] || {
            payload: { exist: false },
          };
          if (fixture.delay) {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, fixture.delay);
              options.signal?.addEventListener(
                "abort",
                () => {
                  clearTimeout(timer);
                  reject(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            });
          }
          return new Response(JSON.stringify(fixture.payload), {
            status: fixture.status || 200,
            headers: { "Content-Type": "application/json" },
          });
        };
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await expect(page.locator("#statusVerdict")).toHaveText(
        "Interna stranica",
      );
      await use({ context, page, worker, extensionId });
      expect(errors, "No unhandled popup exceptions").toEqual([]);
    } finally {
      await context.close();
    }
  },
});

export { expect };

export async function manualCheck(page, domain) {
  await page.locator('[data-tab="tab-safety"]').click();
  await page.locator("#manualCheckInput").fill(domain);
  await page.locator("#manualCheckForm button").click();
}
