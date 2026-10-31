const ROOT = "https://iffy.cert.hr";

export class ApiError extends Error {
  constructor(code, message, retryable = false, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export function adaptResponse(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    (data.message !== undefined && typeof data.message !== "string")
  ) {
    throw new ApiError("INVALID_RESPONSE", "Neispravan odgovor servisa.");
  }
  const message = data.message || "";
  if (message.includes("Poslužitelj nije zaprimio zahtjev")) {
    throw new ApiError(
      "SESSION_EXPIRED",
      "Servis nije zaprimio zahtjev.",
      true,
    );
  }
  if (message.includes("Unesena vrijednost nije URL"))
    throw new ApiError("INVALID_REQUEST", "Servis nije prihvatio domenu.");
  let exists = data.exist;
  if (exists === undefined && /nije prepoznao|nije u bazi/i.test(message))
    exists = false;
  if (typeof exists !== "boolean")
    throw new ApiError("INVALID_RESPONSE", "Neispravan odgovor servisa.");
  return {
    verdict: exists ? "warning" : "safe",
    status_code: 200,
    message:
      message ||
      (exists
        ? "Domena se nalazi u bazi servisa CERT iffy."
        : "Domena nije pronađena u bazi servisa CERT iffy. Prije kupovine provjerite dodatne savjete."),
  };
}

/** Creates an API client. fetchFn is injectable; requestTimeoutMs bounds headers and body together. */
export function createApi({
  fetchFn = (...args) => globalThis.fetch(...args),
  requestTimeoutMs = 10000,
} = {}) {
  let hasSession = false;
  let sessionPromise = null;

  async function request(url, options, readBody = false) {
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new ApiError(
            "TIMEOUT",
            "Isteklo je vrijeme za odgovor servisa.",
            true,
          ),
        );
      }, requestTimeoutMs);
    });
    const operation = (async () => {
      let response;
      try {
        response = await fetchFn(url, {
          ...options,
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          "NETWORK_ERROR",
          "Mrežna pogreška pri povezivanju sa servisom.",
          true,
        );
      }
      if (!response.ok) {
        const status = response.status;
        const retryable = status === 401 || status === 403 || status >= 500;
        throw new ApiError(
          status === 401 || status === 403 ? "SESSION_EXPIRED" : "HTTP_ERROR",
          `Servis je vratio status ${status}.`,
          retryable,
          status,
        );
      }
      if (!readBody) return null;
      try {
        return await response.json();
      } catch {
        throw new ApiError("INVALID_RESPONSE", "Neispravan odgovor servisa.");
      }
    })();
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureSession() {
    if (hasSession) return;
    if (!sessionPromise) {
      sessionPromise = request(ROOT, { credentials: "include" })
        .then(() => {
          hasSession = true;
        })
        .finally(() => {
          sessionPromise = null;
        });
    }
    await sessionPromise;
  }

  async function check(domain) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await ensureSession();
        const data = await request(
          `${ROOT}/validate`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ match: domain }),
          },
          true,
        );
        return adaptResponse(data);
      } catch (error) {
        const failure =
          error instanceof ApiError
            ? error
            : new ApiError("NETWORK_ERROR", "Mrežna pogreška.", true);
        if (
          failure.code === "SESSION_EXPIRED" ||
          failure.code === "NETWORK_ERROR" ||
          failure.code === "TIMEOUT"
        )
          hasSession = false;
        if (!failure.retryable || attempt === 1) throw failure;
      }
    }
  }
  return { check };
}
