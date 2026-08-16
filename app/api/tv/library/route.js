import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  normalizeHomepageSections,
} from "../../../../lib/homepageSections";
import { buildTvLibraryPayload } from "../../../../lib/tvLibraryPayload.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

export async function GET() {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const [
      moviesResult,
      actorsResult,
      supportingActorsResult,
      studiosResult,
      tagsResult,
      resolutionsResult,
      metricsResult,
      homepageResult,
    ] = await Promise.all([
      supabase.from("movies").select("*").order("created_at", { ascending: false }),
      supabase.from("actors").select("*"),
      supabase.from("actors2").select("*"),
      supabase.from("studios").select("*"),
      supabase.from("tags").select("*"),
      supabase.from("resolutions").select("*"),
      supabase
        .from("movie_metrics")
        .select("movie_id,rating,view_count,is_favorite"),
      supabase
        .from("homepage_settings")
        .select("sections,updated_at")
        .eq("id", 1)
        .maybeSingle(),
    ]);

    const firstError = [
      moviesResult,
      actorsResult,
      supportingActorsResult,
      studiosResult,
      tagsResult,
      resolutionsResult,
      metricsResult,
      homepageResult,
    ].find((result) => result.error)?.error;

    if (firstError) throw firstError;

    return noStoreJson(
      buildTvLibraryPayload({
        movies: moviesResult.data || [],
        actors: actorsResult.data || [],
        supportingActors: supportingActorsResult.data || [],
        studios: studiosResult.data || [],
        tags: tagsResult.data || [],
        resolutions: resolutionsResult.data || [],
        metrics: metricsResult.data || [],
        sections: normalizeHomepageSections(
          homepageResult.data?.sections || DEFAULT_HOMEPAGE_SECTIONS
        ),
      })
    );
  } catch (error) {
    console.error("TV library could not be loaded:", error);
    return noStoreJson(
      { error: "Apple-TV-Library konnte nicht geladen werden." },
      { status: 500 }
    );
  }
}
