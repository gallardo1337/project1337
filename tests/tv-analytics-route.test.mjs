import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { randomUUID } from 'node:crypto';
let authenticated = true, signed = true, rpcResult = 'ok', stored = [];
const supabase = { rpc: async (name, args) => { assert.equal(name, 'record_beta_tv_event'); stored.push(args); return { data: rpcResult }; } };
globalThis.__tvAnalyticsRoute = { authenticated: () => authenticated, signed: () => signed ? '00000000-0000-0000-0000-000000000001' : null, supabase };
const stubs = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) };',
  '../../../lib/serverSupabase': 'export const hasLibrarySession = async () => globalThis.__tvAnalyticsRoute.authenticated(); export const analyticsSessionID = async () => globalThis.__tvAnalyticsRoute.signed(); export const createServerSupabase = () => globalThis.__tvAnalyticsRoute.supabase;'
};
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier in stubs) return { url: 'data:text/javascript,' + encodeURIComponent(stubs[specifier]), shortCircuit: true };
  return next(specifier, context);
} });
const { POST, GET } = await import('../app/api/beta-analytics/route.js');
hooks.deregister();
const native = () => ({ platform:'tvos',event:'movie_play',eventId:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),timestamp:new Date().toISOString(),appVersion:'1.0',osVersion:'26.2',screen:'player',movieId:randomUUID() });
const request = (body, host = 'beta.my1337.de') => new Request(`https://${host}/api/beta-analytics`, { method:'POST', headers:{host,'content-type':'application/json','x-vercel-ip-country':'DE'}, body: JSON.stringify(body) });
test('route requires both login and signed TV session', async () => {
  authenticated = false; assert.equal((await POST(request(native()))).status,401);
  authenticated = true; signed = false; assert.equal((await POST(request(native()))).status,401); signed = true;
});
test('native request reaches RPC with whitelisted country and event', async () => {
  stored = []; const body = native();
  assert.equal((await POST(request(body))).status,200);
  assert.equal(stored[0].p_event.event_id,body.eventId);
  assert.equal(stored[0].p_event.country,'DE');
  for (const [result,status] of [['duplicate',200],['invalid_movie',400],['rate_limited',429]]) {
    rpcResult=result; assert.equal((await POST(request(native()))).status,status);
  }
  rpcResult='ok';
});
test('invalid JSON and oversized bodies are rejected before database access', async () => {
  const count = stored.length;
  assert.equal((await POST(new Request('https://beta.my1337.de/api/beta-analytics',{method:'POST',body:'{'}))).status,400);
  assert.equal((await POST(request({ ...native(), padding:'x'.repeat(4096) }))).status,413);
  assert.equal(stored.length,count);
});
test('unrelated production hosts are rejected for reads and writes', async () => {
  const before = process.env.NODE_ENV; process.env.NODE_ENV='production';
  try {
    assert.equal((await POST(request(native(),'unrelated.example'))).status,403);
    assert.equal((await GET(new Request('https://unrelated.example/api/beta-analytics',{headers:{host:'unrelated.example'}}))).status,403);
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=before; }
});

test('main and beta domains accept authenticated events in production', async () => {
  const before = process.env.NODE_ENV; process.env.NODE_ENV='production';
  try {
    for (const host of ['my1337.de', 'www.my1337.de', 'beta.my1337.de']) {
      assert.equal((await POST(request(native(), host))).status,200);
    }
  } finally { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV=before; }
});
