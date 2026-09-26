import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";
import { extractLatestPostId } from "../../../../lib/planetSuzyUpdates.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function normalizeThreadUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (
      !["www.planetsuzy.org", "planetsuzy.org"].includes(host) ||
      url.username ||
      url.password ||
      !/^\/t\d+/i.test(url.pathname)
    ) {
      return null;
    }
    url.protocol = "https:";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export async function POST(request) {
  if (!(await hasLibrarySession())) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const actorId = String(body?.actorId || "");
    if (!/^[0-9a-f-]{36}$/i.test(actorId)) {
      return json({ error: "Ungültiger Darsteller." }, 400);
    }

    const supabase = createServerSupabase();
    const { data: actor, error: actorError } = await supabase
      .from("actors")
      .select("id,name,planetsuzy_url")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor) return json({ error: "Darsteller nicht gefunden." }, 404);

    const threadUrl = normalizeThreadUrl(actor.planetsuzy_url);
    if (!threadUrl) {
      return json({ error: "Kein gültiger PlanetSuzy-Thread hinterlegt." }, 422);
    }

    let response;
    try {
      response = await fetch(threadUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(9000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Project1337UpdateCheck/1.0)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (fetchError) {
      console.error("PlanetSuzy thread request failed:", fetchError);
      return json(
        { error: "PlanetSuzy ist gerade nicht erreichbar. Bitte später erneut prüfen." },
        502
      );
    }

    const finalHost = new URL(response.url).hostname.toLowerCase();
    if (!["www.planetsuzy.org", "planetsuzy.org"].includes(finalHost)) {
      return json({ error: "Der Thread wurde auf eine andere Seite weitergeleitet." }, 502);
    }
    if (!response.ok) {
      return json(
        { error: "PlanetSuzy antwortet mit HTTP " + response.status + "." },
        502
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return json({ error: "PlanetSuzy hat keine HTML-Seite geliefert." }, 502);
    }

    const html = await response.text();
    if (/site unavailable|unable to access this site/i.test(html)) {
      return json(
        { error: "PlanetSuzy hat eine nicht verfügbare Seite zurückgegeben." },
        502
      );
    }

    const latestPostId = extractLatestPostId(html);
    if (!latestPostId) {
      return json(
        { error: "Die Beitrags-ID konnte auf dieser Thread-Seite nicht erkannt werden." },
        422
      );
    }

    return json({ actorId: actor.id, actorName: actor.name, latestPostId });
  } catch (error) {
    console.error("PlanetSuzy update check failed:", error);
    return json({ error: "Die Beitragsprüfung ist fehlgeschlagen." }, 500);
  }
}
