import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function allowedMediaHosts() {
  return new Set(
    (process.env.MEDIA_HEALTH_ALLOWED_HOSTS || "video.my1337.de")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getFileSize(contentRange, contentLength, status) {
  const rangeMatch = String(contentRange || "").match(/\/(\d+)$/);
  if (rangeMatch) return Number(rangeMatch[1]) || null;

  if (status === 200) {
    const length = Number(contentLength);
    return Number.isFinite(length) && length >= 0 ? length : null;
  }

  return null;
}

function failedCheck(message, checkedAt, extra = {}) {
  return {
    reachable: false,
    rangeSupported: false,
    contentTypeValid: false,
    status: null,
    contentType: null,
    fileSize: null,
    responseTimeMs: null,
    checkedAt,
    error: message,
    ...extra,
  };
}

async function probeMediaUrl(mediaUrl, signal, retry = false) {
  const response = await fetch(mediaUrl, {
    method: "GET",
    headers: {
      Range: "bytes=0-1",
      ...(retry ? { "Cache-Control": "no-cache" } : {}),
      "User-Agent": "Project1337-MediaHealth/1.1",
    },
    redirect: "manual",
    cache: "no-store",
    signal,
  });

  const contentType = response.headers.get("content-type");
  const contentRange = response.headers.get("content-range");
  const contentLength = response.headers.get("content-length");
  const acceptRanges = response.headers.get("accept-ranges");
  const result = {
    ok: response.ok,
    status: response.status,
    contentType,
    contentRange,
    acceptRanges,
    redirectLocation: response.headers.get("location"),
    rangeSupported:
      response.status === 206 &&
      /^bytes\s+\d+-\d+\/\d+$/i.test(contentRange || ""),
    contentTypeValid: /^video\/mp4(?:;|$)/i.test(contentType || ""),
    fileSize: getFileSize(contentRange, contentLength, response.status),
  };

  if (response.body) {
    await response.body.cancel().catch(() => {});
  }

  return result;
}

export async function POST(_request, { params }) {
  if (!(await hasLibrarySession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checkedAt = new Date().toISOString();

  try {
    const { id } = await params;

    if (!id || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "Ungültige Film-ID." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: movie, error: movieError } = await supabase
      .from("movies")
      .select("id,title,file_url")
      .eq("id", id)
      .maybeSingle();

    if (movieError) throw movieError;
    if (!movie) {
      return NextResponse.json({ error: "Film nicht gefunden." }, { status: 404 });
    }

    if (!movie.file_url) {
      return NextResponse.json({
        movie_id: id,
        check: failedCheck("Kein Dateipfad hinterlegt.", checkedAt),
      });
    }

    let mediaUrl;
    try {
      mediaUrl = new URL(movie.file_url);
    } catch {
      return NextResponse.json({
        movie_id: id,
        check: failedCheck("Der Dateipfad ist keine gültige URL.", checkedAt),
      });
    }

    if (mediaUrl.protocol !== "https:") {
      return NextResponse.json({
        movie_id: id,
        check: failedCheck("Live-Prüfung ist nur über HTTPS erlaubt.", checkedAt),
      });
    }

    if (!allowedMediaHosts().has(mediaUrl.hostname.toLowerCase())) {
      return NextResponse.json({
        movie_id: id,
        check: failedCheck(
          `Videohost ${mediaUrl.hostname} ist für die Prüfung nicht freigegeben.`,
          checkedAt
        ),
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const startedAt = Date.now();

    try {
      let probe = await probeMediaUrl(mediaUrl, controller.signal);
      let rangeRetried = false;

      if (
        !probe.rangeSupported &&
        probe.status === 200 &&
        /\bbytes\b/i.test(probe.acceptRanges || "")
      ) {
        rangeRetried = true;
        const firstProbe = probe;
        try {
          probe = await probeMediaUrl(mediaUrl, controller.signal, true);
        } catch {
          probe = firstProbe;
        }
      }

      const responseTimeMs = Date.now() - startedAt;
      const isRedirect = probe.status >= 300 && probe.status < 400;
      const reachable = probe.ok && !isRedirect;

      return NextResponse.json(
        {
          movie_id: id,
          check: {
            reachable,
            rangeSupported: probe.rangeSupported,
            contentTypeValid: probe.contentTypeValid,
            status: probe.status,
            contentType: probe.contentType,
            fileSize: probe.fileSize,
            responseTimeMs,
            checkedAt,
            error: isRedirect
              ? `Weiterleitung erkannt${
                  probe.redirectLocation ? `: ${probe.redirectLocation}` : "."
                }`
              : reachable
              ? null
              : `Videohost antwortet mit HTTP ${probe.status}.`,
            acceptRanges: probe.acceptRanges,
            contentRange: probe.contentRange,
            rangeRetried,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (fetchError) {
      const timedOut = fetchError?.name === "AbortError";
      return NextResponse.json({
        movie_id: id,
        check: failedCheck(
          timedOut
            ? "Zeitüberschreitung nach 10 Sekunden."
            : "Videohost konnte nicht erreicht werden.",
          checkedAt,
          { responseTimeMs: Date.now() - startedAt }
        ),
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.error("Media health check failed:", error);
    return NextResponse.json(
      { error: "Medienprüfung konnte nicht ausgeführt werden." },
      { status: 500 }
    );
  }
}
