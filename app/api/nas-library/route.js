import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { analyzeNasLibrary } from "../../../lib/nasLibraryAnalysis.mjs";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PAGE_SIZE = 1000;
const MAX_DATABASE_ROWS = 25000;
const MAX_INVENTORY_FILES = 50000;
const MAX_SCANNER_RESPONSE_BYTES = 12 * 1024 * 1024;

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

function scannerConfiguration() {
  const rawUrl = String(process.env.NAS_LIBRARY_SCANNER_URL || "").trim();
  const secret = String(process.env.NAS_LIBRARY_SCANNER_SECRET || "").trim();

  if (!rawUrl || Buffer.byteLength(secret, "utf8") < 32) return null;

  let url;
  try {
    url = new URL("/inventory", rawUrl);
  } catch {
    return null;
  }

  const developmentLoopback =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    new Set(["127.0.0.1", "localhost", "::1"]).has(url.hostname);

  if (url.protocol !== "https:" && !developmentLoopback) return null;

  const configuredTimeout = Number(process.env.NAS_LIBRARY_SCANNER_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(configuredTimeout)
    ? Math.min(55000, Math.max(5000, configuredTimeout))
    : 45000;

  return { url, secret, timeoutMs };
}

function requestSignature(secret, timestamp, rawBody) {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
}

async function fetchInventory(refresh) {
  const config = scannerConfiguration();
  if (!config) {
    const error = new Error("Der NAS Library Scanner ist noch nicht verbunden.");
    error.code = "SCANNER_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }

  const rawBody = JSON.stringify({ refresh: Boolean(refresh) });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Project1337-NasLibrary/1.0",
        "X-Project1337-Timestamp": timestamp,
        "X-Project1337-Signature": requestSignature(
          config.secret,
          timestamp,
          rawBody
        ),
      },
      body: rawBody,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_SCANNER_RESPONSE_BYTES
    ) {
      const error = new Error("Das NAS-Inventar überschreitet das sichere Größenlimit.");
      error.code = "SCANNER_RESPONSE_TOO_LARGE";
      error.status = 502;
      throw error;
    }

    const responseBody = await response.text();
    if (Buffer.byteLength(responseBody, "utf8") > MAX_SCANNER_RESPONSE_BYTES) {
      const error = new Error("Das NAS-Inventar überschreitet das sichere Größenlimit.");
      error.code = "SCANNER_RESPONSE_TOO_LARGE";
      error.status = 502;
      throw error;
    }

    let payload = null;
    try {
      payload = JSON.parse(responseBody);
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const error = new Error(
        payload?.error || `NAS Library Scanner antwortet mit HTTP ${response.status}.`
      );
      error.code = payload?.code || "SCANNER_REQUEST_FAILED";
      error.status = response.status >= 400 && response.status < 500 ? 502 : 503;
      throw error;
    }

    if (
      !payload ||
      !Array.isArray(payload.files) ||
      payload.files.length > MAX_INVENTORY_FILES
    ) {
      const error = new Error("Der NAS Library Scanner hat ungültige Daten geliefert.");
      error.code = "INVALID_SCANNER_RESPONSE";
      error.status = 502;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Der NAS-Scan hat das Zeitlimit überschritten.");
      timeoutError.code = "SCANNER_TIMEOUT";
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchAllRows(supabase, table, columns) {
  const rows = [];

  for (let from = 0; from < MAX_DATABASE_ROWS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }

  throw new Error(`Die Tabelle ${table} überschreitet das sichere Analyselimit.`);
}

export async function GET(request) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  try {
    const supabase = createServerSupabase();
    const [inventory, movies, actors, resolutions] = await Promise.all([
      fetchInventory(refresh),
      fetchAllRows(
        supabase,
        "movies",
        "id,title,file_url,resolution_id,main_actor_ids"
      ),
      fetchAllRows(supabase, "actors", "id,name"),
      fetchAllRows(supabase, "resolutions", "id,name"),
    ]);

    return noStoreJson({
      report: analyzeNasLibrary({ inventory, movies, actors, resolutions }),
    });
  } catch (error) {
    const code = error?.code || "NAS_LIBRARY_ANALYSIS_FAILED";
    const status = Number(error?.status) || 500;
    console.error("NAS library analysis failed:", {
      code,
      message: error?.message,
    });

    return noStoreJson(
      {
        error:
          status >= 500 && code === "NAS_LIBRARY_ANALYSIS_FAILED"
            ? "Die NAS-Bibliothek konnte nicht analysiert werden."
            : error?.message || "Die NAS-Bibliothek konnte nicht analysiert werden.",
        code,
        setup_required: code === "SCANNER_NOT_CONFIGURED",
      },
      { status }
    );
  }
}
