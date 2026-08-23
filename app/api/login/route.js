import { NextResponse } from "next/server";
import {
  hasLibrarySession,
  setLibrarySessionCookie,
} from "../../../lib/serverSupabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const authenticated = await hasLibrarySession();

  return NextResponse.json(
    { ok: authenticated },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body || {};

    const expectedUser = process.env.AUTH_USER;
    const expectedPass = process.env.AUTH_PASSWORD;

    if (!expectedUser || !expectedPass) {
      console.error("AUTH_USER oder AUTH_PASSWORD ist nicht gesetzt.");
      return NextResponse.json(
        { ok: false, error: "Server-Konfiguration fehlt." },
        { status: 500 }
      );
    }

    if (username !== expectedUser || password !== expectedPass) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    return setLibrarySessionCookie(
      NextResponse.json({ ok: true, user: expectedUser })
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Bad request" },
      { status: 400 }
    );
  }
}
