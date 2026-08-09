const DEFAULT_VIDEO_EXTENSIONS = [
  "mp4",
  "mkv",
  "avi",
  "mov",
  "wmv",
  "m4v",
  "webm",
  "mpg",
  "mpeg",
  "mpe",
  "ts",
  "m2ts",
  "mts",
  "m2v",
  "mpv",
  "flv",
  "f4v",
  "vob",
  "3gp",
  "3g2",
  "ogv",
  "ogm",
  "asf",
  "rm",
  "rmvb",
  "divx",
  "mxf",
  "qt",
  "mod",
  "tod",
  "dv",
  "nut",
  "h264",
  "h265",
  "hevc",
  "iso",
];

const DEFAULT_IGNORED_DIRECTORIES = [
  "@eaDir",
  "#recycle",
  "@Recycle",
  ".recycle",
  ".Trash-1000",
  "lost+found",
];

function integerFromEnv(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw == null || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} muss eine ganze Zahl zwischen ${min} und ${max} sein.`);
  }
  return value;
}

function csvSet(value, fallback, { stripLeadingDot = false } = {}) {
  return new Set(
    String(value || fallback.join(","))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        (stripLeadingDot ? item.replace(/^\./, "") : item).toLocaleLowerCase("de")
      )
  );
}

export function loadConfig() {
  const secret = String(process.env.NAS_SCANNER_SECRET || "").trim();
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("NAS_SCANNER_SECRET fehlt oder ist kürzer als 32 Zeichen.");
  }

  return Object.freeze({
    host: "0.0.0.0",
    port: integerFromEnv("PORT", 43138, 1, 65535),
    secret,
    libraryPath: String(process.env.NAS_LIBRARY_PATH || "/media").trim(),
    libraryName: String(process.env.NAS_LIBRARY_NAME || "1337").trim() || "1337",
    dataPath:
      String(process.env.NAS_SCANNER_DATA_PATH || "/data/library-scan.json").trim() ||
      "/data/library-scan.json",
    videoExtensions: csvSet(
      process.env.NAS_VIDEO_EXTENSIONS,
      DEFAULT_VIDEO_EXTENSIONS,
      { stripLeadingDot: true }
    ),
    ignoredDirectories: csvSet(
      process.env.NAS_IGNORED_DIRECTORIES,
      DEFAULT_IGNORED_DIRECTORIES
    ),
    maxFiles: integerFromEnv("NAS_SCANNER_MAX_FILES", 50000, 1000, 250000),
    maxDepth: integerFromEnv("NAS_SCANNER_MAX_DEPTH", 24, 1, 100),
    maxRequestsPerMinute: integerFromEnv(
      "NAS_SCANNER_MAX_REQUESTS_PER_MINUTE",
      12,
      1,
      120
    ),
  });
}

export const scannerDefaults = {
  videoExtensions: DEFAULT_VIDEO_EXTENSIONS,
  ignoredDirectories: DEFAULT_IGNORED_DIRECTORIES,
};
