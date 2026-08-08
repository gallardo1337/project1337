function integerFromEnv(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} muss eine ganze Zahl zwischen ${min} und ${max} sein.`);
  }
  return value;
}

function booleanFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  if (/^(1|true|yes)$/i.test(raw)) return true;
  if (/^(0|false|no)$/i.test(raw)) return false;
  throw new Error(`${name} muss true oder false sein.`);
}

export function loadConfig() {
  const secret = String(process.env.IAFD_BRIDGE_SECRET || "").trim();
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("IAFD_BRIDGE_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  }

  return Object.freeze({
    host: "0.0.0.0",
    port: integerFromEnv("PORT", 43137, 1, 65535),
    secret,
    navigationTimeoutMs: integerFromEnv(
      "IAFD_NAVIGATION_TIMEOUT_MS",
      35000,
      5000,
      60000
    ),
    challengeWaitMs: integerFromEnv(
      "IAFD_CHALLENGE_WAIT_MS",
      20000,
      0,
      45000
    ),
    cacheTtlMs: integerFromEnv("IAFD_CACHE_TTL_MS", 600000, 0, 3600000),
    maxHtmlBytes: integerFromEnv("IAFD_MAX_HTML_BYTES", 4000000, 100000, 10000000),
    maxRequestsPerMinute: integerFromEnv(
      "IAFD_MAX_REQUESTS_PER_MINUTE",
      20,
      1,
      120
    ),
    browserDataDir:
      String(process.env.IAFD_BROWSER_DATA_DIR || "/data/chromium").trim() ||
      "/data/chromium",
    headless: booleanFromEnv("IAFD_HEADLESS", true),
  });
}
