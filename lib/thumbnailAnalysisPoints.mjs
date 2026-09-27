export const DEFAULT_ANALYSIS_START_RATIO = 0.2;
export const ANALYSIS_END_RATIO = 0.95;

export function createThumbnailAnalysisPoints(
  duration,
  earliestTime = duration * DEFAULT_ANALYSIS_START_RATIO,
  random = Math.random
) {
  const safeDuration = Number(duration);
  if (!Number.isFinite(safeDuration) || safeDuration <= 0) return [];

  const start = Math.max(
    0,
    Math.min(Number(earliestTime) / safeDuration, ANALYSIS_END_RATIO)
  );
  const bandCount = 6;
  const samplesPerBand = 5;
  const bandSize = (ANALYSIS_END_RATIO - start) / bandCount;

  if (!Number.isFinite(start) || bandSize <= 0) return [];

  return Array.from({ length: bandCount }, (_, bandIndex) => {
    const bandStart = start + bandIndex * bandSize;
    const sliceSize = bandSize / samplesPerBand;

    return Array.from({ length: samplesPerBand }, (_, sampleIndex) => ({
      bandIndex,
      point:
        bandStart +
        sliceSize * (sampleIndex + 0.16 + random() * 0.68),
    }));
  }).flat();
}
