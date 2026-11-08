import { normalizeTVEvent, allowTVRequest, summarizeAnalytics } from "../../../lib/tvAnalytics.mjs";
import { NextResponse } from "next/server";
import { createServerSupabase, hasLibrarySession, analyticsSessionID } from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
const ANALYTICS_HOSTS = new Set(["my1337.de", "www.my1337.de", "beta.my1337.de"]);

const response = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function POST(request) {
  if (!(await hasLibrarySession())) return response({ error: "Unauthorized" }, 401);
  const host = request.headers.get("host") || "";
  if (process.env.NODE_ENV === "production" && !ANALYTICS_HOSTS.has(host)) {
    return response({ error: "Host not allowed" }, 403);
  }

  try {
    if (Number(request.headers.get("content-length")) > 4096) return response({ error: "Zu groß" }, 413);
    // Stream limit also covers chunked requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return response({ error: "Leeres Ereignis" }, 400);
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return response({ error: "Zu groß" }, 413); }
      chunks.push(Buffer.from(value));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return response({ error: "Ungültiges JSON" }, 400); }
    if (body?.platform === "tvos") {
      const authSession = await analyticsSessionID();
      if (!authSession) return response({ error: "Bitte erneut in Beta anmelden" }, 401);
      if (!allowTVRequest(authSession)) return response({ error: "Zu viele Ereignisse" }, 429);
      const event = normalizeTVEvent(body);
      if (!event) return response({ error: "Ungültiges tvOS-Ereignis" }, 400);
      const country = request.headers.get("x-vercel-ip-country") || "";
      event.country = /^[A-Z]{2}$/.test(country) ? country : null;
      // RPC serializes quota + insert, validates the movie and ignores repeated event IDs.
      const { data, error } = await createServerSupabase().rpc("record_beta_tv_event", {
        p_event: event, p_auth_session: authSession,
      });
      if (error) throw error;
      if (data === "rate_limited") return response({ error: "Zu viele Ereignisse" }, 429);
      if (data === "invalid_movie") return response({ error: "Film nicht gefunden" }, 400);
      return response({ ok: true });
    }
    if (!["web", "tvos"].includes(body?.platform) ||
        !["page_view", "movie_play"].includes(body?.event) ||
        !/^[0-9a-f-]{36}$/i.test(body.visitorId || "")) {
      return response({ error: "Ungültiges Ereignis" }, 400);
    }
    const path = String(body.path || "/").slice(0, 180);
    if (!path.startsWith("/") || path.startsWith("//")) return response({ error: "Ungültiger Pfad" }, 400);

    const { error } = await createServerSupabase().from("beta_analytics_events").insert({
      platform: body.platform,
      event_type: body.event,
      visitor_id: body.visitorId,
      path,
      country: (request.headers.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase() || null,
    });
    if (error) throw error;
    return response({ ok: true });
  } catch (error) {
    console.error("Beta analytics event failed", error);
    return response({ error: "Ereignis konnte nicht gespeichert werden" }, 500);
  }
}

export async function GET(request) {
  if (process.env.NODE_ENV === "production" && !ANALYTICS_HOSTS.has(request.headers.get("host"))) {
    return response({ error: "Host not allowed" }, 403);
  }
  if (!(await hasLibrarySession())) return response({ error: "Unauthorized" }, 401);
  try {
    const days = [1, 7, 30].includes(Number(new URL(request.url).searchParams.get("days")))
      ? Number(new URL(request.url).searchParams.get("days")) : 7;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const supabase = createServerSupabase();
    const events = [];
    let truncated = false;
    for (const sourcePlatform of ["web", "tvos"]) {
      for (let offset = 0; offset < 50000; offset += 1000) {
        const { data, error } = await supabase.from("beta_analytics_events")
          .select("created_at,occurred_at,platform,event_type,visitor_id,session_id,screen_type,country,path")
          .eq("platform", sourcePlatform)
          .gte("created_at", cutoff)
          .order("created_at", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        events.push(...(data || []).filter(event => (event.occurred_at || event.created_at) >= cutoff));
        if (offset === 49000 && data?.length === 1000) truncated = true;
        if (!data || data.length < 1000) break;
      }
    }
    const platform = new URL(request.url).searchParams.get("platform") || "all";
    return response({ days, ...summarizeAnalytics(events, platform), truncated });
  } catch (error) {
    console.error("Beta analytics report failed", error);
    return response({ error: "Statistik konnte nicht geladen werden" }, 500);
  }
}
