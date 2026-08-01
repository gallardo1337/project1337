import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  if (!(await hasLibrarySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Film-ID fehlt." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase.rpc("increment_movie_view", {
      p_movie_id: id,
    });

    if (error) {
      if (error.code === "23503") {
        return NextResponse.json(
          { error: "Film nicht gefunden." },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ movie_id: id, view_count: Number(data || 0) });
  } catch (error) {
    console.error("Movie view could not be recorded:", error);
    return NextResponse.json(
      { error: "Aufruf konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
