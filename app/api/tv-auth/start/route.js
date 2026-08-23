import { NextResponse } from "next/server";
import { createServerSupabase } from "../../../../lib/serverSupabase";
import {
  DEVICE_AUTH_POLL_INTERVAL_SECONDS,
  DEVICE_AUTH_RATE_LIMIT_PER_MINUTE,
  DEVICE_AUTH_TTL_SECONDS,
  generateDeviceCredentials,
  getRequestIp,
  hashDeviceCredential,
} from "../../../../lib/tvDeviceAuth.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStoreJson(payload, init = {}) {
  const response = NextResponse.json(payload, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function cleanDeviceName(value) {
  const name = String(value || "Apple TV").trim().slice(0, 80);
  return name || "Apple TV";
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const deviceName = cleanDeviceName(body?.deviceName);
    const requestIpHash = hashDeviceCredential(`ip:${getRequestIp(request)}`);
    const supabase = createServerSupabase();
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

    const { count, error: countError } = await supabase
      .from("tv_device_logins")
      .select("id", { count: "exact", head: true })
      .eq("request_ip_hash", requestIpHash)
      .gte("created_at", oneMinuteAgo);

    if (countError) throw countError;

    if ((count || 0) >= DEVICE_AUTH_RATE_LIMIT_PER_MINUTE) {
      const response = noStoreJson(
        { error: "Zu viele neue Codes. Bitte kurz warten." },
        { status: 429 }
      );
      response.headers.set("Retry-After", "60");
      return response;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { deviceToken, userCode } = generateDeviceCredentials();
      const expiresAt = new Date(
        Date.now() + DEVICE_AUTH_TTL_SECONDS * 1000
      ).toISOString();

      const { error } = await supabase.from("tv_device_logins").insert({
        device_token_hash: hashDeviceCredential(deviceToken),
        user_code_hash: hashDeviceCredential(userCode.replace("-", "")),
        device_name: deviceName,
        request_ip_hash: requestIpHash,
        expires_at: expiresAt,
      });

      if (!error) {
        const verificationUrl = new URL("/tv-aktivieren", request.nextUrl.origin);
        verificationUrl.searchParams.set("code", userCode);

        return noStoreJson({
          deviceToken,
          userCode,
          verificationUrl: verificationUrl.toString(),
          expiresIn: DEVICE_AUTH_TTL_SECONDS,
          interval: DEVICE_AUTH_POLL_INTERVAL_SECONDS,
        });
      }

      if (error.code !== "23505") throw error;
    }

    return noStoreJson(
      { error: "Der Gerätecode konnte nicht erzeugt werden." },
      { status: 503 }
    );
  } catch (error) {
    console.error("TV device login start failed", error);
    return noStoreJson(
      { error: "QR-Anmeldung ist gerade nicht verfügbar." },
      { status: 500 }
    );
  }
}
