import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalizeVideoUrl(value) {
  if (!value) return "";

  const cleanValue = String(value).trim();

  if (!cleanValue) return "";
  if (cleanValue.startsWith("https://")) return cleanValue;
  if (cleanValue.startsWith("http://")) return cleanValue;

  return `https://video.my1337.de/${cleanValue.replace(/^\/+/, "")}`;
}

function normalizeThumbUrl(value) {
  if (!value) return null;

  const cleanValue = String(value).trim();

  if (!cleanValue) return null;
  if (cleanValue.startsWith("https://")) return cleanValue;
  if (cleanValue.startsWith("http://")) return cleanValue;
  if (cleanValue.startsWith("//")) return `https:${cleanValue}`;

  if (cleanValue.startsWith("/")) {
    return `https://my1337.de${cleanValue}`;
  }

  return cleanValue;
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

function getStudioName(movie, studioMap) {
  if (movie.studio) return movie.studio;
  if (movie.studio_name) return movie.studio_name;

  const studioId = movie.studio_id || movie.studioId;

  if (studioId && studioMap[String(studioId)]) {
    return studioMap[String(studioId)];
  }

  return null;
}

function movieMatchesActor(movie, actorId, actorName) {
  const id = String(actorId).trim();
  const name = String(actorName || "").trim().toLowerCase();

  const possibleIdValues = [
    movie.actor_id,
    movie.actorId,
    movie.main_actor_id,
    movie.mainActorId,
    movie.hauptdarsteller_id,
    movie.hauptdarstellerId,
    movie.performer_id,
    movie.performerId,
    movie.actor,
    movie.main_actor,
    movie.hauptdarsteller,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());

  if (possibleIdValues.includes(id)) {
    return true;
  }

  const possibleNameValues = [
    movie.actor_name,
    movie.actorName,
    movie.main_actor_name,
    movie.mainActorName,
    movie.hauptdarsteller_name,
    movie.hauptdarstellerName,
    movie.actor,
    movie.main_actor,
    movie.hauptdarsteller,
    movie.actors,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  if (name && possibleNameValues.some((value) => value.includes(name))) {
    return true;
  }

  return false;
}

export async function GET(request, context) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase ENV fehlt" },
        { status: 500 }
      );
    }

    const actorId = context?.params?.id;

    if (!actorId) {
      return NextResponse.json(
        { error: "Actor ID fehlt" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: actorData, error: actorError } = await supabase
      .from("actors")
      .select("*")
      .eq("id", actorId)
      .maybeSingle();

    if (actorError) {
      return NextResponse.json(
        { error: actorError.message },
        { status: 500 }
      );
    }

    const actorName = actorData?.name || actorData?.title || "";

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

    const { data: resolutionsData } = await supabase
      .from("resolutions")
      .select("*");

    const { data: studiosData } = await supabase
      .from("studios")
      .select("*");

    const resolutionMap = {};
    for (const resolution of resolutionsData || []) {
      const name =
        resolution.name ||
        resolution.title ||
        resolution.label ||
        resolution.value ||
        null;

      if (resolution.id && name) {
        resolutionMap[String(resolution.id)] = name;
      }
    }

    const studioMap = {};
    for (const studio of studiosData || []) {
      const name =
        studio.name ||
        studio.title ||
        studio.label ||
        null;

      if (studio.id && name) {
        studioMap[String(studio.id)] = name;
      }
    }

    const matchingMovies = (moviesData || []).filter((movie) =>
      movieMatchesActor(movie, actorId, actorName)
    );

    const movies = matchingMovies.map((movie) => ({
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
      studio: getStudioName(movie, studioMap),
      actors: actorName ? [actorName] : [],
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
