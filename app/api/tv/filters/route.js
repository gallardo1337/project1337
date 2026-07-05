import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function normalizeName(row) {
  return (
    row.name ||
    row.title ||
    row.label ||
    row.value ||
    row.display_name ||
    "Unbekannt"
  );
}

function normalizeOption(row) {
  return {
    id: String(row.id),
    name: normalizeName(row),
  };
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, "de", {
    sensitivity: "base",
  });
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

    const [
      tagsResult,
      studiosResult,
      mainActorsResult,
      supportingActorsResult,
      resolutionsResult,
    ] = await Promise.all([
      supabase.from("tags").select("*"),
      supabase.from("studios").select("*"),
      supabase.from("actors").select("*"),
      supabase.from("actors2").select("*"),
      supabase.from("resolutions").select("*"),
    ]);

    if (tagsResult.error) {
      return NextResponse.json(
        { error: tagsResult.error.message },
        { status: 500 }
      );
    }

    if (studiosResult.error) {
      return NextResponse.json(
        { error: studiosResult.error.message },
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

    if (resolutionsResult.error) {
      return NextResponse.json(
        { error: resolutionsResult.error.message },
        { status: 500 }
      );
    }

    const tags = (tagsResult.data || [])
      .map(normalizeOption)
      .sort(sortByName);

    const studios = (studiosResult.data || [])
      .map(normalizeOption)
      .sort(sortByName);

    const mainActors = (mainActorsResult.data || [])
      .map(normalizeOption)
      .sort(sortByName);

    const supportingActors = (supportingActorsResult.data || [])
      .map(normalizeOption)
      .sort(sortByName);

    const resolutions = (resolutionsResult.data || [])
      .map(normalizeOption)
      .sort(sortByName);

    return NextResponse.json({
      tags,
      studios,
      main_actors: mainActors,
      supporting_actors: supportingActors,
      resolutions,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
