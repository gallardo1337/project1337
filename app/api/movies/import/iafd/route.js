import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../../lib/serverSupabase";
import {
  IafdError,
  buildIafdSearchUrl,
  fetchIafdHtml,
  mergeAndRankIafdResults,
  normalizeIafdText,
  parseIafdSearchHtml,
  parseIafdTitleHtml,
  validateIafdPersonUrl,
  validateIafdTitleUrl,
} from "../../../../../lib/iafd";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = "fra1";

const MAX_ACTOR_PROFILES = 2;
const MAX_QUERY_LENGTH = 180;
const TAG_ALIASES = {
  bathroom: ["bath room"],
  bedroom: ["bed room"],
  blindfolded: ["blindfold"],
  brunette: ["brown hair", "dark hair"],
  buttplug: ["butt plug"],
  "changing room": ["dressing room"],
  "cum in mouth": ["cum in her mouth", "oral creampie"],
  "cum on ass": ["cum on her ass"],
  "cum on belly": ["cum on her belly", "cum on stomach"],
  "cum on pussy": ["cum on her pussy"],
  "cum on tits": ["cum on her tits", "cum on breasts"],
  facial: ["facial cumshot"],
  "fishnet stockings": ["fishnets"],
  glasses: ["eyeglasses"],
  "high heels": ["heels"],
  "jerked off": ["handjob", "hand job"],
  livingroom: ["living room"],
  outdoor: ["outdoors"],
  overknees: ["overknee", "thigh high boots"],
  pov: ["point of view"],
  swimmingpool: ["swimming pool", "poolside"],
  "tied up": ["bondage", "restrained"],
};

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...init.headers,
    },
  });
}

function similarity(leftValue, rightValue) {
  const leftText = normalizeIafdText(leftValue);
  const rightText = normalizeIafdText(rightValue);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;
  const left = new Set(leftText.split(" "));
  const right = new Set(rightText.split(" "));
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });
  const dice = (2 * overlap) / (left.size + right.size);
  const contains =
    leftText.includes(rightText) || rightText.includes(leftText) ? 0.88 : 0;
  return Math.max(dice, contains);
}

function bestEntityMatch(name, items, threshold = 0.84) {
  const normalizedName = normalizeIafdText(name);
  if (!normalizedName) return null;
  const exact = items.find(
    (item) => normalizeIafdText(item.name) === normalizedName
  );
  if (exact) return { item: exact, score: 1 };

  const ranked = items
    .map((item) => ({ item, score: similarity(name, item.name) }))
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.score >= threshold ? ranked[0] : null;
}

function textHasPhrase(normalizedText, phrase) {
  const normalizedPhrase = normalizeIafdText(phrase);
  return (
    normalizedPhrase.length >= 3 &&
    ` ${normalizedText} `.includes(` ${normalizedPhrase} `)
  );
}

function matchTags(pageText, tags) {
  const normalizedPage = normalizeIafdText(pageText);
  return tags
    .filter((tag) => {
      const key = normalizeIafdText(tag.name);
      const candidates = [tag.name, ...(TAG_ALIASES[key] || [])];
      return candidates.some((candidate) => textHasPhrase(normalizedPage, candidate));
    })
    .map((tag) => tag.id);
}

async function loadMappingContext(supabase) {
  const [studios, mainActors, supportActors, tags] = await Promise.all([
    supabase.from("studios").select("id,name"),
    supabase.from("actors").select("id,name,iafd_url"),
    supabase.from("actors2").select("id,name"),
    supabase.from("tags").select("id,name"),
  ]);
  const responses = [studios, mainActors, supportActors, tags];
  const failed = responses.find((response) => response.error);
  if (failed) throw failed.error;
  return {
    studios: studios.data || [],
    mainActors: mainActors.data || [],
    supportActors: supportActors.data || [],
    tags: tags.data || [],
  };
}

async function searchIafd(body) {
  const query = String(body?.query || "").trim().slice(0, MAX_QUERY_LENGTH);
  const year = Number(body?.year) || null;
  if (!query) {
    throw new IafdError(
      "Aus dem Dateinamen konnte kein Suchbegriff gebildet werden.",
      "IAFD_QUERY_MISSING",
      400
    );
  }

  const actorUrls = Array.isArray(body?.actor_urls)
    ? [...new Set(body.actor_urls)]
        .slice(0, MAX_ACTOR_PROFILES)
        .map(validateIafdPersonUrl)
    : [];
  const resultGroups = [];
  const failures = [];

  for (const actorUrl of actorUrls) {
    try {
      const html = await fetchIafdHtml(actorUrl, "person");
      resultGroups.push(
        parseIafdSearchHtml(html, {
          query,
          year,
          source: "IAFD-Filmografie",
        })
      );
    } catch (error) {
      failures.push(error);
    }
  }

  let results = mergeAndRankIafdResults(resultGroups, query, year);
  if (!results.length || results[0].score < 0.62) {
    try {
      const searchUrl = buildIafdSearchUrl(query);
      const html = await fetchIafdHtml(searchUrl, "search");
      resultGroups.push(
        parseIafdSearchHtml(html, {
          query,
          year,
          source: "IAFD-Titelsuche",
        })
      );
      results = mergeAndRankIafdResults(resultGroups, query, year);
    } catch (error) {
      failures.push(error);
    }
  }

  if (!results.length && failures.length) throw failures.at(-1);
  return {
    query,
    year,
    strategy: actorUrls.length ? "filmography_then_title" : "title_search",
    results,
  };
}

async function loadIafdDetails(body, supabase) {
  const url = validateIafdTitleUrl(body?.url);
  const [html, context] = await Promise.all([
    fetchIafdHtml(url, "title"),
    loadMappingContext(supabase),
  ]);
  const details = parseIafdTitleHtml(html, url);
  const studioMatch = bestEntityMatch(details.studio, context.studios, 0.82);
  const mainActorIds = [];
  const supportingActorIds = [];
  const matchedCast = [];
  const unmatchedCast = [];

  details.cast.forEach((performer) => {
    const mainMatch = bestEntityMatch(performer.name, context.mainActors, 0.88);
    if (mainMatch) {
      mainActorIds.push(mainMatch.item.id);
      matchedCast.push({
        iafd_name: performer.name,
        local_name: mainMatch.item.name,
        type: "main",
        id: mainMatch.item.id,
      });
      return;
    }

    const supportMatch = bestEntityMatch(
      performer.name,
      context.supportActors,
      0.88
    );
    if (supportMatch) {
      supportingActorIds.push(supportMatch.item.id);
      matchedCast.push({
        iafd_name: performer.name,
        local_name: supportMatch.item.name,
        type: "supporting",
        id: supportMatch.item.id,
      });
      return;
    }

    unmatchedCast.push({ name: performer.name, url: performer.url });
  });

  return {
    ...details,
    studio_match: studioMatch
      ? {
          id: studioMatch.item.id,
          name: studioMatch.item.name,
          score: studioMatch.score,
        }
      : null,
    main_actor_ids: [...new Set(mainActorIds)],
    supporting_actor_ids: [...new Set(supportingActorIds)],
    tag_ids: matchTags(
      `${details.page_text} ${details.synopsis || ""}`,
      context.tags
    ),
    matched_cast: matchedCast,
    unmatched_cast: unmatchedCast,
  };
}

export async function POST(request) {
  if (!(await hasLibrarySession())) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (body?.action === "search") {
      return json({ search: await searchIafd(body) });
    }
    if (body?.action === "details") {
      const supabase = createServerSupabase();
      return json({ metadata: await loadIafdDetails(body, supabase) });
    }
    return json({ error: "Unbekannte IAFD-Aktion." }, { status: 400 });
  } catch (error) {
    console.error("IAFD import request failed:", error);
    const known = error instanceof IafdError;
    return json(
      {
        error: known
          ? error.message
          : "Die IAFD-Daten konnten nicht verarbeitet werden.",
        code: known ? error.code : "IAFD_INTERNAL_ERROR",
      },
      { status: known ? error.status : 500 }
    );
  }
}
