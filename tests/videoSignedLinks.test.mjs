import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { signVideoUrl, VIDEO_LINK_LIFETIME_SECONDS } from "../lib/videoSignedLinks.mjs";

const secret = "0123456789abcdef0123456789abcdef";
const now = Date.UTC(2026, 10, 10, 12);

test("signing matches nginx secure_link_md5 including decoded unicode paths", () => {
  const result = new URL(signVideoUrl("https://video.my1337.de/Ordner%20mit%20Leerzeichen/%C3%84pfel.mp4", secret, now));
  const expires = Math.floor(now / 1000) + VIDEO_LINK_LIFETIME_SECONDS;
  const expected = createHash("md5").update(`${expires}/Ordner mit Leerzeichen/Äpfel.mp4 ${secret}`).digest("base64url");
  assert.equal(result.searchParams.get("expires"), String(expires));
  assert.equal(result.searchParams.get("md5"), expected);
  assert.equal(result.hostname, "video.my1337.de");
});

test("invalid hosts, links and secrets are refused", () => {
  for (const url of [
    "http://video.my1337.de/movie.mp4",
    "https://evil.example/movie.mp4",
    "https://video.my1337.de/movie.mp4?md5=old",
    "https://video.my1337.de/a%2Fb.mp4",
  ]) assert.throws(() => signVideoUrl(url, secret, now));
  assert.throws(() => signVideoUrl("https://video.my1337.de/movie.mp4", "short", now));
});
