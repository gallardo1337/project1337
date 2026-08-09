const clamp = (value, minimum = 0, maximum = 1) =>
  Math.min(maximum, Math.max(minimum, Number(value) || 0));

const POSE_KEYPOINTS = [
  0,
  7,
  8,
  11,
  12,
  13,
  14,
  15,
  16,
  23,
  24,
  25,
  26,
  27,
  28,
];

function getBounds(landmarks) {
  if (!landmarks?.length) return null;

  let minimumX = 1;
  let minimumY = 1;
  let maximumX = 0;
  let maximumY = 0;

  for (const landmark of landmarks) {
    minimumX = Math.min(minimumX, landmark.x);
    minimumY = Math.min(minimumY, landmark.y);
    maximumX = Math.max(maximumX, landmark.x);
    maximumY = Math.max(maximumY, landmark.y);
  }

  return {
    minimumX,
    minimumY,
    maximumX,
    maximumY,
    width: Math.max(0, maximumX - minimumX),
    height: Math.max(0, maximumY - minimumY),
    centerX: (minimumX + maximumX) / 2,
    centerY: (minimumY + maximumY) / 2,
  };
}

function getCenterScore(bounds) {
  if (!bounds) return 0;
  const distance = Math.hypot(
    bounds.centerX - 0.5,
    (bounds.centerY - 0.5) * 0.8
  );
  return clamp(1 - distance / 0.58);
}

function getEdgeScore(bounds, desiredMargin = 0.035) {
  if (!bounds) return 0;
  const edgeMargin = Math.min(
    bounds.minimumX,
    bounds.minimumY,
    1 - bounds.maximumX,
    1 - bounds.maximumY
  );
  return clamp(edgeMargin / desiredMargin);
}

function getFaceMetrics(faceLandmarks = []) {
  return faceLandmarks.map((landmarks, index) => {
    const bounds = getBounds(landmarks);
    const area = bounds ? bounds.width * bounds.height : 0;
    const minimumSizeScore = clamp(area / 0.018);
    const oversizedPenalty = area > 0.42 ? clamp((area - 0.42) / 0.35) : 0;
    const sizeScore = clamp(minimumSizeScore - oversizedPenalty * 0.55);
    const centerScore = getCenterScore(bounds);
    const edgeScore = getEdgeScore(bounds);

    return {
      index,
      area,
      bounds,
      edgeScore,
      centerScore,
      visibilityScore: clamp(
        sizeScore * 0.5 + centerScore * 0.2 + edgeScore * 0.3
      ),
      framingScore: clamp(edgeScore * 0.65 + centerScore * 0.35),
    };
  });
}

function getPoseMetrics(poseLandmarks = []) {
  return poseLandmarks.map((landmarks) => {
    const keypoints = POSE_KEYPOINTS.map((index) => landmarks[index]).filter(
      Boolean
    );
    const visible = keypoints.filter(
      (landmark) => (landmark.visibility ?? 1) >= 0.42
    );
    const inFrame = visible.filter(
      (landmark) =>
        landmark.x >= 0.02 &&
        landmark.x <= 0.98 &&
        landmark.y >= 0.02 &&
        landmark.y <= 0.98
    );
    const bounds = getBounds(visible);
    const visibleRatio = visible.length / Math.max(1, keypoints.length);
    const inFrameRatio = inFrame.length / Math.max(1, visible.length);
    const centerScore = getCenterScore(bounds);
    const edgeScore = getEdgeScore(bounds, 0.025);

    return {
      bounds,
      visibilityScore: clamp(
        visibleRatio * 0.58 + inFrameRatio * 0.22 + centerScore * 0.2
      ),
      framingScore: clamp(
        inFrameRatio * 0.48 + edgeScore * 0.3 + centerScore * 0.22
      ),
    };
  });
}

function getCategoryScore(classification, categoryName) {
  return classification?.categories?.find(
    (category) => category.categoryName === categoryName
  )?.score;
}

function getEyeScore(faceBlendshapes, primaryFaceIndex) {
  if (primaryFaceIndex < 0) return 0.22;

  const classification = faceBlendshapes?.[primaryFaceIndex];
  const leftBlink = getCategoryScore(classification, "eyeBlinkLeft");
  const rightBlink = getCategoryScore(classification, "eyeBlinkRight");

  if (!Number.isFinite(leftBlink) && !Number.isFinite(rightBlink)) return 0.58;

  const measured = [leftBlink, rightBlink].filter(Number.isFinite);
  const blinkScore = measured.reduce((total, value) => total + value, 0) /
    measured.length;
  return clamp(1 - blinkScore * 1.16);
}

export function scoreAiFrame({
  technicalScore,
  faceLandmarks = [],
  faceBlendshapes = [],
  poseLandmarks = [],
}) {
  const faces = getFaceMetrics(faceLandmarks);
  const poses = getPoseMetrics(poseLandmarks);
  const primaryFace = faces.reduce(
    (best, face) =>
      !best || face.visibilityScore > best.visibilityScore ? face : best,
    null
  );
  const bestPose = poses.reduce(
    (best, pose) =>
      !best || pose.visibilityScore > best.visibilityScore ? pose : best,
    null
  );
  const faceScore = primaryFace?.visibilityScore || 0;
  const poseScore = bestPose?.visibilityScore || 0;
  const subjectScore = clamp(
    Math.max(faceScore, poseScore * 0.72) +
      Math.min(faceScore, poseScore) * 0.18 +
      Math.min(0.08, Math.max(0, faces.length - 1) * 0.03)
  );
  const framingScore = primaryFace || bestPose
    ? clamp(
        Math.max(
          primaryFace?.framingScore || 0,
          (bestPose?.framingScore || 0) * 0.9
        )
      )
    : 0.25;
  const eyeScore = getEyeScore(
    faceBlendshapes,
    primaryFace?.index ?? -1
  );
  const normalizedTechnicalScore = clamp(technicalScore);
  const score =
    normalizedTechnicalScore * 0.5 +
    subjectScore * 0.25 +
    framingScore * 0.15 +
    eyeScore * 0.1;

  return {
    score,
    technicalScore: normalizedTechnicalScore,
    subjectScore,
    framingScore,
    eyeScore,
    faceCount: faces.length,
    poseCount: poses.length,
  };
}
