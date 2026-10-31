import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  collectAllowedFiles,
  createPackage,
} = require("../../scripts/package.cjs");
const { validateRoot } = require("../../scripts/validate.cjs");

function copyFixture(t) {
  const tempRoot = path.resolve(os.tmpdir());
  const temp = path.resolve(
    fs.mkdtempSync(path.join(tempRoot, "iffy-package-")),
  );
  assert.equal(path.dirname(temp), tempRoot);
  assert.ok(path.basename(temp).startsWith("iffy-package-"));
  t.after(() => {
    if (
      path.dirname(temp) === tempRoot &&
      path.basename(temp).startsWith("iffy-package-")
    )
      fs.rmSync(temp, { recursive: true, force: true });
  });
  const source = path.join(temp, "source");
  fs.mkdirSync(source);
  const root = path.resolve(__dirname, "../..");
  for (const name of [
    "manifest.json",
    "service_worker.js",
    "background",
    "shared",
    "popup",
    "icons",
    "LICENSE",
  ]) {
    const from = path.join(root, name);
    const to = path.join(source, name);
    fs.cpSync(from, to, { recursive: true });
  }
  return { source, output: path.join(temp, "output") };
}

test("package staging and ZIP contain only the sorted allowlist and are reproducible", (t) => {
  const { source, output } = copyFixture(t);
  fs.writeFileSync(path.join(source, "popup", "local.md"), "private note");
  fs.writeFileSync(path.join(source, "icons", ".DS_Store"), "local metadata");
  fs.mkdirSync(path.join(source, "popup", "node_modules"));
  fs.writeFileSync(
    path.join(source, "popup", "node_modules", "junk.js"),
    "local module",
  );
  const out = output;
  const first = createPackage(source, out);
  const firstHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(first.zipPath))
    .digest("hex");
  const second = createPackage(source, out);
  const secondHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(second.zipPath))
    .digest("hex");
  assert.equal(secondHash, firstHash);
  assert.deepEqual(first.files, [...first.files].sort());
  const entries = Object.keys(unzipSync(fs.readFileSync(first.zipPath))).sort();
  assert.deepEqual(entries, first.files);
  assert.deepEqual(collectAllowedFiles(first.stagePath), first.files);
  assert.ok(
    entries.every(
      (name) =>
        !/(?:node_modules|tests|\.dev-tools|\.git|test-results)/i.test(name),
    ),
  );
});

test("packaging fails when a required product directory is absent", (t) => {
  const { source } = copyFixture(t);
  fs.rmSync(path.join(source, "shared"), { recursive: true, force: true });
  assert.throws(
    () => collectAllowedFiles(source),
    /Required packaging entry is missing: shared/,
  );
});

test("validator reports missing relative imports and HTML assets", (t) => {
  const { source } = copyFixture(t);
  fs.writeFileSync(
    path.join(source, "service_worker.js"),
    "import './shared/missing.js';\n",
  );
  fs.writeFileSync(
    path.join(source, "popup", "broken.html"),
    '<script src="./missing.js"></script>',
  );
  const errors = validateRoot(source, { checkPackageVersion: false });
  assert.ok(
    errors.some((error) =>
      error.includes("missing import ./shared/missing.js"),
    ),
  );
  assert.ok(
    errors.some((error) => error.includes("broken.html: missing ./missing.js")),
  );
});
