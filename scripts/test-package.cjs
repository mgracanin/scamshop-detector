const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const result = spawnSync(
  process.execPath,
  [
    path.join(
      path.dirname(require.resolve("playwright/package.json")),
      "cli.js",
    ),
    "test",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      EXTENSION_PATH: path.join(root, "dist", "extension"),
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
