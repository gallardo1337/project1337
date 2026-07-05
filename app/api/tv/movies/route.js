import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET() {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase ENV fehlt" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("movies")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const movies = (data || []).map((movie) => ({
      id: movie.id,
      title: movie.title || movie.name || "Ohne Titel",
      year: movie.year || null,
      thumbnail_url:
        movie.thumbnail_url ||
        movie.thumbnail ||
        movie.thumb_url ||
        null,
      file_url:
        movie.file_url ||
        movie.video_url ||
        movie.url ||
        "",
      quality:
        movie.quality ||
        movie.resolution ||
        movie.resolution_name ||
        null,
      studio:
        movie.studio ||
        movie.studio_name ||
        null,
      actors: [],
      tags: [],
    }));

    return NextResponse.json(movies);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
