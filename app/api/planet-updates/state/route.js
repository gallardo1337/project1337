import { NextResponse } from "next/server";
import { comparePostIds } from "../../../../lib/planetSuzyUpdates.mjs";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function toClientState(row) {
  return {
    maxPostId: row.max_post_id,
    readThroughPostId: row.read_through_post_id,
    checkedAt: row.checked_at ? Date.parse(row.checked_at) : null,
    error: row.last_error,
  };
}

export async function GET() {
  if (!(await hasLibrarySession())) return json({ error: "Unauthorized" }, 401);

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("planet_suzy_update_states")
      .select("actor_id,max_post_id,read_through_post_id,checked_at,last_error");
    if (error) throw error;

    const states = Object.fromEntries(
      (data || []).map((row) => [row.actor_id, toClientState(row)])
    );
    return json({ states });
  } catch (error) {
    console.error("PlanetSuzy update state load failed:", error);
    return json({ error: "Der online gespeicherte Update-Status konnte nicht geladen werden." }, 500);
  }
}

export async function PUT(request) {
  if (!(await hasLibrarySession())) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await request.json();
    const actorId = String(body?.actorId || "");
    const state = body?.state;
    if (!/^[0-9a-f-]{36}$/i.test(actorId) || !state || typeof state !== "object") {
      return json({ error: "Ungültiger Update-Status." }, 400);
    }

    const maxPostId = state.maxPostId == null ? null : String(state.maxPostId);
    const readThroughPostId = state.readThroughPostId == null
      ? null
      : String(state.readThroughPostId);
    if (
      (maxPostId !== null && !/^\d+$/.test(maxPostId)) ||
      (readThroughPostId !== null && !/^\d+$/.test(readThroughPostId))
    ) {
      return json({ error: "Ungültige Beitrags-ID im Update-Status." }, 400);
    }

    const checkedAtMs = Number(state.checkedAt);
    const checkedAt = Number.isFinite(checkedAtMs) && checkedAtMs > 0
      ? new Date(checkedAtMs).toISOString()
      : null;
    const lastError = typeof state.error === "string" ? state.error.slice(0, 500) : null;
    const supabase = createServerSupabase();

    const { data: currentRow, error: readError } = await supabase
      .from("planet_suzy_update_states")
      .select("max_post_id,read_through_post_id,checked_at,last_error")
      .eq("actor_id", actorId)
      .maybeSingle();
    if (readError) throw readError;

    let mergedMax = currentRow?.max_post_id || null;
    if (maxPostId && (!mergedMax || comparePostIds(maxPostId, mergedMax) > 0)) {
      mergedMax = maxPostId;
    }

    let mergedReadThrough = currentRow?.read_through_post_id || null;
    if (
      readThroughPostId &&
      (!mergedReadThrough || comparePostIds(readThroughPostId, mergedReadThrough) > 0)
    ) {
      mergedReadThrough = readThroughPostId;
    }
    if (mergedMax && mergedReadThrough && comparePostIds(mergedReadThrough, mergedMax) > 0) {
      mergedReadThrough = mergedMax;
    }

    const currentCheckedAt = currentRow?.checked_at ? Date.parse(currentRow.checked_at) : 0;
    const incomingCheckedAt = checkedAt ? Date.parse(checkedAt) : 0;
    const isNewerCheck = incomingCheckedAt >= currentCheckedAt;
    const { data, error } = await supabase
      .from("planet_suzy_update_states")
      .upsert({
        actor_id: actorId,
        max_post_id: mergedMax,
        read_through_post_id: mergedReadThrough,
        checked_at: isNewerCheck ? checkedAt : currentRow.checked_at,
        last_error: isNewerCheck ? lastError : currentRow.last_error,
        updated_at: new Date().toISOString(),
      }, { onConflict: "actor_id" })
      .select("actor_id,max_post_id,read_through_post_id,checked_at,last_error")
      .single();
    if (error) throw error;

    return json({ state: toClientState(data) });
  } catch (error) {
    console.error("PlanetSuzy update state save failed:", error);
    return json({ error: "Der Update-Status konnte nicht online gespeichert werden." }, 500);
  }
}
