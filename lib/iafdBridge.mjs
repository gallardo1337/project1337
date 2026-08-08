import { createHmac } from "node:crypto";

export class IafdBridgeClientError extends Error {
  constructor(message, code = "IAFD_BRIDGE_ERROR", status = 503) {
    super(message);
    this.name = "IafdBridgeClientError";
    this.code = code;
    this.status = status;
  }
}

function timeoutFromEnv() {
  const parsed = Number(process.env.IAFD_BRIDGE_TIMEOUT_MS || 60000);
  if (!Number.isFinite(parsed)) return 60000;
  return Math.max(10000, Math.min(70000, Math.round(parsed)));
}

function bridgeConfig() {
  const rawUrl = String(process.env.IAFD_BRIDGE_URL || "").trim();
  const secret = String(process.env.IAFD_BRIDGE_SECRET || "").trim();
  if (!rawUrl || !secret) {
    throw new IafdBridgeClientError(
      "Die IAFD-NAS-Bridge ist noch nicht konfiguriert.",
      "IAFD_BRIDGE_NOT_CONFIGURED",
      503
    );
  }
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new IafdBridgeClientError(
      "Das Secret der IAFD-NAS-Bridge ist ungültig.",
      "IAFD_BRIDGE_CONFIG_INVALID",
      500
    );
  }

  let baseUrl;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    throw new IafdBridgeClientError(
      "Die Adresse der IAFD-NAS-Bridge ist ungültig.",
      "IAFD_BRIDGE_CONFIG_INVALID",
      500
    );
  }
  const localDevelopment = new Set(["localhost", "127.0.0.1", "::1"]).has(
    baseUrl.hostname
  );
  if (
    (baseUrl.protocol !== "https:" && !(localDevelopment && baseUrl.protocol === "http:")) ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new IafdBridgeClientError(
      "Die IAFD-NAS-Bridge muss über HTTPS erreichbar sein.",
      "IAFD_BRIDGE_CONFIG_INVALID",
      500
    );
  }

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, "")}/v1/fetch`;
  baseUrl.search = "";
  baseUrl.hash = "";
  return { endpoint: baseUrl.toString(), secret, timeoutMs: timeoutFromEnv() };
}

export function signIafdBridgeRequest(secret, timestamp, rawBody) {
  return `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex")}`;
}

export async function fetchIafdHtmlThroughBridge(url) {
  const { endpoint, secret, timeoutMs } = bridgeConfig();
  const rawBody = JSON.stringify({ url });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signIafdBridgeRequest(secret, timestamp, rawBody);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-IAFD-Timestamp": timestamp,
        "X-IAFD-Signature": signature,
      },
      body: rawBody,
    });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new IafdBridgeClientError(
        "Die IAFD-NAS-Bridge hat ungültig geantwortet.",
        "IAFD_BRIDGE_INVALID_RESPONSE",
        502
      );
    }

    if (!response.ok || !payload?.ok) {
      throw new IafdBridgeClientError(
        payload?.error || "Die IAFD-NAS-Bridge konnte die Seite nicht laden.",
        payload?.code || "IAFD_BRIDGE_REQUEST_FAILED",
        response.status >= 400 && response.status <= 599 ? response.status : 502
      );
    }
    if (typeof payload.html !== "string" || !payload.html.trim()) {
      throw new IafdBridgeClientError(
        "Die IAFD-NAS-Bridge hat keine Seite geliefert.",
        "IAFD_BRIDGE_INVALID_RESPONSE",
        502
      );
    }
    return payload.html;
  } catch (error) {
    if (error instanceof IafdBridgeClientError) throw error;
    if (error?.name === "AbortError") {
      throw new IafdBridgeClientError(
        "Die IAFD-NAS-Bridge hat nicht rechtzeitig geantwortet.",
        "IAFD_BRIDGE_TIMEOUT",
        504
      );
    }
    throw new IafdBridgeClientError(
      "Die IAFD-NAS-Bridge ist nicht erreichbar.",
      "IAFD_BRIDGE_UNAVAILABLE",
      503
    );
  } finally {
    clearTimeout(timer);
  }
}
