import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const assetBaseUrl = "https://my1337.de";

function normalizeImageUrl(value) {
  if (!value) return null;

  const cleanValue = String(value).trim();

  if (!cleanValue) return null;

  if (cleanValue.startsWith("https://")) return cleanValue;
  if (cleanValue.startsWith("http://")) return cleanValue;

  if (cleanValue.startsWith("//")) {
    return `https:${cleanValue}`;
  }

  if (cleanValue.startsWith("/")) {
    return encodeURI(`${assetBaseUrl}${cleanValue}`);
  }

  return encodeURI(`${assetBaseUrl}/${cleanValue}`);
}

function getActorImage(actor) {
  return normalizeImageUrl(
    actor.image_url ||
      actor.photo_url ||
      actor.avatar_url ||
      actor.thumbnail_url ||
      actor.img_url ||
      actor.poster_url ||
      actor.profile_image_url ||
      actor.profile_image ||
      actor.picture_url ||
      actor.picture ||
      actor.image ||
      actor.img ||
      actor.photo ||
      null
  );
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

    // Nur Hauptdarsteller.
    // Nebendarsteller aus actors2 werden bewusst NICHT geladen.
    const { data, error } = await supabase
      .from("actors")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const seen = new Set();

    const actors = (data || [])
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

    return NextResponse.json(actors);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
