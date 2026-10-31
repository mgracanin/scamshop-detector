// Shared hostname parsing for all extension entry points.
export function normalizeUrl(input) {
  if (typeof input !== "string") return "";
  const value = input.trim();
  if (!value || /[\s\\]/.test(value)) return "";
  if (/^https?:/i.test(value) && !/^https?:\/\/[^/?#]+/i.test(value)) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    // A bare hostname may include a numeric port.
    if (!/^[^/:?#]+:\d+(?:[/?#]|$)/.test(value)) return "";
  }
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return "";
    const host = url.hostname.toLowerCase();
    if (!host || host.endsWith(".") || host.length > 253) return "";
    if (
      !host.startsWith("[") &&
      !host
        .split(".")
        .every(
          (label) =>
            label.length > 0 &&
            label.length <= 63 &&
            /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
        )
    )
      return "";
    return url.href;
  } catch {
    return "";
  }
}
export function getDomain(input) {
  const url = normalizeUrl(input);
  return url ? new URL(url).hostname.toLowerCase() : "";
}
export function normalizeDomain(input) {
  return getDomain(input).replace(/^www\./, "");
}
export function findWhitelistMatch(domain, list) {
  const host = normalizeDomain(domain);
  if (!host || !Array.isArray(list)) return null;
  for (const item of list) {
    const entry = normalizeDomain(item);
    if (entry && (host === entry || host.endsWith(`.${entry}`))) return entry;
  }
  return null;
}
export function isWhitelisted(domain, list) {
  return findWhitelistMatch(domain, list) !== null;
}
