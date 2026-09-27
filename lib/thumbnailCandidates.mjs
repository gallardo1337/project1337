export function appendThumbnailCandidate(current, candidate, unlockedLimit = 12) {
  const candidates = [...current, candidate];
  const removed = [];

  while (candidates.filter((item) => !item.locked).length > unlockedLimit) {
    const oldestUnlockedIndex = candidates.findIndex((item) => !item.locked);
    if (oldestUnlockedIndex < 0) break;
    removed.push(candidates.splice(oldestUnlockedIndex, 1)[0]);
  }

  return { candidates, removed };
}
