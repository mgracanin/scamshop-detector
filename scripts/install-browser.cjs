const { spawnSync } = require("node:child_process");
const path = require("node:path");

const result = spawnSync(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve("playwright/package.json")),
      "cli.js",
    ),
    "install",
    "chromium",
    "--no-shell",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: path.resolve(
        __dirname,
        "..",
        ".dev-tools",
        "browsers",
      ),
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
