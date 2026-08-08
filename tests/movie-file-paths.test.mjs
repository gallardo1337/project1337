import assert from "node:assert/strict";
import test from "node:test";

import {
  hasExactVideoFile,
  movieFileUrlKey,
  normalizeMovieFileUrl,
  resolveSelectedVideoUrl,
} from "../lib/movieFilePaths.mjs";

test("legacy NAS URLs are normalized to the public video host", () => {
  assert.equal(
    normalizeMovieFileUrl("http://192.168.178.58/Madison%20Ivy/Film.mp4"),
    "https://video.my1337.de/Madison%20Ivy/Film.mp4"
  );
});

test("bare NAS paths become public video URLs", () => {
  assert.equal(
    normalizeMovieFileUrl("Madison Ivy/Film 01.mp4"),
    "https://video.my1337.de/Madison%20Ivy/Film%2001.mp4"
  );
});

test("equivalent encoded paths share one duplicate key", () => {
  assert.equal(
    movieFileUrlKey("Madison Ivy/Film 01.mp4"),
    movieFileUrlKey("https://video.my1337.de/Madison%20Ivy/Film%2001.mp4")
  );
});

test("same filenames in different actor folders stay distinct", () => {
  assert.notEqual(
    movieFileUrlKey("Madison Ivy/Film.mp4"),
    movieFileUrlKey("Angela White/Film.mp4")
  );
});

test("selected actor folder is retained in the generated URL", () => {
  assert.equal(
    resolveSelectedVideoUrl({
      relativePath: "Madison_Ivy_01.mp4",
      rootName: "Madison Ivy",
      actorNames: ["Madison Ivy", "Angela White"],
    }),
    "https://video.my1337.de/Madison%20Ivy/Madison_Ivy_01.mp4"
  );
});

test("collection roots are not duplicated in the generated URL", () => {
  assert.equal(
    resolveSelectedVideoUrl({
      relativePath: "Madison Ivy/4K/Film.mp4",
      rootName: "Movies",
      actorNames: ["Madison Ivy"],
    }),
    "https://video.my1337.de/Madison%20Ivy/4K/Film.mp4"
  );
});

test("exact MP4 paths are distinguished from folder paths", () => {
  assert.equal(hasExactVideoFile("Madison Ivy/Film.mp4?download=1"), true);
  assert.equal(hasExactVideoFile("Madison Ivy/4K/"), false);
});
