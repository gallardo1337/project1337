import { NextResponse } from "next/server";
import {
  createServerSupabase,
  setLibrarySessionCookie,
} from "../../../../lib/serverSupabase";
import {
  DEVICE_AUTH_REPLAY_GRACE_SECONDS,
  hashDeviceCredential,
  isValidDeviceToken,
} from "../../../../lib/tvDeviceAuth.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(payload, init = {}) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceToken = body?.deviceToken;

    if (!isValidDeviceToken(deviceToken)) {
      return noStoreJson({ error: "Ungültiger Gerätecode." }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: login, error } = await supabase
      .from("tv_device_logins")
      .select("id, status, expires_at, consumed_at")
      .eq("device_token_hash", hashDeviceCredential(deviceToken))
      .maybeSingle();

    if (error) throw error;
    if (!login) {
      return noStoreJson({ error: "Gerätecode nicht gefunden." }, { status: 404 });
    }

    const now = Date.now();
    if (Date.parse(login.expires_at) <= now) {
      await supabase.from("tv_device_logins").delete().eq("id", login.id);
      return noStoreJson(
        { status: "expired", error: "Der Gerätecode ist abgelaufen." },
        { status: 410 }
      );
    }

    if (login.status !== "approved") {
      return noStoreJson({ status: "pending" }, { status: 202 });
    }

    if (login.consumed_at) {
      const consumedAge = now - Date.parse(login.consumed_at);
      if (consumedAge > DEVICE_AUTH_REPLAY_GRACE_SECONDS * 1000) {
        return noStoreJson(
          { status: "consumed", error: "Der Gerätecode wurde bereits verwendet." },
          { status: 410 }
        );
      }
    } else {
      const { error: consumeError } = await supabase
        .from("tv_device_logins")
        .update({ consumed_at: new Date(now).toISOString() })
        .eq("id", login.id)
        .is("consumed_at", null);

      if (consumeError) throw consumeError;
    }

    return setLibrarySessionCookie(
      noStoreJson({ status: "authorized", ok: true })
    );
  } catch (error) {
    console.error("TV device login poll failed", error);
    return noStoreJson(
      { error: "QR-Anmeldung konnte nicht geprüft werden." },
      { status: 500 }
    );
  }
}
