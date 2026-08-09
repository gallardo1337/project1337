import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await hasLibrarySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movie_metrics")
      .select("movie_id,rating,view_count,is_favorite");

    if (error) throw error;

    return NextResponse.json(
      { metrics: data || [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Movie metrics could not be loaded:", error);
    return NextResponse.json(
      { error: "Filmstatistiken konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}
