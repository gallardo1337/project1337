import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalizeVideoUrl(value) {
  if (!value) return "";

  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) return value;

  return `https://video.my1337.de/${value.replace(/^\/+/, "")}`;
}

function normalizeThumbUrl(value) {
  if (!value) return null;

  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) return value;

  return value;
}

function getResolutionName(movie, resolutionMap) {
  if (movie.quality) return movie.quality;
  if (movie.resolution) return movie.resolution;
  if (movie.resolution_name) return movie.resolution_name;

  const resolutionId =
    movie.resolution_id ||
    movie.resolutionId ||
    movie.quality_id ||
    movie.qualityId;

  if (resolutionId && resolutionMap[String(resolutionId)]) {
    return resolutionMap[String(resolutionId)];
  }

  return null;
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

    const { data: moviesData, error: moviesError } = await supabase
      .from("movies")
      .select("*")
      .order("id", { ascending: false });

    if (moviesError) {
      return NextResponse.json(
        { error: moviesError.message },
        { status: 500 }
      );
    }

    const { data: resolutionsData, error: resolutionsError } = await supabase
      .from("resolutions")
      .select("*");

    if (resolutionsError) {
      return NextResponse.json(
        { error: resolutionsError.message },
        { status: 500 }
      );
    }

    const resolutionMap = {};

    for (const resolution of resolutionsData || []) {
      const id = resolution.id;
      const name =
        resolution.name ||
        resolution.title ||
        resolution.label ||
        resolution.value ||
        null;

      if (id && name) {
        resolutionMap[String(id)] = name;
      }
    }

    const movies = (moviesData || []).map((movie) => ({
      id: String(movie.id),
      title: movie.title || movie.name || "Ohne Titel",
      year: movie.year || null,
      thumbnail_url: normalizeThumbUrl(
        movie.thumbnail_url ||
        movie.thumbnail ||
        movie.thumb_url ||
        movie.image_url ||
        null
      ),
      file_url: normalizeVideoUrl(
        movie.file_url ||
        movie.video_url ||
        movie.url ||
        ""
      ),
      quality: getResolutionName(movie, resolutionMap),
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
