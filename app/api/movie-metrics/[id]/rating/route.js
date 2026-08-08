import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  if (!(await hasLibrarySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const rating = Number(body?.rating);

    if (!id) {
      return NextResponse.json({ error: "Film-ID fehlt." }, { status: 400 });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
      return NextResponse.json(
        { error: "Die Bewertung muss zwischen 1 und 10 liegen." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movie_metrics")
      .upsert(
        {
          movie_id: id,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "movie_id" }
      )
      .select("movie_id,rating,view_count")
      .single();

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Film nicht gefunden." },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ metric: data });
  } catch (error) {
    console.error("Movie rating could not be saved:", error);
    return NextResponse.json(
      { error: "Bewertung konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
