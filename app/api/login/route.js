import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const { password } = body || {};

    const expected = process.env.AUTH_PASSWORD;
    if (!expected) {
      console.error("AUTH_PASSWORD ist nicht gesetzt.");
      return NextResponse.json(
        { ok: false, error: "Server-Konfiguration fehlt." },
        { status: 500 }
      );
    }

    if (!password || password !== expected) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });

    // Einfaches Login-Cookie setzen
    res.cookies.set("auth_1337", "ok", {
      httpOnly: true,
      sameSite: "strict",
      secure: true, // auf Vercel immer HTTPS
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
    });

    return res;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: "Bad request" },
      { status: 400 }
    );
  }
}
