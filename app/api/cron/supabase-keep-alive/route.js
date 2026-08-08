import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return json({ error: "Supabase configuration is missing." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const checks = await Promise.all([
      supabase.from("movies").select("id").limit(1),
      supabase.from("actors").select("id").limit(1),
      supabase.from("studios").select("id").limit(1),
    ]);
    const failedCheck = checks.find(({ error }) => error);

    if (failedCheck?.error) {
      throw failedCheck.error;
    }

    return json({
      ok: true,
      checkedAt: new Date().toISOString(),
      queries: checks.length,
    });
  } catch (error) {
    console.error("Supabase keep-alive failed:", error);
    return json({ error: "Supabase keep-alive failed." }, 500);
  }
}
