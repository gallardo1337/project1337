import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { normalizeTVEvent, summarizeAnalytics, issueAnalyticsSession, verifyAnalyticsSession, allowTVRequest } from '../lib/tvAnalytics.mjs';
const now = Date.now();
const event = () => ({ platform: 'tvos', event: 'screen_view', eventId: randomUUID(), visitorId: randomUUID(), sessionId: randomUUID(), timestamp: new Date(now).toISOString(), appVersion: '1.0', osVersion: '26.2', screen: 'movie', movieId: randomUUID() });

test('accepts all five native events with their actual wire contract', () => {
  for (const type of ['app_open', 'session_start', 'screen_view', 'movie_play', 'movie_complete']) {
    const body = event(); body.event = type;
    if (type === 'app_open' || type === 'session_start') { delete body.screen; delete body.movieId; }
    if (type.startsWith('movie_')) body.screen = 'player';
    assert.equal(normalizeTVEvent(body, now).event_type, type);
  }
});
test('rejects invalid identifiers, clock drift, metadata and screen/event mismatch', () => {
  for (const patch of [{ movieId: 'injected' }, { movieId: [randomUUID()] }, { visitorId: '-'.repeat(36) }, { eventId: null }, { timestamp: 'bad' }, { timestamp: new Date(now + 3600000).toISOString() }, { timestamp: new Date(now - 8 * 86400000).toISOString() }, { event: 'page_view' }, { event: 'movie_play', screen: 'movie' }, { screen: 'home' }, { appVersion: 'a'.repeat(65) }]) {
    assert.equal(normalizeTVEvent({ ...event(), ...patch }, now), null);
  }
});
test('normalization whitelists data, discarding tokens and client country', () => {
  const row = normalizeTVEvent({ ...event(), token: 'secret', password: 'secret', country: 'US', ip: '127.0.0.1' }, now);
  for (const key of ['token', 'password', 'country', 'ip']) assert.equal(row[key], undefined);
});
test('signed sessions reject forgery, expiration and altered signatures', () => {
  const token = issueAnalyticsSession('test-secret', now);
  assert.ok(verifyAnalyticsSession(token, 'test-secret', now));
  assert.equal(verifyAnalyticsSession(token, 'other-secret', now), null);
  assert.equal(verifyAnalyticsSession(token, 'test-secret', now + 8 * 86400000), null);
  assert.equal(verifyAnalyticsSession('ok', 'test-secret', now), null);
  assert.equal(verifyAnalyticsSession(token + 'x', 'test-secret', now), null);
});
test('early request limiter is bounded and resets', () => {
  const id = randomUUID();
  for (let i = 0; i < 120; i++) assert.equal(allowTVRequest(id, now), true);
  assert.equal(allowTVRequest(id, now), false);
  assert.equal(allowTVRequest(id, now + 60001), true);
});
test('TV events do not alter Web counts; platform filtering and sessions work', () => {
  const base = { created_at: '2026-11-07T10:00:00Z', country: 'DE' };
  const web = [{ ...base, platform: 'web', visitor_id: 'web1', event_type: 'page_view' }, { ...base, platform: 'web', visitor_id: 'web1', event_type: 'movie_play' }];
  const tv = ['app_open','session_start','screen_view','movie_play','movie_complete'].map(event_type => ({ ...base, platform: 'tvos', visitor_id: 'tv1', session_id: 's1', event_type, screen_type: 'movie' }));
  const summary = summarizeAnalytics([...web, ...tv]);
  assert.deepEqual(summary.platforms[0], summarizeAnalytics(web).platforms[0]);
  assert.deepEqual(summary.platforms[1], { platform: 'tvos', visitors: 1, pageViews: 1, filmStarts: 1, sessions: 1, appOpens: 1, movieViews: 1, completions: 1 });
  assert.equal(summarizeAnalytics([...web, ...tv], 'web').daily[0].count, 2);
  assert.equal(summarizeAnalytics([...web, ...tv], 'tvos').countries[0].count, 1);
});

test('countries deduplicate visits across events, sessions and days within each platform', () => {
  const event = { platform: 'tvos', visitor_id: 'same', country: 'DE', event_type: 'app_open', created_at: '2026-11-08T10:00:00Z' };
  const events = [event, { ...event, event_type: 'movie_play' },
    { ...event, session_id: 'new', created_at: '2026-11-09T10:00:00Z' },
    { ...event, visitor_id: 'second' }, { ...event, platform: 'web' },
    { ...event, country: 'AT' }, { ...event, country: null }];
  assert.deepEqual(summarizeAnalytics(events, 'tvos').countries, [{ country: 'DE', count: 2 }, { country: 'AT', count: 1 }]);
  assert.deepEqual(summarizeAnalytics(events, 'web').countries, [{ country: 'DE', count: 1 }]);
  assert.deepEqual(summarizeAnalytics(events).countries, [{ country: 'DE', count: 3 }, { country: 'AT', count: 1 }]);
  assert.equal(summarizeAnalytics(events).daily.reduce((sum, day) => sum + day.count, 0), events.length);
});
