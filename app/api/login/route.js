import { NextResponse } from "next/server";

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

    const res = NextResponse.json({ ok: true, user: expectedUser });

    // Cookie setzen (optional, falls du später doch Middleware willst)
    res.cookies.set("auth_1337", "ok", {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
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
