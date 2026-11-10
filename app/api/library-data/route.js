import { NextResponse } from "next/server";
import { createServerSupabase, hasLibrarySession } from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLES = new Set(["movies", "actors", "actors2", "studios", "tags", "resolutions"]);
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

function respond(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}

export function validateLibraryQuery(body) {
  if (!body || !TABLES.has(body.table) || !["select", "insert", "update", "delete"].includes(body.action)) {
    throw new Error("Ungültige Datenbankoperation.");
  }
  if (body.columns !== "*") throw new Error("Ungültige Spaltenauswahl.");
  if (!Array.isArray(body.filters) || body.filters.length > 5 ||
      body.filters.some(f => !f || f.op !== "eq" || !IDENTIFIER.test(f.column) ||
        !["string", "number", "boolean"].includes(typeof f.value))) {
    throw new Error("Ungültiger Filter.");
  }
  if (!Array.isArray(body.orders) || body.orders.length > 3 ||
      body.orders.some(o => !o || !IDENTIFIER.test(o.column) || typeof o.ascending !== "boolean")) {
    throw new Error("Ungültige Sortierung.");
  }
  if (body.range !== undefined && (!Array.isArray(body.range) || body.range.length !== 2 ||
    !body.range.every(Number.isSafeInteger) || body.range[0] < 0 ||
    body.range[1] < body.range[0] || body.range[1] - body.range[0] >= 1000)) {
    throw new Error("Ungültiger Datenbereich.");
  }
  if (body.action !== "select") {
    if (body.range !== undefined || body.orders.length || (body.action !== "insert" &&
        !body.filters.some(f => f.column === "id"))) {
      throw new Error("Schreiboperation benötigt eine eindeutige ID.");
    }
    if (body.action === "delete" ? body.values !== undefined :
      !body.values || Array.isArray(body.values) || typeof body.values !== "object") {
      throw new Error("Ungültige Nutzdaten.");
    }
  }
  if (body.single !== undefined && typeof body.single !== "boolean") {
    throw new Error("Ungültiger Rückgabetyp.");
  }
  return body;
}

export async function POST(request) {
  if (!(await hasLibrarySession())) return respond({ error: "Unauthorized" }, 401);

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  let sameOrigin = false;
  try { sameOrigin = !!origin && !!host && new URL(origin).host === host; } catch { /* invalid origin */ }
  if (!sameOrigin) {
    return respond({ error: "Origin nicht erlaubt." }, 403);
  }

  let body;
  try {
    if (Number(request.headers.get("content-length") || 0) > 256000) return respond({ error: "Anfrage zu groß." }, 413);
    body = validateLibraryQuery(await request.json());
  } catch (error) {
    return respond({ error: error.message || "Ungültige Anfrage." }, 400);
  }

  try {
    const supabase = createServerSupabase();
    let query;
    switch (body.action) {
      case "insert": query = supabase.from(body.table).insert(body.values); break;
      case "update": query = supabase.from(body.table).update(body.values); break;
      case "delete": query = supabase.from(body.table).delete(); break;
      default: query = supabase.from(body.table).select("*");
    }
    for (const filter of body.filters) query = query.eq(filter.column, filter.value);
    for (const order of body.orders) query = query.order(order.column, { ascending: order.ascending });
    if (body.range) query = query.range(body.range[0], body.range[1]);
    if (body.action !== "select" && body.action !== "delete") query = query.select("*");
    if (body.single) query = query.single();

    const { data, error } = await query;
    if (error) {
      console.error("Library-data query failed", error);
      return respond({ error: "Datenbankoperation fehlgeschlagen." }, 500);
    }
    return respond({ data });
  } catch (error) {
    console.error("Library-data request failed", error);
    return respond({ error: "Serverfehler." }, 500);
  }
}
