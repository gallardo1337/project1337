import { NextResponse } from "next/server";
import { createServerSupabase, hasLibrarySession } from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

const response = (body, status = 200) => NextResponse.json(body, {
  status,
  headers: { "Cache-Control": "no-store" },
});

export async function POST(request) {
  if (!(await hasLibrarySession())) return response({ error: "Unauthorized" }, 401);
  const host = request.headers.get("host") || "";
  if (process.env.NODE_ENV === "production" && host !== "beta.my1337.de") {
    return response({ error: "Beta only" }, 403);
  }

  try {
    const body = await request.json();
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
  if (!(await hasLibrarySession())) return response({ error: "Unauthorized" }, 401);
  try {
    const days = [1, 7, 30].includes(Number(new URL(request.url).searchParams.get("days")))
      ? Number(new URL(request.url).searchParams.get("days")) : 7;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const supabase = createServerSupabase();
    const events = [];
    for (let offset = 0; offset < 50000; offset += 1000) {
      const { data, error } = await supabase.from("beta_analytics_events")
        .select("created_at,platform,event_type,visitor_id,country,path")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .range(offset, offset + 999);
      if (error) throw error;
      events.push(...(data || []));
      if (!data || data.length < 1000) break;
    }

    const platforms = ["web", "tvos"].map((platform) => {
      const records = events.filter((event) => event.platform === platform);
      return {
        platform,
        visitors: new Set(records.map((event) => event.visitor_id)).size,
        pageViews: records.filter((event) => event.event_type === "page_view").length,
        filmStarts: records.filter((event) => event.event_type === "movie_play").length,
      };
    });
    const countries = Object.entries(events.reduce((counts, event) => {
      if (event.country) counts[event.country] = (counts[event.country] || 0) + 1;
      return counts;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([country, count]) => ({ country, count }));
    const daily = Object.entries(events.reduce((counts, event) => {
      const date = event.created_at.slice(0, 10);
      counts[date] = (counts[date] || 0) + 1;
      return counts;
    }, {})).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    return response({ days, platforms, countries, daily, truncated: events.length >= 50000 });
  } catch (error) {
    console.error("Beta analytics report failed", error);
    return response({ error: "Statistik konnte nicht geladen werden" }, 500);
  }
}
