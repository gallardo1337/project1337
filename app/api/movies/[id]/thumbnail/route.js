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

async function readResponseWithLimit(response, maxBytes) {
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > maxBytes) throw new Error("Thumbnail-Datei ist zu groß.");
  if (!response.body) throw new Error("Thumbnail-Datei ist leer.");

  const reader = response.body.getReader();
  const chunks = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalSize += value.byteLength;
    if (totalSize > maxBytes) {
      await reader.cancel();
      throw new Error("Thumbnail-Datei ist zu groß.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, totalSize);
}

async function fetchAllowedThumbnail(sourceUrl) {
  let url = sourceUrl;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    if (url.protocol !== "https:" || !allowedThumbnailHost(url.hostname)) {
      throw new Error("Thumbnail-Host ist nicht freigegeben.");
    }

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 3) throw new Error("Zu viele Thumbnail-Weiterleitungen.");
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new Error(`Thumbnail-Host antwortet mit HTTP ${response.status}.`);

    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"].includes(contentType)) {
      throw new Error("Der Thumbnail-Host hat keine Bilddatei geliefert.");
    }
    const image = await readResponseWithLimit(response, 25 * 1024 * 1024);
    if (!image.length) throw new Error("Thumbnail-Datei ist leer.");
    return { image, contentType };
  }
  throw new Error("Thumbnail konnte nicht geladen werden.");
}

export async function GET(_request, { params }) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id || !UUID_PATTERN.test(id)) {
      return noStoreJson({ error: "Ungültige Film-ID." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("movies")
      .select("thumbnail_url")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return noStoreJson({ error: "Film nicht gefunden." }, { status: 404 });
    if (!data.thumbnail_url) {
      return noStoreJson({ error: "Für diesen Film ist kein Thumbnail gespeichert." }, { status: 404 });
    }

    let sourceUrl;
    try {
      sourceUrl = new URL(data.thumbnail_url);
    } catch {
      return noStoreJson({ error: "Die gespeicherte Thumbnail-URL ist ungültig." }, { status: 400 });
    }
    if (sourceUrl.protocol !== "https:" || !allowedThumbnailHost(sourceUrl.hostname)) {
      return noStoreJson({ error: "Dieser Thumbnail-Host ist nicht freigegeben." }, { status: 400 });
    }

    const { image, contentType } = await fetchAllowedThumbnail(sourceUrl);
    return new NextResponse(image, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(image.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Movie thumbnail source could not be loaded:", error);
    return noStoreJson(
      { error: error?.message || "Thumbnail konnte nicht geladen werden." },
      { status: 502 }
    );
  }
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
