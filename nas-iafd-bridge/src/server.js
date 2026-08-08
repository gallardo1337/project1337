import http from "node:http";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.js";
import { BridgeError } from "./errors.js";
import { IafdBrowser } from "./iafd-browser.js";
import { FixedWindowRateLimiter } from "./rate-limiter.js";
import { verifyRequestSignature } from "./security.js";

const config = loadConfig();
const browser = new IafdBrowser(config);
const rateLimiter = new FixedWindowRateLimiter(config.maxRequestsPerMinute);

function sendJson(response, status, body, requestId) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Request-Id": requestId,
  });
  response.end(payload);
}

async function readBody(request, limit = 16384) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      throw new BridgeError("Anfrage ist zu groß.", "BODY_TOO_LARGE", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  try {
    const requestUrl = new URL(request.url || "/", "http://bridge.local");
    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(
        response,
        200,
        { ok: true, service: "project1337-iafd-bridge", ...browser.stats() },
        requestId
      );
      return;
    }

    if (request.method !== "POST" || requestUrl.pathname !== "/v1/fetch") {
      throw new BridgeError("Route nicht gefunden.", "NOT_FOUND", 404);
    }
    if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
      throw new BridgeError("Content-Type muss application/json sein.", "INVALID_CONTENT_TYPE", 415);
    }

    const rawBody = await readBody(request);
    verifyRequestSignature({
      secret: config.secret,
      timestamp: request.headers["x-iafd-timestamp"],
      signature: request.headers["x-iafd-signature"],
      rawBody,
    });
    rateLimiter.consume();

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new BridgeError("JSON-Anfrage ist ungültig.", "INVALID_JSON", 400);
    }

    const result = await browser.fetchHtml(body?.url);
    sendJson(response, 200, { ok: true, ...result }, requestId);
    console.log(
      JSON.stringify({
        level: "info",
        event: "iafd_fetch",
        request_id: requestId,
        cached: result.cached,
        duration_ms: Date.now() - startedAt,
      })
    );
  } catch (error) {
    const known = error instanceof BridgeError;
    const status = known ? error.status : 500;
    const code = known ? error.code : "INTERNAL_ERROR";
    sendJson(
      response,
      status,
      { ok: false, error: known ? error.message : "Interner Bridge-Fehler.", code },
      requestId
    );
    console.error(
      JSON.stringify({
        level: "error",
        event: "request_failed",
        request_id: requestId,
        code,
        status,
        duration_ms: Date.now() - startedAt,
      })
    );
  }
});

server.requestTimeout = config.navigationTimeoutMs + config.challengeWaitMs + 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "bridge_started",
      host: config.host,
      port: config.port,
      headless: config.headless,
    })
  );
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  server.close();
  await browser.close().catch(() => undefined);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
