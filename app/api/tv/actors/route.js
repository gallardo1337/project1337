import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getActorImage(actor) {
  return (
    actor.image_url ||
    actor.photo_url ||
    actor.avatar_url ||
    actor.thumbnail_url ||
    actor.img_url ||
    actor.image ||
    null
  );
}

async function loadTable(supabase, tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return [];
  }

  return data || [];
}

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase ENV fehlt" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const actors = await loadTable(supabase, "actors");
    const actors2 = await loadTable(supabase, "actors2");

    const merged = [...actors, ...actors2];

    const seen = new Set();

    const result = merged
      .map((actor) => ({
        id: String(actor.id),
        name: actor.name || actor.title || "Unbekannt",
        image_url: getActorImage(actor),
      }))
      .filter((actor) => {
        const key = actor.name.toLowerCase().trim();

        if (!key || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
