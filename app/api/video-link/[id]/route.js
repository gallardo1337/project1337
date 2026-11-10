import { NextResponse } from "next/server";
import { createServerSupabase, hasLibrarySession } from "../../../../lib/serverSupabase";
import { signVideoUrl, VIDEO_LINK_LIFETIME_SECONDS } from "../../../../lib/videoSignedLinks.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(_request, { params }) {
  if (!(await hasLibrarySession())) return json({ error: "Unauthorized" }, 401);
  const secret = process.env.VIDEO_SIGNING_SECRET;
  if (!secret || secret.length < 32) return json({ error: "Videolinks noch nicht konfiguriert." }, 503);

  const { id } = await params;
  if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: "Ungültige Film-ID." }, 400);
  }

  try {
    const { data, error } = await createServerSupabase().from("movies")
      .select("file_url").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data?.file_url) return json({ error: "Videodatei nicht gefunden." }, 404);

    const url = signVideoUrl(data.file_url, secret);
    return json({ url, expiresIn: VIDEO_LINK_LIFETIME_SECONDS });
  } catch (error) {
    console.error("Could not issue signed video link", error);
    return json({ error: "Videolink konnte nicht erstellt werden." }, 500);
  }
}
