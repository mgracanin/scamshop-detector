const fs = require("node:fs");
const path = require("node:path");

function validateRoot(root, { checkPackageVersion = true } = {}) {
  root = path.resolve(root);
  const errors = [];
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) return ["manifest.json is missing"];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  function checkReference(value, label, base = root) {
    if (
      typeof value !== "string" ||
      !value ||
      /^[a-z][a-z0-9+.-]*:/i.test(value) ||
      value.startsWith("#")
    )
      return;
    const clean = value.split(/[?#]/, 1)[0];
    if (!fs.existsSync(path.resolve(base, clean)))
      errors.push(`${label}: missing ${clean}`);
  }
  function walk(value, label = "manifest") {
    if (Array.isArray(value))
      return value.forEach((entry, i) => walk(entry, `${label}[${i}]`));
    if (value && typeof value === "object")
      return Object.entries(value).forEach(([key, entry]) =>
        walk(entry, `${label}.${key}`),
      );
    if (
      typeof value === "string" &&
      /(?:^|\/)[^/]+\.(?:js|html|css|png|svg|json|woff2?)$/i.test(value)
    )
      checkReference(value, label);
  }
  walk(manifest);

  const sourceDirs = ["", "background", "shared", "popup"];
  for (const dir of sourceDirs) {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) continue;
    const files = dir
      ? fs
          .readdirSync(fullDir)
          .filter((name) => name.endsWith(".js"))
          .map((name) => path.join(fullDir, name))
      : [path.join(fullDir, "service_worker.js")];
    for (const file of files) {
      if (!fs.existsSync(file)) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /\b(?:from\s*|import\s*(?:\(\s*)?)["'](\.{1,2}\/[^"']+)["']/g,
      )) {
        const specifier = match[1];
        const target = path.resolve(path.dirname(file), specifier);
        if (!target.startsWith(root + path.sep) || !fs.existsSync(target))
          errors.push(
            `${path.relative(root, file)}: missing import ${specifier}`,
          );
      }
    }
  }

  for (const dir of ["popup"]) {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) continue;
    for (const name of fs.readdirSync(fullDir)) {
      const file = path.join(fullDir, name);
      if (!name.endsWith(".html")) continue;
      const html = fs.readFileSync(file, "utf8");
      for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const ref = match[1];
        if (!/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(ref)) {
          const target = path.resolve(path.dirname(file), ref);
          if (!target.startsWith(root + path.sep) || !fs.existsSync(target))
            errors.push(`${path.relative(root, file)}: missing ${ref}`);
        }
      }
    }
  }
  if (checkPackageVersion) {
    const packagePath = path.join(root, "package.json");
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      if (manifest.version !== pkg.version)
        errors.push(
          `package version ${pkg.version} does not match manifest ${manifest.version}`,
        );
    }
  }
  if (!fs.existsSync(path.join(root, "LICENSE")))
    errors.push("LICENSE is missing");
  return errors;
}

if (require.main === module) {
  const root = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "..");
  const errors = validateRoot(root);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
  );
  console.log(
    `Manifest ${manifest.version}: referenced files, imports, and version are valid.`,
  );
}

module.exports = { validateRoot };
