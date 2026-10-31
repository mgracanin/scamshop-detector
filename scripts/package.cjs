const fs = require("node:fs");
const path = require("node:path");
const { zipSync } = require("fflate");
const { validateRoot } = require("./validate.cjs");

const root = path.resolve(__dirname, "..");
const required = [
  "manifest.json",
  "service_worker.js",
  "background",
  "shared",
  "popup",
  "icons",
  "LICENSE",
];
const allowedExtensions = {
  background: new Set([".js"]),
  shared: new Set([".js"]),
  popup: new Set([".js", ".html", ".css"]),
  icons: new Set([".png", ".svg"]),
};
const outDir = path.join(root, "dist");

function collectAllowedFiles(sourceRoot) {
  const files = [];
  for (const entry of required) {
    const full = path.join(sourceRoot, entry);
    if (!fs.existsSync(full))
      throw new Error(`Required packaging entry is missing: ${entry}`);
    const stats = fs.lstatSync(full);
    if (stats.isSymbolicLink())
      throw new Error(`Symbolic links are not packageable: ${entry}`);
    if (stats.isDirectory()) {
      const visit = (dir) => {
        for (const name of fs.readdirSync(dir).sort()) {
          if (
            name.startsWith(".") ||
            [
              "node_modules",
              "dist",
              "test-results",
              "playwright-report",
            ].includes(name)
          )
            continue;
          const item = path.join(dir, name);
          const itemStats = fs.lstatSync(item);
          if (itemStats.isSymbolicLink())
            throw new Error(
              `Symbolic links are not packageable: ${path.relative(sourceRoot, item)}`,
            );
          if (itemStats.isDirectory()) visit(item);
          else if (
            itemStats.isFile() &&
            allowedExtensions[entry]?.has(path.extname(name).toLowerCase())
          )
            files.push(
              path.relative(sourceRoot, item).split(path.sep).join("/"),
            );
        }
      };
      visit(full);
    } else if (stats.isFile()) files.push(entry);
    else
      throw new Error(
        `Required packaging entry is not a file or directory: ${entry}`,
      );
  }
  return [...new Set(files)].sort();
}

function createPackage(sourceRoot = root, destination = outDir) {
  sourceRoot = path.resolve(sourceRoot);
  destination = path.resolve(destination);
  const stagePath = path.resolve(destination, "extension");
  if (
    path.dirname(stagePath) !== destination ||
    stagePath === sourceRoot ||
    sourceRoot.startsWith(stagePath + path.sep)
  )
    throw new Error("Refusing unsafe package staging path.");
  const result = validateRoot(sourceRoot, {
    checkPackageVersion: sourceRoot === root,
  });
  if (result.length) throw new Error(result.join("\n"));
  const fileNames = collectAllowedFiles(sourceRoot);
  fs.rmSync(stagePath, {
    recursive: true,
    force: true,
  });
  fs.mkdirSync(stagePath, { recursive: true });
  const zipInputs = {};
  for (const name of fileNames) {
    const bytes = fs.readFileSync(path.join(sourceRoot, name));
    const staged = path.join(stagePath, ...name.split("/"));
    fs.mkdirSync(path.dirname(staged), { recursive: true });
    fs.writeFileSync(staged, bytes);
    zipInputs[name] = bytes;
  }
  fs.mkdirSync(destination, { recursive: true });
  const stagedManifest = JSON.parse(
    fs.readFileSync(path.join(sourceRoot, "manifest.json"), "utf8"),
  );
  const zipPath = path.join(
    destination,
    `scamshop-detector-v${stagedManifest.version}.zip`,
  );
  fs.writeFileSync(
    zipPath,
    zipSync(zipInputs, {
      level: 9,
      mtime: new Date("2020-01-01T00:00:00.000Z"),
    }),
  );
  return {
    files: fileNames,
    zipPath,
    stagePath,
  };
}

if (require.main === module) {
  try {
    const output = createPackage();
    console.log(
      `Packaged ${output.files.length} files into dist/extension and ${path.relative(root, output.zipPath)}.`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { collectAllowedFiles, createPackage };
