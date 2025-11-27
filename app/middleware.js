import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/login", "/favicon.ico", "/logo.svg"];

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Öffentliche Pfade (Login, Static)
  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p)) ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  // Cookie prüfen
  const authCookie = req.cookies.get("auth_1337")?.value;

  if (authCookie === "ok") {
    return NextResponse.next();
  }

  // Kein gültiges Cookie => auf /login umleiten
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

// Matcher: alles außer Next-Static
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
