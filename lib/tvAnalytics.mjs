import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const ANALYTICS_COOKIE = "beta_analytics_session";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function issueAnalyticsSession(secret, now = Date.now()) {
  const payload = `${randomUUID()}.${Math.floor(now / 1000) + 7 * 86400}`;
  return `${payload}.${createHmac("sha256", secret).update(`beta-analytics:${payload}`).digest("hex")}`;
}
export function verifyAnalyticsSession(token, secret, now = Date.now()) {
  if (!secret || typeof token !== "string") return null;
  const [id, expiry, signature, extra] = token.split(".");
  if (extra || !uuid.test(id) || !/^\d{10}$/.test(expiry) || Number(expiry) <= now / 1000 || !/^[a-f0-9]{64}$/.test(signature || "")) return null;
  const expected = createHmac("sha256", secret).update(`beta-analytics:${id}.${expiry}`).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? id : null;
}

export function normalizeTVEvent(body, now = Date.now()) {
  const types = ["app_open", "session_start", "screen_view", "movie_play", "movie_complete"];
  if (body?.platform !== "tvos" || !types.includes(body.event) ||
      ![body.eventId, body.visitorId, body.sessionId].every(value => typeof value === "string" && uuid.test(value))) return null;
  const timestamp = Date.parse(body.timestamp);
  if (!Number.isFinite(timestamp) || timestamp > now + 5 * 60000 || timestamp < now - 7 * 86400000) return null;
  if (![body.appVersion, body.osVersion].every(value => typeof value === "string" && /^[\w.() -]{1,64}$/.test(value))) return null;
  const screen = body.screen ?? null;
  const movie = body.movieId ?? null;
  if (body.event === "screen_view" && !["home", "performer", "movie"].includes(screen)) return null;
  if (["movie_play", "movie_complete"].includes(body.event) && screen !== "player") return null;
  if (["app_open", "session_start"].includes(body.event) && (screen !== null || movie !== null)) return null;
  const needsMovie = screen === "movie" || screen === "player";
  if (needsMovie ? (typeof movie !== "string" || !uuid.test(movie)) : movie !== null) return null;
  return {
    platform: "tvos", event_type: body.event, event_id: body.eventId.toLowerCase(),
    visitor_id: body.visitorId.toLowerCase(), session_id: body.sessionId.toLowerCase(),
    occurred_at: new Date(timestamp).toISOString(), app_version: body.appVersion,
    os_version: body.osVersion, screen_type: screen, movie_id: movie?.toLowerCase() ?? null,
    path: screen ? `/tvos/${screen}` : "/tvos",
  };
}

// Early per-instance protection; the DB RPC also enforces a distributed, atomic quota.
const windows = new Map();
export function allowTVRequest(key, now = Date.now()) {
  for (const [id, value] of windows) if (value.until <= now) windows.delete(id);
  const bucket = windows.get(key) || { until: now + 60000, count: 0 };
  if (windows.size >= 10000 && !windows.has(key)) return false;
  bucket.count += 1;
  windows.set(key, bucket);
  return bucket.count <= 120;
}

export function summarizeAnalytics(events, platform = "all") {
  const platforms = ["web", "tvos"].map(platform => {
    const records = events.filter(event => event.platform === platform);
    const count = type => records.filter(event => event.event_type === type).length;
    return { platform, visitors: new Set(records.map(event => event.visitor_id)).size,
      pageViews: count("page_view") + count("screen_view"), filmStarts: count("movie_play"),
      sessions: new Set(records.map(event => event.session_id).filter(Boolean)).size,
      appOpens: count("app_open"), movieViews: records.filter(event => event.event_type === "screen_view" && event.screen_type === "movie").length,
      completions: count("movie_complete") };
  });
  const selected = events.filter(event => platform === "all" || event.platform === platform);
  const countryVisitors = new Map();
  for (const event of selected) {
    if (!event.country || !event.visitor_id) continue;
    if (!countryVisitors.has(event.country)) countryVisitors.set(event.country, new Set());
    // Installations/browser IDs belong to their platform, not a cross-platform person.
    countryVisitors.get(event.country).add(`${event.platform}:${event.visitor_id}`);
  }
  const countries = [...countryVisitors].map(([country, visitors]) => ({ country, count: visitors.size }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country)).slice(0, 10);
  const daily = Object.entries(selected.reduce((counts, event) => {
    const date = (event.occurred_at || event.created_at).slice(0, 10);
    counts[date] = (counts[date] || 0) + 1;
    return counts;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  return { platforms, countries, daily };
}
