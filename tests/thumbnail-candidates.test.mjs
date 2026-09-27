import assert from "node:assert/strict";
import test from "node:test";

import {
  appendThumbnailCandidate,
  clearUnlockedThumbnailCandidates,
} from "../lib/thumbnailCandidates.mjs";

test("gesperrte Vorschläge bleiben erhalten und verdrängen die ältesten freien Vorschläge", () => {
  const locked = { id: "locked", locked: true };
  const first = { id: "first", locked: false };
  const second = { id: "second", locked: false };
  const newest = { id: "newest", locked: false };

  const result = appendThumbnailCandidate([locked, first, second], newest, 2);

  assert.deepEqual(
    result.candidates.map((candidate) => candidate.id),
    ["locked", "second", "newest"]
  );
  assert.deepEqual(result.removed.map((candidate) => candidate.id), ["first"]);
});

test("gesperrte Vorschläge bleiben auch bei mehr als zwölf Einträgen bestehen", () => {
  const locked = Array.from({ length: 13 }, (_, index) => ({
    id: `locked-${index}`,
    locked: true,
  }));
  const unlocked = { id: "new", locked: false };

  const result = appendThumbnailCandidate(locked, unlocked, 12);

  assert.equal(result.candidates.length, 14);
  assert.equal(result.candidates.filter((candidate) => candidate.locked).length, 13);
  assert.deepEqual(result.removed, []);
});

test("Auswahl leeren entfernt freie Vorschläge und behält gesperrte", () => {
  const locked = { id: "locked", locked: true };
  const unlocked = { id: "unlocked", locked: false };

  const result = clearUnlockedThumbnailCandidates([locked, unlocked]);

  assert.deepEqual(result.candidates, [locked]);
  assert.deepEqual(result.removed, [unlocked]);
});
