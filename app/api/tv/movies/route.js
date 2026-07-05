import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
      .select(`
        id,
        title,
        year,
        thumbnail_url,
        file_url,
        resolutions (
          name
        ),
        studios (
          name
        ),
        movie_actors (
          actors (
            name
          )
        ),
        movie_tags (
          tags (
            name
          )
        )
      `)
      .order("id", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const movies = (data || []).map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      thumbnail_url: movie.thumbnail_url,
      file_url: movie.file_url,
      quality: movie.resolutions?.name || null,
      studio: movie.studios?.name || null,
      actors: (movie.movie_actors || [])
        .map((entry) => entry.actors?.name)
        .filter(Boolean),
      tags: (movie.movie_tags || [])
        .map((entry) => entry.tags?.name)
        .filter(Boolean),
    }));

    return NextResponse.json(movies);
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
