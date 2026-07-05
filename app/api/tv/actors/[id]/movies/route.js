import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const actorMovieTableCandidates = [
  "movie_actors",
  "movies_actors",
  "actor_movies",
  "actors_movies",
  "movie_actor",
  "actor_movie",
];

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

function getMovieIdFromRelation(row) {
  return (
    row.movie_id ||
    row.movieId ||
    row.movies_id ||
    row.moviesId ||
    row.film_id ||
    row.filmId ||
    row.id_movie ||
    row.idMovie ||
    null
  );
}

function rowMatchesActor(row, actorId) {
  const possibleActorIds = [
    row.actor_id,
    row.actorId,
    row.actors_id,
    row.actorsId,
    row.performer_id,
    row.performerId,
    row.id_actor,
    row.idActor,
  ]
    .filter(Boolean)
    .map(String);

  return possibleActorIds.includes(String(actorId));
}

async function loadActorMovieRows(supabase, actorId) {
  const tried = [];

  for (const tableName of actorMovieTableCandidates) {
    tried.push(tableName);

    const { data, error } = await supabase
      .from(tableName)
      .select("*");

    if (error) {
      continue;
    }

    const matchingRows = (data || []).filter((row) =>
      rowMatchesActor(row, actorId)
    );

    return {
      tableName,
      rows: matchingRows,
      tried,
    };
  }

  return {
    tableName: null,
    rows: [],
    tried,
  };
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

    const relationResult = await loadActorMovieRows(supabase, actorId);

    if (!relationResult.tableName) {
      return NextResponse.json(
        {
          error: "Keine passende Hauptdarsteller-Film-Tabelle gefunden",
          tried: relationResult.tried,
        },
        { status: 500 }
      );
    }

    const movieIds = [
      ...new Set(
        (relationResult.rows || [])
          .map(getMovieIdFromRelation)
          .filter(Boolean)
          .map(String)
      ),
    ];

    if (movieIds.length === 0) {
      return NextResponse.json([]);
    }

    const { data: moviesData, error: moviesError } = await supabase
      .from("movies")
      .select("*")
      .in("id", movieIds)
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
      studio: getStudioName(movie, studioMap),
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
