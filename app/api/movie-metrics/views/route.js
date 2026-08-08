import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function DELETE() {
  if (!(await hasLibrarySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movie_metrics")
      .update({
        view_count: 0,
        updated_at: new Date().toISOString(),
      })
      .gt("view_count", 0)
      .select("movie_id,view_count");

    if (error) throw error;

    return NextResponse.json({
      reset_count: data?.length || 0,
      metrics: data || [],
    });
  } catch (error) {
    console.error("Movie views could not be reset:", error);
    return NextResponse.json(
      { error: "Aufrufe konnten nicht zurückgesetzt werden." },
      { status: 500 }
    );
  }
}
