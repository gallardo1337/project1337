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

function makeMap(rows) {
  const map = {};

  for (const row of rows || []) {
    const name =
      row.name ||
      row.title ||
      row.label ||
      row.value ||
      row.display_name ||
      null;

    if (row.id && name) {
      map[String(row.id)] = name;
    }
  }

  return map;
}

function getNamesFromIds(ids, map) {
  if (!Array.isArray(ids)) return [];

  return ids
    .map((id) => map[String(id)])
    .filter(Boolean);
}

function parseIdList(value) {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: "Supabase ENV fehlt" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const title = searchParams.get("title") || searchParams.get("q") || "";

    const tagIds = parseIdList(searchParams.get("tag_ids"));
    const mainActorIds = parseIdList(searchParams.get("main_actor_ids"));
    const supportingActorIds = parseIdList(
      searchParams.get("supporting_actor_ids")
    );

    const studioId = searchParams.get("studio_id");
    const resolutionId = searchParams.get("resolution_id");

    let query = supabase
      .from("movies")
      .select("*")
      .order("created_at", { ascending: false });

    if (title.trim()) {
      query = query.ilike("title", `%${title.trim()}%`);
    }

    if (studioId) {
      query = query.eq("studio_id", studioId);
    }

    if (resolutionId) {
      query = query.eq("resolution_id", resolutionId);
    }

    if (tagIds.length > 0) {
      query = query.contains("tag_ids", tagIds);
    }

    if (mainActorIds.length > 0) {
      query = query.contains("main_actor_ids", mainActorIds);
    }

    if (supportingActorIds.length > 0) {
      query = query.contains("supporting_actor_ids", supportingActorIds);
    }

    const { data: moviesData, error: moviesError } = await query;

    if (moviesError) {
      return NextResponse.json(
        { error: moviesError.message },
        { status: 500 }
      );
    }

    const [
      resolutionsResult,
      studiosResult,
      tagsResult,
      mainActorsResult,
      supportingActorsResult,
    ] = await Promise.all([
      supabase.from("resolutions").select("*"),
      supabase.from("studios").select("*"),
      supabase.from("tags").select("*"),
      supabase.from("actors").select("*"),
      supabase.from("actors2").select("*"),
    ]);

    if (resolutionsResult.error) {
      return NextResponse.json(
        { error: resolutionsResult.error.message },
        { status: 500 }
      );
    }

    if (studiosResult.error) {
      return NextResponse.json(
        { error: studiosResult.error.message },
        { status: 500 }
      );
    }

    if (tagsResult.error) {
      return NextResponse.json(
        { error: tagsResult.error.message },
        { status: 500 }
      );
    }

    if (mainActorsResult.error) {
      return NextResponse.json(
        { error: mainActorsResult.error.message },
        { status: 500 }
      );
    }

    if (supportingActorsResult.error) {
      return NextResponse.json(
        { error: supportingActorsResult.error.message },
        { status: 500 }
      );
    }

    const resolutionMap = makeMap(resolutionsResult.data || []);
    const studioMap = makeMap(studiosResult.data || []);
    const tagMap = makeMap(tagsResult.data || []);
    const mainActorMap = makeMap(mainActorsResult.data || []);
    const supportingActorMap = makeMap(supportingActorsResult.data || []);

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

      quality:
        resolutionMap[String(movie.resolution_id)] ||
        movie.quality ||
        movie.resolution ||
        movie.resolution_name ||
        null,

      studio:
        studioMap[String(movie.studio_id)] ||
        movie.studio ||
        movie.studio_name ||
        null,

      actors: getNamesFromIds(movie.main_actor_ids, mainActorMap),
      support_actors: getNamesFromIds(
        movie.supporting_actor_ids,
        supportingActorMap
      ),
      tags: getNamesFromIds(movie.tag_ids, tagMap),
    }));

    return NextResponse.json({
      count: movies.length,
      movies,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
