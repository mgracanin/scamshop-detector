const path = require("node:path");
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
  __dirname,
  ".dev-tools",
  "browsers",
);
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  workers: 1,
  use: { trace: "retain-on-failure" },
});
