import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_GROUP_SIZE = 20;

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

function normalizeMovieIds(value) {
  if (!Array.isArray(value)) return null;

  const movieIds = [...new Set(value.map((id) => String(id || "").trim()))]
    .filter(Boolean)
    .sort();

  if (
    movieIds.length < 2 ||
    movieIds.length > MAX_GROUP_SIZE ||
    movieIds.some((id) => !UUID_PATTERN.test(id))
  ) {
    return null;
  }

  return movieIds;
}

function createPairRows(movieIds) {
  const pairs = [];

  for (let leftIndex = 0; leftIndex < movieIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < movieIds.length;
      rightIndex += 1
    ) {
      pairs.push({
        movie_id_a: movieIds[leftIndex],
        movie_id_b: movieIds[rightIndex],
      });
    }
  }

  return pairs;
}

async function requireAdmin() {
  return hasLibrarySession();
}

export async function GET() {
  if (!(await requireAdmin())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("media_duplicate_ignores")
      .select("movie_id_a,movie_id_b,ignored_at")
      .order("ignored_at", { ascending: false });

    if (error) throw error;

    return noStoreJson({ ignored_pairs: data || [] });
  } catch (error) {
    console.error("Duplicate decisions could not be loaded:", error);
    return noStoreJson(
      { error: "Duplikatentscheidungen konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  if (!(await requireAdmin())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const movieIds = normalizeMovieIds(body?.movie_ids);

    if (!movieIds) {
      return noStoreJson(
        { error: "Mindestens zwei gültige Film-IDs werden benötigt." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data: existingMovies, error: movieError } = await supabase
      .from("movies")
      .select("id")
      .in("id", movieIds);

    if (movieError) throw movieError;
    if ((existingMovies || []).length !== movieIds.length) {
      return noStoreJson(
        { error: "Mindestens ein Film wurde nicht gefunden." },
        { status: 400 }
      );
    }

    const ignoredPairs = createPairRows(movieIds);
    const { error } = await supabase
      .from("media_duplicate_ignores")
      .upsert(ignoredPairs, {
        onConflict: "movie_id_a,movie_id_b",
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return noStoreJson({ ignored_pairs: ignoredPairs });
  } catch (error) {
    console.error("Duplicate decision could not be saved:", error);
    return noStoreJson(
      { error: "Entscheidung konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  if (!(await requireAdmin())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const movieIds = normalizeMovieIds(body?.movie_ids);

    if (!movieIds) {
      return noStoreJson(
        { error: "Mindestens zwei gültige Film-IDs werden benötigt." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("media_duplicate_ignores")
      .delete()
      .in("movie_id_a", movieIds)
      .in("movie_id_b", movieIds);

    if (error) throw error;

    return noStoreJson({ restored_pairs: createPairRows(movieIds) });
  } catch (error) {
    console.error("Duplicate decision could not be restored:", error);
    return noStoreJson(
      { error: "Entscheidung konnte nicht rückgängig gemacht werden." },
      { status: 500 }
    );
  }
}
