import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../lib/serverSupabase";
import {
  DEFAULT_HOMEPAGE_SECTIONS,
  normalizeHomepageSections,
} from "../../../lib/homepageSections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers,
    },
  });
}

export async function GET() {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("homepage_settings")
      .select("sections,updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    return noStoreJson({
      sections: normalizeHomepageSections(
        data?.sections || DEFAULT_HOMEPAGE_SECTIONS
      ),
      updated_at: data?.updated_at || null,
    });
  } catch (error) {
    console.error("Homepage settings could not be loaded:", error);
    return noStoreJson(
      { error: "Startseiten-Konfiguration konnte nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  if (!(await hasLibrarySession())) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (!Array.isArray(body?.sections)) {
      return noStoreJson(
        { error: "Die Startseiten-Konfiguration ist ungültig." },
        { status: 400 }
      );
    }

    const sections = normalizeHomepageSections(body.sections, {
      fallbackToDefault: false,
    });

    if (!sections.length || !sections.some((section) => section.enabled)) {
      return noStoreJson(
        { error: "Mindestens ein sichtbarer Startseitenbereich ist erforderlich." },
        { status: 400 }
      );
    }

    const missingStudio = sections.some(
      (section) =>
        section.enabled &&
        section.type === "studio" &&
        !section.config.studio
    );
    if (missingStudio) {
      return noStoreJson(
        { error: "Für jedes aktive Studio-Spotlight muss ein Studio ausgewählt sein." },
        { status: 400 }
      );
    }

    const updatedAt = new Date().toISOString();
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("homepage_settings")
      .upsert(
        {
          id: 1,
          sections,
          updated_at: updatedAt,
        },
        { onConflict: "id" }
      )
      .select("sections,updated_at")
      .single();

    if (error) throw error;

    return noStoreJson({
      sections: normalizeHomepageSections(data.sections),
      updated_at: data.updated_at,
    });
  } catch (error) {
    console.error("Homepage settings could not be saved:", error);
    return noStoreJson(
      { error: "Startseiten-Konfiguration konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
