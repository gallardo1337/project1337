import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const LIBRARY_SESSION_COOKIE = "auth_1337";

export function setLibrarySessionCookie(response) {
  response.cookies.set(LIBRARY_SESSION_COOKIE, "ok", {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

export async function hasLibrarySession() {
  const cookieStore = await cookies();
  return cookieStore.get(LIBRARY_SESSION_COOKIE)?.value === "ok";
}

export function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "Supabase-Serverkonfiguration fehlt (SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
