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
    const favorite = body?.favorite;

    if (!id) {
      return NextResponse.json({ error: "Film-ID fehlt." }, { status: 400 });
    }

    if (typeof favorite !== "boolean") {
      return NextResponse.json(
        { error: "Der Favoritenstatus muss true oder false sein." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movie_metrics")
      .upsert(
        {
          movie_id: id,
          is_favorite: favorite,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "movie_id" }
      )
      .select("movie_id,rating,view_count,is_favorite")
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
    console.error("Movie favorite could not be saved:", error);
    return NextResponse.json(
      { error: "Favorit konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
