import { NextResponse } from "next/server";
import {
  createServerSupabase,
  hasLibrarySession,
} from "../../../../lib/serverSupabase";
import {
  hashDeviceCredential,
  isValidUserCode,
  normalizeUserCode,
} from "../../../../lib/tvDeviceAuth.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(payload, init = {}) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) {
    return noStoreJson({ error: "Ungültige Anfrage." }, { status: 403 });
  }

  if (!(await hasLibrarySession())) {
    return noStoreJson(
      { error: "Bitte zuerst auf dem Handy anmelden." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userCode = normalizeUserCode(body?.userCode);

    if (!isValidUserCode(userCode)) {
      return noStoreJson({ error: "Der Gerätecode ist ungültig." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: login, error } = await supabase
      .from("tv_device_logins")
      .select("id, status, expires_at, consumed_at, device_name")
      .eq("user_code_hash", hashDeviceCredential(userCode))
      .maybeSingle();

    if (error) throw error;
    if (!login) {
      return noStoreJson({ error: "Der Gerätecode wurde nicht gefunden." }, { status: 404 });
    }

    if (Date.parse(login.expires_at) <= Date.now()) {
      await supabase.from("tv_device_logins").delete().eq("id", login.id);
      return noStoreJson(
        { error: "Der Gerätecode ist abgelaufen." },
        { status: 410 }
      );
    }

    if (login.consumed_at) {
      return noStoreJson(
        { error: "Der Gerätecode wurde bereits verwendet." },
        { status: 409 }
      );
    }

    if (login.status !== "approved") {
      const { data: approved, error: updateError } = await supabase
        .from("tv_device_logins")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
        })
        .eq("id", login.id)
        .eq("status", "pending")
        .is("consumed_at", null)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!approved) {
        return noStoreJson(
          { error: "Der Gerätecode konnte nicht bestätigt werden." },
          { status: 409 }
        );
      }
    }

    return noStoreJson({
      ok: true,
      status: "approved",
      deviceName: login.device_name || "Apple TV",
    });
  } catch (error) {
    console.error("TV device login approval failed", error);
    return noStoreJson(
      { error: "Der Apple TV konnte nicht freigegeben werden." },
      { status: 500 }
    );
  }
}
