import { test, expect } from "./fixtures.js";
import { mkdir, writeFile } from "node:fs/promises";

// Toolbar popups are CDP targets, but Playwright does not expose them as pages.
test("toolbar popup opens at a usable size with manual entry visible", async ({
  extension,
}, testInfo) => {
  const { context, worker, extensionId, page } = extension;
  await page.route("https://shop.example/**", (route) =>
    route.fulfill({
      body: "<title>Test shop</title>",
      contentType: "text/html",
    }),
  );
  await page.goto("https://shop.example/");
  const cdp = await context.browser().newBrowserCDPSession();
  await worker.evaluate(() => chrome.action.openPopup());
  let target;
  await expect
    .poll(async () => {
      const { targetInfos } = await cdp.send("Target.getTargets");
      target = targetInfos.find(
        (item) =>
          item.url === `chrome-extension://${extensionId}/popup/popup.html` &&
          !item.attached,
      );
      return Boolean(target);
    })
    .toBe(true);
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  });
  let nextId = 0;
  async function command(method, params = {}) {
    const id = ++nextId;
    const response = new Promise((resolve, reject) => {
      function receive(event) {
        const message = JSON.parse(event.message);
        if (event.sessionId !== sessionId || message.id !== id) return;
        cdp.off("Target.receivedMessageFromTarget", receive);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      cdp.on("Target.receivedMessageFromTarget", receive);
    });
    await cdp.send("Target.sendMessageToTarget", {
      sessionId,
      message: JSON.stringify({ id, method, params }),
    });
    return response;
  }
  let size;
  await expect
    .poll(async () => {
      const { result } = await command("Runtime.evaluate", {
        expression: `JSON.stringify({ width: innerWidth, height: innerHeight,
        inputBottom: document.querySelector('#manualCheckInput').getBoundingClientRect().bottom,
        navTop: document.querySelector('.nav-bar').getBoundingClientRect().top,
        navBottom: document.querySelector('.nav-bar').getBoundingClientRect().bottom,
        verdict: document.querySelector('#statusVerdict').textContent })`,
        returnByValue: true,
      });
      size = JSON.parse(result.value);
      return size.verdict;
    })
    .toBe("Nema zabilježenih prijava");
  // Chrome may reserve space for a native scrollbar around the document.
  expect(size.width).toBeGreaterThanOrEqual(380);
  expect(size.width).toBeLessThanOrEqual(400);
  // Chrome caps popup height to the space available below its toolbar.
  expect(size.height).toBeGreaterThanOrEqual(480);
  expect(size.height).toBeLessThanOrEqual(560);
  expect(size.navBottom).toBeLessThanOrEqual(size.height);
  expect(size.inputBottom).toBeLessThanOrEqual(size.navTop);
  const { data } = await command("Page.captureScreenshot");
  await mkdir(testInfo.outputDir, { recursive: true });
  await writeFile(
    testInfo.outputPath("toolbar-popup.png"),
    Buffer.from(data, "base64"),
  );
  await cdp.detach();
});
