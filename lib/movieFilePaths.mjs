export const PUBLIC_VIDEO_BASE = "https://video.my1337.de/";
export const LEGACY_VIDEO_HOST = "192.168.178.58";

export function normalizeMovieFileUrl(value) {
  const trimmedValue = String(value || "").trim();
  if (!trimmedValue) return null;

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.hostname === LEGACY_VIDEO_HOST) {
      return new URL(
        `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
        PUBLIC_VIDEO_BASE
      ).toString();
    }

    return parsedUrl.toString();
  } catch {
    return new URL(
      trimmedValue.replace(/^\/+/, ""),
      PUBLIC_VIDEO_BASE
    ).toString();
  }
}

export function movieFileUrlKey(value) {
  const normalizedUrl = normalizeMovieFileUrl(value);
  if (!normalizedUrl) return "";

  try {
    const parsedUrl = new URL(normalizedUrl);
    const normalizedPath = parsedUrl.pathname
      .replace(/\/{2,}/g, "/")
      .replace(/%[0-9a-f]{2}/gi, (match) => match.toUpperCase())
      .replace(/\/$/, "");

    return `${parsedUrl.hostname.toLocaleLowerCase("en-US")}${normalizedPath}`;
  } catch {
    return normalizedUrl;
  }
}

export function hasExactVideoFile(value) {
  const normalizedUrl = normalizeMovieFileUrl(value);
  if (!normalizedUrl) return false;

  try {
    return /\.mp4$/i.test(new URL(normalizedUrl).pathname);
  } catch {
    return /\.mp4(?:[?#]|$)/i.test(normalizedUrl);
  }
}

export function encodeVideoPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function normalizeFolderName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function resolveSelectedVideoUrl({
  relativePath,
  rootName,
  actorNames = [],
}) {
  const actorFolders = new Set(actorNames.map(normalizeFolderName));
  const includeRoot = actorFolders.has(normalizeFolderName(rootName));
  const path = includeRoot ? `${rootName}/${relativePath}` : relativePath;

  return new URL(encodeVideoPath(path), PUBLIC_VIDEO_BASE).toString();
}
