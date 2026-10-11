import assert from "node:assert/strict";
import test from "node:test";

import { scoreAiFrame } from "../lib/thumbnailAiScoring.mjs";

function faceAt({ left = 0.35, top = 0.25, width = 0.3, height = 0.35 } = {}) {
  return [
    { x: left, y: top, z: 0 },
    { x: left + width, y: top, z: 0 },
    { x: left + width, y: top + height, z: 0 },
    { x: left, y: top + height, z: 0 },
  ];
}

function blinkClassification(score) {
  return {
    categories: [
      { categoryName: "eyeBlinkLeft", score },
      { categoryName: "eyeBlinkRight", score },
    ],
  };
}

test("sichtbare Gesichter erhalten einen deutlichen Inhaltsbonus", () => {
  const withoutFace = scoreAiFrame({ technicalScore: 0.8 });
  const withFace = scoreAiFrame({
    technicalScore: 0.8,
    faceLandmarks: [faceAt()],
    faceBlendshapes: [blinkClassification(0.05)],
  });

  assert.ok(withFace.score > withoutFace.score + 0.2);
  assert.equal(withFace.faceCount, 1);
});

test("angeschnittene Randgesichter werden schlechter bewertet", () => {
  const centered = scoreAiFrame({
    technicalScore: 0.8,
    faceLandmarks: [faceAt()],
    faceBlendshapes: [blinkClassification(0.05)],
  });
  const cropped = scoreAiFrame({
    technicalScore: 0.8,
    faceLandmarks: [faceAt({ left: -0.08, top: 0.18 })],
    faceBlendshapes: [blinkClassification(0.05)],
  });

  assert.ok(centered.score > cropped.score);
  assert.ok(centered.framingScore > cropped.framingScore);
  assert.equal(centered.hasFullyVisibleFace, true);
  assert.equal(cropped.hasFullyVisibleFace, false);
});

test("kleine oder knapp am Rand liegende Gesichter gelten nicht als vollständig sichtbar", () => {
  const tooSmall = scoreAiFrame({
    technicalScore: 0.9,
    faceLandmarks: [faceAt({ width: 0.05, height: 0.08 })],
  });
  const tooCloseToEdge = scoreAiFrame({
    technicalScore: 0.9,
    faceLandmarks: [faceAt({ left: 0.01 })],
  });

  assert.equal(tooSmall.hasFullyVisibleFace, false);
  assert.equal(tooCloseToEdge.hasFullyVisibleFace, false);
});

test("geschlossene Augen sind ein weicher und kein harter Ausschluss", () => {
  const openEyes = scoreAiFrame({
    technicalScore: 0.8,
    faceLandmarks: [faceAt()],
    faceBlendshapes: [blinkClassification(0.04)],
  });
  const closedEyes = scoreAiFrame({
    technicalScore: 0.8,
    faceLandmarks: [faceAt()],
    faceBlendshapes: [blinkClassification(0.92)],
  });

  assert.ok(openEyes.score > closedEyes.score);
  assert.ok(openEyes.score - closedEyes.score < 0.11);
  assert.ok(closedEyes.score > 0.5);
});
