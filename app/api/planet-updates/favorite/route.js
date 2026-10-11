import { NextResponse } from "next/server";
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

export async function PUT(request) {
  if (!(await hasLibrarySession())) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await request.json();
    const actorId = String(body?.actorId || "");
    if (!/^[0-9a-f-]{36}$/i.test(actorId) || typeof body?.favorite !== "boolean") {
      return json({ error: "Ungültige Favoriten-Auswahl." }, 400);
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("actors")
      .update({ planet_suzy_update_favorite: body.favorite })
      .eq("id", actorId)
      .select("id,planet_suzy_update_favorite")
      .maybeSingle();

    if (error) throw error;
    if (!data) return json({ error: "Darsteller nicht gefunden." }, 404);
    return json({ actorId: data.id, favorite: data.planet_suzy_update_favorite });
  } catch (error) {
    console.error("PlanetSuzy favorite save failed:", error);
    return json({ error: "Favorit konnte nicht gespeichert werden." }, 500);
  }
}
