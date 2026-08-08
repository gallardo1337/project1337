import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PUBLIC_VIDEO_BASE = "https://video.my1337.de/";
const LEGACY_VIDEO_HOST = "192.168.178.58";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TITLE_LIMIT = 250;
const URL_LIMIT = 2048;
const CURRENT_YEAR = new Date().getFullYear();
const TECHNICAL_TOKENS = new Set([
  "1080",
  "1080p",
  "2160",
  "2160p",
  "4k",
  "uhd",
  "fullhd",
  "full hd",
  "fhd",
  "webrip",
  "webdl",
  "bluray",
  "brrip",
  "dvdrip",
  "x264",
  "x265",
  "h264",
  "h265",
  "hevc",
  "avc",
  "aac",
  "mp4",
]);

class ImportValidationError extends Error {}

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function allowedVideoHosts() {
  return new Set(
    [
      "video.my1337.de",
      ...(process.env.VIDEO_ALLOWED_HOSTS || "").split(","),
    ]
      .map((host) => host.trim().toLocaleLowerCase("en"))
      .filter(Boolean)
  );
}

function canonicalizeVideoUrl(value) {
  const source = String(value || "").trim().replace(/\\/g, "/");
  if (!source) throw new ImportValidationError("Bitte einen MP4-Pfad eingeben.");
  if (source.length > URL_LIMIT) {
    throw new ImportValidationError("Der Dateipfad ist zu lang.");
  }

  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    parsed = new URL(source.replace(/^\/+/, ""), PUBLIC_VIDEO_BASE);
  }

  if (parsed.hostname === LEGACY_VIDEO_HOST) {
    parsed = new URL(parsed.pathname, PUBLIC_VIDEO_BASE);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ImportValidationError(
      "Nur HTTP- oder HTTPS-Videopfade sind erlaubt."
    );
  }
  if (parsed.username || parsed.password) {
    throw new ImportValidationError(
      "Zugangsdaten dürfen nicht im Videopfad stehen."
    );
  }
  if (!allowedVideoHosts().has(parsed.hostname.toLocaleLowerCase("en"))) {
    throw new ImportValidationError(
      `Der Videohost „${parsed.hostname}“ ist für den Import nicht freigegeben.`
    );
  }

  parsed.protocol = "https:";
  parsed.port = "";
  parsed.search = "";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, "/");

  if (!/\.mp4$/i.test(safeDecode(parsed.pathname))) {
    throw new ImportValidationError(
      "Der Dateipfad muss vollständig sein und mit .mp4 enden."
    );
  }

  return parsed.toString();
}

function comparableUrl(value) {
  try {
    const parsed = new URL(canonicalizeVideoUrl(value));
    return safeDecode(parsed.pathname)
      .normalize("NFKC")
      .toLocaleLowerCase("de")
      .replace(/\/{2,}/g, "/");
  } catch {
    return "";
  }
}

function titleCase(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      /[A-ZÄÖÜ]/.test(word.slice(1))
        ? word
        : `${word.charAt(0).toLocaleUpperCase("de")}${word.slice(1)}`
    )
    .join(" ");
}

function extractPathMetadata(canonicalUrl) {
  const parsed = new URL(canonicalUrl);
  const decodedPath = safeDecode(parsed.pathname);
  const pathParts = decodedPath.split("/").filter(Boolean);
  const filename = pathParts.at(-1) || "";
  const stem = filename.replace(/\.mp4$/i, "");
  const spacedStem = stem.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  const yearMatch = `${spacedStem} ${decodedPath}`.match(
    /\b(19\d{2}|20\d{2})\b/
  );
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const titleTokens = spacedStem
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== String(year || ""))
    .filter((token) => !TECHNICAL_TOKENS.has(normalizeText(token)))
    .filter((token) => !/^\d{3,4}p$/i.test(token))
    .filter((token) => !/^\d+(?:kbps|mbps|fps)$/i.test(token));
  const suggestedTitle = titleCase(titleTokens.join(" "));
  const normalizedSuggestion = normalizeText(suggestedTitle);
  const letters = (suggestedTitle.match(/[a-zäöüß]/gi) || []).length;
  const numbers = (suggestedTitle.match(/\d/g) || []).length;
  const looksGenerated =
    normalizedSuggestion.length < 3 ||
    letters < 3 ||
    numbers > letters ||
    /^[a-f0-9]{12,}$/i.test(stem.replace(/[^a-z0-9]/gi, ""));

  return {
    decoded_path: decodedPath,
    filename,
    folder: pathParts.length > 1 ? pathParts.at(-2) : "",
    year,
    title: looksGenerated ? "" : suggestedTitle.slice(0, TITLE_LIMIT),
    title_confidence:
      looksGenerated ? "low" : titleTokens.length >= 2 ? "high" : "medium",
  };
}

function textContainsEntity(haystack, entityName) {
  const normalizedName = normalizeText(entityName);
  if (normalizedName.length < 2) return false;
  return ` ${haystack} `.includes(` ${normalizedName} `);
}

function matchedIds(items, pathText, limit = 20) {
  return items
    .filter((item) => textContainsEntity(pathText, item.name))
    .sort((left, right) => String(right.name).length - String(left.name).length)
    .slice(0, limit)
    .map((item) => item.id);
}

function tokenSimilarity(leftValue, rightValue) {
  const left = new Set(normalizeText(leftValue).split(" ").filter(Boolean));
  const right = new Set(normalizeText(rightValue).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  return (2 * overlap) / (left.size + right.size);
}

function findDuplicates(movies, { fileUrl, title, year }) {
  const pathKey = comparableUrl(fileUrl);
  const normalizedTitle = normalizeText(title);
  const result = [];

  for (const movie of movies) {
    if (pathKey && comparableUrl(movie.file_url) === pathKey) {
      result.push({
        type: "exact_path",
        severity: "blocking",
        score: 1,
        reason: "Dieser MP4-Pfad ist bereits einem Film zugeordnet.",
        movie,
      });
      continue;
    }

    if (!normalizedTitle || !movie.title) continue;
    const sameYear = !year || !movie.year || Number(year) === Number(movie.year);
    const movieTitle = normalizeText(movie.title);
    if (sameYear && normalizedTitle === movieTitle) {
      result.push({
        type: "exact_title",
        severity: "warning",
        score: 1,
        reason: "Titel und Jahr stimmen mit einem vorhandenen Film überein.",
        movie,
      });
      continue;
    }

    const score = tokenSimilarity(title, movie.title);
    if (sameYear && score >= 0.82) {
      result.push({
        type: "similar_title",
        severity: "warning",
        score,
        reason: "Der Titel ist einem vorhandenen Eintrag sehr ähnlich.",
        movie,
      });
    }
  }

  return result
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "blocking" ? -1 : 1;
      }
      return right.score - left.score;
    })
    .slice(0, 6);
}

function suggestResolution(resolutions, pathText) {
  const wanted = /\b(2160p?|4k|uhd)\b/.test(pathText)
    ? "4k"
    : /\b(retro|vhs|classic)\b/.test(pathText)
    ? "retro"
    : "fullhd";
  return (
    resolutions.find((item) => normalizeText(item.name) === wanted)?.id ||
    resolutions.find((item) => normalizeText(item.name) === "fullhd")?.id ||
    resolutions[0]?.id ||
    null
  );
}

async function loadImportContext(supabase) {
  const [movies, studios, mainActors, supportActors, tags, resolutions] =
    await Promise.all([
      supabase
        .from("movies")
        .select(
          "id,title,year,studio_id,file_url,thumbnail_url,resolution_id,created_at"
        ),
      supabase.from("studios").select("id,name"),
      supabase.from("actors").select("id,name"),
      supabase.from("actors2").select("id,name"),
      supabase.from("tags").select("id,name"),
      supabase.from("resolutions").select("id,name"),
    ]);

  const responses = [movies, studios, mainActors, supportActors, tags, resolutions];
  const failed = responses.find((response) => response.error);
  if (failed) throw failed.error;

  return {
    movies: movies.data || [],
    studios: studios.data || [],
    mainActors: mainActors.data || [],
    supportActors: supportActors.data || [],
    tags: tags.data || [],
    resolutions: resolutions.data || [],
  };
}

function analyzeSource(context, fileUrl, overrides = {}) {
  const canonicalUrl = canonicalizeVideoUrl(fileUrl);
  const pathMetadata = extractPathMetadata(canonicalUrl);
  const pathText = normalizeText(pathMetadata.decoded_path);
  const title = String(overrides.title || pathMetadata.title || "").trim();
  const year = Number(overrides.year) || pathMetadata.year || null;
  const mainActorIds = matchedIds(context.mainActors, pathText);
  const supportActorIds = matchedIds(context.supportActors, pathText);
  const studioIds = matchedIds(context.studios, pathText, 3);
  const tagIds = matchedIds(context.tags, pathText, 12);
  const resolutionId = suggestResolution(context.resolutions, pathText);
  const duplicates = findDuplicates(context.movies, {
    fileUrl: canonicalUrl,
    title,
    year,
  });
  const findings = [];

  findings.push({
    type: "success",
    label: "Vollständiger MP4-Pfad erkannt",
  });
  if (pathMetadata.title) {
    findings.push({
      type: pathMetadata.title_confidence === "high" ? "success" : "info",
      label: `Titel aus Dateiname vorgeschlagen (${pathMetadata.title_confidence})`,
    });
  } else {
    findings.push({
      type: "warning",
      label: "Dateiname liefert keinen verlässlichen Titel",
    });
  }
  if (mainActorIds.length || supportActorIds.length) {
    findings.push({
      type: "success",
      label: `${mainActorIds.length + supportActorIds.length} Cast-Zuordnung${
        mainActorIds.length + supportActorIds.length === 1 ? "" : "en"
      } erkannt`,
    });
  }
  if (!duplicates.length) {
    findings.push({ type: "success", label: "Keine Duplikatwarnung" });
  }

  return {
    canonical_url: canonicalUrl,
    source: pathMetadata,
    suggestions: {
      title,
      year,
      studio_id: studioIds[0] || null,
      resolution_id: resolutionId,
      main_actor_ids: mainActorIds,
      supporting_actor_ids: supportActorIds,
      tag_ids: tagIds,
    },
    duplicates,
    findings,
  };
}

function normalizeIdList(value, limit) {
  if (!Array.isArray(value)) return [];
  const ids = [...new Set(value.map((id) => String(id || "").trim()))].filter(
    Boolean
  );
  if (ids.length > limit || ids.some((id) => !UUID_PATTERN.test(id))) {
    throw new ImportValidationError("Mindestens eine Zuordnung ist ungültig.");
  }
  return ids;
}

function assertKnownIds(ids, items, label) {
  const known = new Set(items.map((item) => item.id));
  if (ids.some((id) => !known.has(id))) {
    throw new ImportValidationError(
      `Mindestens eine ${label}-Zuordnung existiert nicht mehr.`
    );
  }
}

export async function POST(request) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = createServerSupabase();
    const context = await loadImportContext(supabase);
    const analysis = analyzeSource(context, body?.file_url, {
      title: body?.title,
      year: body?.year,
    });
    return noStoreJson({ analysis });
  } catch (error) {
    console.error("Movie import analysis failed:", error);
    const validationError = error instanceof ImportValidationError;
    return noStoreJson(
      {
        error: validationError
          ? error.message
          : "Der Dateipfad konnte nicht analysiert werden.",
      },
      { status: validationError ? 400 : 500 }
    );
  }
}

export async function PUT(request) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabase = createServerSupabase();
    const context = await loadImportContext(supabase);
    const title = String(body?.title || "").trim();
    const fileUrl = canonicalizeVideoUrl(body?.file_url);
    const year = body?.year === "" || body?.year == null ? null : Number(body.year);
    const studioId = body?.studio_id ? String(body.studio_id) : null;
    const resolutionId = String(body?.resolution_id || "");
    const mainActorIds = normalizeIdList(body?.main_actor_ids, 20);
    const supportActorIds = normalizeIdList(body?.supporting_actor_ids, 50);
    const tagIds = normalizeIdList(body?.tag_ids, 50);

    if (!title || title.length > TITLE_LIMIT) {
      throw new ImportValidationError(
        `Der Titel muss zwischen 1 und ${TITLE_LIMIT} Zeichen lang sein.`
      );
    }
    if (
      year != null &&
      (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR + 1)
    ) {
      throw new ImportValidationError("Das Jahr ist ungültig.");
    }
    if (!UUID_PATTERN.test(resolutionId)) {
      throw new ImportValidationError(
        "Bitte eine gültige Qualität auswählen."
      );
    }
    if (studioId && !UUID_PATTERN.test(studioId)) {
      throw new ImportValidationError("Das Studio ist ungültig.");
    }

    assertKnownIds([resolutionId], context.resolutions, "Qualitäts");
    if (studioId) assertKnownIds([studioId], context.studios, "Studio");
    assertKnownIds(mainActorIds, context.mainActors, "Hauptdarsteller");
    assertKnownIds(supportActorIds, context.supportActors, "Nebendarsteller");
    assertKnownIds(tagIds, context.tags, "Tag");

    const duplicates = findDuplicates(context.movies, { fileUrl, title, year });
    if (duplicates.some((duplicate) => duplicate.severity === "blocking")) {
      return noStoreJson(
        {
          error: "Dieser MP4-Pfad ist bereits im Archiv vorhanden.",
          duplicates,
        },
        { status: 409 }
      );
    }
    if (duplicates.length && body?.confirm_duplicate !== true) {
      return noStoreJson(
        {
          error: "Das mögliche Duplikat muss vor dem Import bestätigt werden.",
          duplicates,
        },
        { status: 409 }
      );
    }

    const payload = {
      title,
      year,
      studio_id: studioId,
      file_url: fileUrl,
      resolution_id: resolutionId,
      thumbnail_url: null,
      main_actor_ids: mainActorIds,
      supporting_actor_ids: supportActorIds,
      tag_ids: tagIds,
    };
    const { data, error } = await supabase
      .from("movies")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;

    return noStoreJson({ movie: data }, { status: 201 });
  } catch (error) {
    console.error("Movie import failed:", error);
    const validationError = error instanceof ImportValidationError;
    return noStoreJson(
      {
        error: validationError
          ? error.message
          : "Der Film konnte nicht importiert werden.",
      },
      { status: validationError ? 400 : 500 }
    );
  }
}
