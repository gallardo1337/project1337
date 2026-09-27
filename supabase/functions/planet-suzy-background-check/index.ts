import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function normalizeThreadUrl(value: unknown): URL | null {
  try {
    const url = new URL(String(value || ""));
    if (!["www.planetsuzy.org", "planetsuzy.org"].includes(url.hostname.toLowerCase()) ||
        url.username || url.password || !/^\/t\d+/i.test(url.pathname)) return null;
    url.protocol = "https:";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function extractLatestPostId(html: string): string | null {
  const patterns = [
    /\bid\s*=\s*["']post[_-]?(\d+)["']/gi,
    /\bname\s*=\s*["']post[_-]?(\d+)["']/gi,
    /\bdata-post-id\s*=\s*["'](\d+)["']/gi,
    /\bdata-postid\s*=\s*["'](\d+)["']/gi,
  ];
  let latest: bigint | null = null;
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = BigInt(match[1]);
      if (latest === null || candidate > latest) latest = candidate;
    }
  }
  return latest?.toString() ?? null;
}

function compareIds(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  const a = BigInt(left);
  const b = BigInt(right);
  return a === b ? 0 : a > b ? 1 : -1;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return response({ error: "Server configuration error" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_planet_suzy_update_actor");
  if (claimError) {
    console.error("PlanetSuzy actor claim failed:", claimError.message);
    return response({ error: "Actor could not be claimed" }, 500);
  }
  const actor = claimed?.[0];
  if (!actor) return response({ checked: false, reason: "No actor is due yet" });

  const now = new Date().toISOString();
  const saveError = async (message: string) => {
    const { data: previous } = await supabase
      .from("planet_suzy_update_states")
      .select("max_post_id,read_through_post_id")
      .eq("actor_id", actor.actor_id)
      .maybeSingle();
    await supabase.from("planet_suzy_update_states").upsert({
      actor_id: actor.actor_id,
      max_post_id: previous?.max_post_id ?? null,
      read_through_post_id: previous?.read_through_post_id ?? null,
      checked_at: now,
      last_error: message.slice(0, 500),
      updated_at: now,
    }, { onConflict: "actor_id" });
  };

  const threadUrl = normalizeThreadUrl(actor.thread_url);
  if (!threadUrl) {
    await saveError("Kein gültiger PlanetSuzy-Thread hinterlegt.");
    return response({ checked: true, actorId: actor.actor_id, error: "Invalid thread URL" });
  }

  try {
    const remote = await fetch(threadUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Project1337UpdateCheck/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const finalHost = new URL(remote.url).hostname.toLowerCase();
    if (!["www.planetsuzy.org", "planetsuzy.org"].includes(finalHost)) throw new Error("Unerlaubte Weiterleitung.");
    if (!remote.ok) throw new Error(`PlanetSuzy antwortet mit HTTP ${remote.status}.`);
    if (!(remote.headers.get("content-type") || "").toLowerCase().includes("text/html")) throw new Error("PlanetSuzy hat keine HTML-Seite geliefert.");
    const html = await remote.text();
    if (/site unavailable|unable to access this site/i.test(html)) throw new Error("PlanetSuzy hat eine nicht verfügbare Seite zurückgegeben.");
    const latestPostId = extractLatestPostId(html);
    if (!latestPostId) throw new Error("Die Beitrags-ID konnte nicht erkannt werden.");

    const { data: previous, error: readError } = await supabase
      .from("planet_suzy_update_states")
      .select("max_post_id,read_through_post_id")
      .eq("actor_id", actor.actor_id)
      .maybeSingle();
    if (readError) throw readError;

    const previousMax = previous?.max_post_id ?? null;
    const maxPostId = compareIds(latestPostId, previousMax) > 0 ? latestPostId : previousMax;
    const readThroughPostId = previous?.read_through_post_id ?? (!previousMax ? latestPostId : null);
    const { error: writeError } = await supabase.from("planet_suzy_update_states").upsert({
      actor_id: actor.actor_id,
      max_post_id: maxPostId,
      read_through_post_id: readThroughPostId,
      checked_at: now,
      last_error: null,
      updated_at: now,
    }, { onConflict: "actor_id" });
    if (writeError) throw writeError;
    return response({ checked: true, actorId: actor.actor_id, latestPostId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Beitragsprüfung ist fehlgeschlagen.";
    console.error("PlanetSuzy background check failed:", actor.actor_id, message);
    await saveError(message);
    return response({ checked: true, actorId: actor.actor_id, error: message }, 502);
  }
});
