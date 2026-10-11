const POST_ID_PATTERNS = [
  /\bid\s*=\s*["']post[_-]?(\d+)["']/gi,
  /\bname\s*=\s*["']post[_-]?(\d+)["']/gi,
  /\bdata-post-id\s*=\s*["'](\d+)["']/gi,
  /\bdata-postid\s*=\s*["'](\d+)["']/gi,
];

export function extractLatestPostId(html) {
  if (typeof html !== "string" || !html) return null;

  let latest = null;
  for (const pattern of POST_ID_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of html.matchAll(pattern)) {
      const candidate = match[1];
      if (!candidate || !/^\d+$/.test(candidate)) continue;
      if (latest === null || BigInt(candidate) > BigInt(latest)) {
        latest = candidate;
      }
    }
  }

  return latest;
}

export function comparePostIds(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return -1;
  if (right == null) return 1;

  const a = BigInt(String(left));
  const b = BigInt(String(right));
  return a === b ? 0 : a > b ? 1 : -1;
}

export function observePostId(previous, latestPostId, checkedAt = Date.now()) {
  const latest = String(latestPostId);
  if (!previous?.maxPostId) {
    return {
      maxPostId: latest,
      readThroughPostId: latest,
      checkedAt,
      error: null,
    };
  }

  const isHigher = comparePostIds(latest, previous.maxPostId) > 0;
  return {
    ...previous,
    maxPostId: isHigher ? latest : previous.maxPostId,
    checkedAt,
    error: null,
  };
}

export function hasUnreadPost(state) {
  return Boolean(
    state?.maxPostId &&
      comparePostIds(state.maxPostId, state.readThroughPostId) > 0
  );
}

export function markPostsRead(state) {
  if (!state?.maxPostId) return state;
  return { ...state, readThroughPostId: state.maxPostId };
}
