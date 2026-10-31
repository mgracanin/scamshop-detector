import { test, expect, manualCheck } from "./fixtures.js";

async function inContent(page, selector) {
  return page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const panel = document
      .querySelector(".content-container")
      .getBoundingClientRect();
    return rect.top >= panel.top - 1 && rect.bottom <= panel.bottom + 1;
  });
}

test("manual entry and a complete result fit without scrolling", async ({
  extension,
}) => {
  const { page } = extension;
  await page.setViewportSize({ width: 380, height: 600 });
  expect(await inContent(page, "#manualCheckInput")).toBe(true);
  await manualCheck(page, "shop.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  expect(await inContent(page, "#statusVerdict")).toBe(true);
  expect(await inContent(page, "#manualCheckInput")).toBe(true);
  const live = page
    .getByRole("status")
    .filter({ hasText: "Nema zabilježenih prijava" });
  await expect(live).toHaveCount(1);
});

test("manual completion reveals the verdict after lower content was scrolled", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["warning.example"] = { payload: { exist: true } };
  });
  await manualCheck(page, "warning.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-warning/);
  await expect.poll(() => inContent(page, "#statusVerdict")).toBe(true);
  await expect(page.locator("#warningAdvice")).toBeVisible();
  await expect(page.locator("#warningAdvice")).toHaveText(
    "Ne unosite podatke kartice.",
  );
});

test("warning whitelist override requires confirmation", async ({
  extension,
}) => {
  const { page, worker } = extension;
  await worker.evaluate(() => {
    globalThis.testApi.cases["warning.example"] = { payload: { exist: true } };
  });
  await manualCheck(page, "warning.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-warning/);
  let confirmation;
  page.once("dialog", async (dialog) => {
    confirmation = dialog.message();
    await dialog.dismiss();
  });
  await page.locator("#btnWhitelistCurrent").click();
  expect(confirmation).toContain("provjer");
  expect(
    await worker.evaluate(
      async () => (await chrome.storage.local.get("whitelist")).whitelist || [],
    ),
  ).toEqual([]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#btnWhitelistCurrent").click();
  await expect(page.locator("#statusVerdict")).toHaveText("Dozvoljena domena");
});

test("tabs expose selected state and keyboard focus", async ({ extension }) => {
  const { page } = extension;
  const safety = page.getByRole("tab", { name: "Provjera", exact: true });
  await expect(safety).toHaveAttribute("aria-selected", "true");
  await safety.focus();
  await page.keyboard.press("ArrowRight");
  const history = page.getByRole("tab", { name: "Povijest", exact: true });
  await expect(history).toBeFocused();
  await expect(history).toHaveAttribute("aria-selected", "true");
  const outline = await history.evaluate((element) => ({
    style: getComputedStyle(element).outlineStyle,
    width: parseFloat(getComputedStyle(element).outlineWidth),
  }));
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Postavke", exact: true }),
  ).toBeFocused();
});

test("dark primary action has readable contrast", async ({ extension }) => {
  const { page } = extension;
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() =>
      page.locator("#btnManualCheck").evaluate((element) => {
        const luminance = (color) => {
          const channels = color
            .match(/[\d.]+/g)
            .slice(0, 3)
            .map(Number)
            .map((value) => {
              const normalized = value / 255;
              return normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const style = getComputedStyle(element);
        const colors = [
          luminance(style.color),
          luminance(style.backgroundColor),
        ].sort((a, b) => b - a);
        return (colors[0] + 0.05) / (colors[1] + 0.05);
      }),
    )
    .toBeGreaterThanOrEqual(4.5);
});

test("history groups dates and deletion can be undone without changing totals", async ({
  extension,
}) => {
  const { page } = extension;
  await manualCheck(page, "undo.example");
  await expect(page.locator("#shieldCard")).toHaveClass(/status-info/);
  await page.locator('[data-tab="tab-history"]').click();
  await expect(page.getByText("Danas", { exact: true })).toBeVisible();
  await page.locator(".btn-delete-history").click();
  await expect(page.locator(".hist-domain")).toHaveCount(0);
  await expect(page.locator("#undoNotice")).toBeVisible();
  await page.locator("#btnUndoDelete").click();
  await expect(page.locator(".hist-domain")).toHaveText("undo.example");
  await expect(page.locator("#statScanned")).toHaveText("1");
});

test("compact popup reflows at narrow width and doubled scale", async ({
  extension,
}) => {
  const { page } = extension;
  await page.setViewportSize({ width: 320, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  // Stress the same intrinsic-size limit with a narrower layout as well;
  // platform font metrics must not force the tab buttons wider than the popup.
  await page.setViewportSize({ width: 280, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("#manualCheckInput")).toBeEditable();
});
