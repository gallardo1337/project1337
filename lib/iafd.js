import * as cheerio from "cheerio";

const IAFD_ORIGIN = "https://www.iafd.com";
const TITLE_PATH_PATTERN = /^\/title\.rme(?:\/|$)/i;
const PERSON_PATH_PATTERN = /^\/person\.rme(?:\/|$)/i;
const EMPTY_VALUES = new Set([
  "",
  "no data",
  "no director",
  "none",
  "unknown",
]);

export class IafdError extends Error {
  constructor(message, code = "IAFD_ERROR", status = 502) {
    super(message);
    this.name = "IafdError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeIafdText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function usefulText(value) {
  const text = compactText(value);
  return EMPTY_VALUES.has(normalizeIafdText(text)) ? "" : text;
}

function absoluteIafdUrl(value, expectedType = "title") {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim(), IAFD_ORIGIN);
  } catch {
    throw new IafdError("Die IAFD-Adresse ist ungültig.", "INVALID_IAFD_URL", 400);
  }

  if (!new Set(["iafd.com", "www.iafd.com"]).has(parsed.hostname.toLowerCase())) {
    throw new IafdError(
      "Es sind ausschließlich Links von iafd.com erlaubt.",
      "INVALID_IAFD_HOST",
      400
    );
  }

  const pattern = expectedType === "person" ? PERSON_PATH_PATTERN : TITLE_PATH_PATTERN;
  if (!pattern.test(parsed.pathname)) {
    throw new IafdError(
      expectedType === "person"
        ? "Der Link muss auf ein IAFD-Darstellerprofil führen."
        : "Der Link muss auf eine IAFD-Filmseite führen.",
      "INVALID_IAFD_PATH",
      400
    );
  }

  parsed.protocol = "https:";
  parsed.hostname = "www.iafd.com";
  parsed.port = "";
  parsed.hash = "";
  return parsed.toString();
}

export function validateIafdTitleUrl(value) {
  return absoluteIafdUrl(value, "title");
}

export function validateIafdPersonUrl(value) {
  return absoluteIafdUrl(value, "person");
}

function tokenSimilarity(leftValue, rightValue) {
  const leftText = normalizeIafdText(leftValue);
  const rightText = normalizeIafdText(rightValue);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;

  const left = new Set(leftText.split(" ").filter(Boolean));
  const right = new Set(rightText.split(" ").filter(Boolean));
  let overlap = 0;
  left.forEach((token) => {
    if (right.has(token)) overlap += 1;
  });

  const dice = (2 * overlap) / (left.size + right.size);
  const contains =
    leftText.includes(rightText) || rightText.includes(leftText) ? 0.86 : 0;
  return Math.max(dice, contains);
}

function titleScore(query, candidate, queryYear, candidateYear) {
  let score = tokenSimilarity(query, candidate);
  if (queryYear && candidateYear) {
    score += Number(queryYear) === Number(candidateYear) ? 0.1 : -0.12;
  }
  return Math.max(0, Math.min(1, score));
}

function yearFromText(value) {
  const match = String(value || "").match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function cleanTitle(value) {
  return compactText(value)
    .replace(/\s*\((?:19|20)\d{2}\)\s*$/, "")
    .trim();
}

function resultFromAnchor($, element, source) {
  const link = $(element);
  const href = link.attr("href");
  const title = cleanTitle(link.text());
  if (!href || !title || title.length > 250) return null;

  let url;
  try {
    url = validateIafdTitleUrl(href);
  } catch {
    return null;
  }

  const row = link.closest("tr");
  const rowText = compactText(row.text());
  const cells = row
    .find("td")
    .map((_, cell) => compactText($(cell).text()))
    .get()
    .filter(Boolean);
  const urlYear = url.match(/\/year=(19\d{2}|20\d{2})(?:\/|$)/i)?.[1];
  const year = Number(urlYear) || yearFromText(rowText) || yearFromText(link.text());

  const studio =
    cells.find(
      (cell) =>
        cell !== title &&
        !/^\d{4}$/.test(cell) &&
        !/^(movie|video|scene|title)$/i.test(cell)
    ) || "";

  return { title, year: year || null, studio, url, source };
}

export function parseIafdSearchHtml(html, options = {}) {
  const $ = cheerio.load(String(html || ""));
  const source = options.source || "IAFD-Suche";
  const query = options.query || "";
  const year = options.year || null;
  const seen = new Set();
  const results = [];

  $('a[href*="title.rme"]').each((_, element) => {
    const candidate = resultFromAnchor($, element, source);
    if (!candidate || seen.has(candidate.url)) return;
    seen.add(candidate.url);
    results.push({
      ...candidate,
      score: titleScore(query, candidate.title, year, candidate.year),
    });
  });

  return results
    .filter((result) => !query || result.score >= 0.18)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (year && left.year !== right.year) {
        if (left.year === Number(year)) return -1;
        if (right.year === Number(year)) return 1;
      }
      return left.title.localeCompare(right.title, "en", { sensitivity: "base" });
    })
    .slice(0, 14);
}

function bioValue($, labels) {
  const wanted = labels.map(normalizeIafdText);
  let result = "";
  $(".bioheading").each((_, element) => {
    if (result) return;
    const heading = normalizeIafdText($(element).text());
    if (!wanted.some((label) => heading === label || heading.startsWith(label))) {
      return;
    }
    result = usefulText(
      $(element)
        .nextAll(".biodata")
        .first()
        .text()
    );
  });
  return result;
}

function canonicalFromPage($, fallbackUrl) {
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) {
    try {
      return validateIafdTitleUrl(canonical);
    } catch {
      // Continue with the human-readable link used by IAFD itself.
    }
  }

  const panelText = compactText($(".panel:last-of-type .padded-panel").text());
  const linkedUrl = panelText.match(/should be linked to:\s*(https?:\/\/\S+)/i)?.[1];
  if (linkedUrl) {
    try {
      return validateIafdTitleUrl(linkedUrl);
    } catch {
      // Use the verified request URL below.
    }
  }
  return validateIafdTitleUrl(fallbackUrl);
}

export function parseIafdTitleHtml(html, requestUrl) {
  const $ = cheerio.load(String(html || ""));
  const heading = usefulText($("h1").first().text());
  if (!heading) {
    throw new IafdError(
      "IAFD hat keine erkennbare Filmseite geliefert.",
      "IAFD_PARSE_FAILED"
    );
  }

  const year = yearFromText(heading) || yearFromText(bioValue($, ["Release Date"]));
  const title = cleanTitle(heading);
  const studio =
    bioValue($, ["Studio", "Studios"]) ||
    bioValue($, ["Distributor", "Distributors"]);
  const releaseDate = bioValue($, ["Release Date"]);
  const minutesText = bioValue($, ["Minutes", "Running Time", "Runtime"]);
  const director = bioValue($, ["Director", "Directors"]);
  const synopsis = usefulText($("#synopsis .padded-panel").text());
  const cast = [];
  const seenCast = new Set();

  $(".castbox p a, .castbox a").each((_, element) => {
    const name = usefulText($(element).text());
    const key = normalizeIafdText(name);
    if (!key || seenCast.has(key)) return;
    seenCast.add(key);
    const href = $(element).attr("href");
    let url = "";
    if (href) {
      try {
        url = validateIafdPersonUrl(href);
      } catch {
        url = "";
      }
    }
    cast.push({ name, url });
  });

  const allText = compactText($("body").text());
  const minutes = Number(minutesText.match(/\d{1,4}/)?.[0]) || null;

  return {
    title,
    year: year || null,
    studio,
    director,
    release_date: releaseDate,
    duration_minutes: minutes,
    synopsis,
    cast,
    page_text: allText,
    url: canonicalFromPage($, requestUrl),
  };
}

function looksUnavailable(html) {
  const text = normalizeIafdText(String(html || "").slice(0, 12000));
  return (
    !text ||
    text.includes("site unavailable unable to access this site") ||
    text.includes("attention required cloudflare") ||
    text.includes("checking your browser") ||
    text.includes("verify you are human")
  );
}

export async function fetchIafdHtml(url, expectedType = "title") {
  const safeUrl =
    expectedType === "person"
      ? validateIafdPersonUrl(url)
      : expectedType === "search"
      ? String(url)
      : validateIafdTitleUrl(url);
  const parsed = new URL(safeUrl);
  if (!new Set(["iafd.com", "www.iafd.com"]).has(parsed.hostname.toLowerCase())) {
    throw new IafdError("Die IAFD-Adresse ist nicht erlaubt.", "INVALID_IAFD_HOST", 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(safeUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,de;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      },
    });
    const html = await response.text();
    if (!response.ok || looksUnavailable(html)) {
      throw new IafdError(
        "IAFD ist für die automatische Abfrage gerade nicht erreichbar. Du kannst unten trotzdem einen direkten IAFD-Link einsetzen und es erneut versuchen.",
        "IAFD_UNAVAILABLE",
        503
      );
    }
    return html;
  } catch (error) {
    if (error instanceof IafdError) throw error;
    if (error?.name === "AbortError") {
      throw new IafdError(
        "IAFD hat nicht rechtzeitig geantwortet. Bitte gleich noch einmal versuchen.",
        "IAFD_TIMEOUT",
        504
      );
    }
    throw new IafdError(
      "Die IAFD-Daten konnten gerade nicht geladen werden.",
      "IAFD_FETCH_FAILED",
      503
    );
  } finally {
    clearTimeout(timer);
  }
}

export function buildIafdSearchUrl(query) {
  const search = compactText(query).slice(0, 180);
  if (!search) {
    throw new IafdError("Für die IAFD-Suche fehlt ein Titel.", "IAFD_QUERY_MISSING", 400);
  }
  const url = new URL("/results.asp", IAFD_ORIGIN);
  url.searchParams.set("searchtype", "title");
  url.searchParams.set("searchstring", search);
  return url.toString();
}

export function mergeAndRankIafdResults(resultGroups, query, year) {
  const byUrl = new Map();
  resultGroups.flat().forEach((result) => {
    const previous = byUrl.get(result.url);
    if (!previous || result.score > previous.score) byUrl.set(result.url, result);
  });
  return [...byUrl.values()]
    .map((result) => ({
      ...result,
      score: titleScore(query, result.title, year, result.year),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 14);
}
