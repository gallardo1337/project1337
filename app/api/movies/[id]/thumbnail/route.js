import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedThumbnailHost(hostname) {
  const normalized = String(hostname || "").toLowerCase();
  const configured = new Set(
    (
      process.env.THUMBNAIL_ALLOWED_HOSTS ||
      "gallardo1337.io,www.gallardo1337.io,my1337.de,www.my1337.de"
    )
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );

  try {
    const uploadHost = new URL(
      process.env.NEXT_PUBLIC_MOVIE_UPLOAD_URL || ""
    ).hostname.toLowerCase();
    if (uploadHost) configured.add(uploadHost);
  } catch {
    // Die explizite Allowlist bleibt aktiv, falls die Upload-URL fehlt.
  }

  return [...configured].some(
    (host) => normalized === host || normalized.endsWith(`.${host}`)
  );
}

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

export async function PUT(request, { params }) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id || !UUID_PATTERN.test(id)) {
      return noStoreJson({ error: "Ungültige Film-ID." }, { status: 400 });
    }

    const body = await request.json();
    const thumbnailUrl = String(body?.thumbnail_url || "").trim();

    let parsedUrl;
    try {
      parsedUrl = new URL(thumbnailUrl);
    } catch {
      return noStoreJson(
        { error: "Die Thumbnail-URL ist ungültig." },
        { status: 400 }
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      !allowedThumbnailHost(parsedUrl.hostname)
    ) {
      return noStoreJson(
        { error: "Dieser Thumbnail-Host ist nicht freigegeben." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movies")
      .update({ thumbnail_url: parsedUrl.toString() })
      .eq("id", id)
      .select("id,thumbnail_url")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return noStoreJson({ error: "Film nicht gefunden." }, { status: 404 });
    }

    return noStoreJson({
      movie_id: data.id,
      thumbnail_url: data.thumbnail_url,
    });
  } catch (error) {
    console.error("Movie thumbnail could not be saved:", error);
    return noStoreJson(
      { error: "Thumbnail konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
