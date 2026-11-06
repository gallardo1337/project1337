import test from "node:test";
import assert from "node:assert/strict";
import { mediaUrl } from "../lib/mediaUrl.mjs";

test("legacy image and upload URLs retain their path and query on the media host", () => {
  assert.equal(mediaUrl("https://gallardo1337.io/uploads/movies/a%20b.jpg?v=2"), "https://media.gallardo1337.io/uploads/movies/a%20b.jpg?v=2");
  assert.equal(mediaUrl("http://www.gallardo1337.io/upload.php"), "https://media.gallardo1337.io/upload.php");
});
test("new URLs are stable and unrelated hosts and non-HTTP values are unchanged", () => {
  for (const value of [undefined, null, "", "/uploads/a.jpg", "https://media.gallardo1337.io/uploads/a.jpg", "https://gallardo1337.io.example.org/a.jpg", "https://example.org/a.jpg", "ftp://gallardo1337.io/a.jpg"]) {
    assert.equal(mediaUrl(value), value);
  }
});
