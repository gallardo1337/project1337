import { createHash } from "node:crypto";

export const VIDEO_LINK_LIFETIME_SECONDS = 4 * 60 * 60;
const VIDEO_HOST = "video.my1337.de";

// Matches nginx: secure_link_md5 "$secure_link_expires$uri SHARED_SECRET".
// Nginx's $uri is the normalized, decoded path, not the percent-encoded URL.
export function signVideoUrl(fileUrl, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("VIDEO_SIGNING_SECRET must contain at least 32 characters");
  }
  if (typeof fileUrl !== "string") throw new Error("Invalid media URL");
  const url = new URL(fileUrl);
  if (url.protocol !== "https:" || url.hostname !== VIDEO_HOST ||
      url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("Media URL must use the approved host without query parameters");
  }

  if (/%2f|%5c|%00/i.test(url.pathname)) throw new Error("Invalid escaped path");
  const nginxPath = decodeURIComponent(url.pathname);
  if (!nginxPath.startsWith("/") || nginxPath.includes("\\") ||
      nginxPath.includes("\0") || nginxPath.includes("//") ||
      nginxPath.split("/").some(part => part === "." || part === "..")) {
    throw new Error("Invalid media path");
  }

  const expires = Math.floor(now / 1000) + VIDEO_LINK_LIFETIME_SECONDS;
  const digest = createHash("md5")
    .update(`${expires}${nginxPath} ${secret}`, "utf8")
    .digest("base64url");
  url.searchParams.set("md5", digest);
  url.searchParams.set("expires", String(expires));
  return url.toString();
}
