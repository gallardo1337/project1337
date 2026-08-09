import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./config.mjs";
import { NasLibraryScanner } from "./scanner.mjs";
import {
  FixedWindowRateLimiter,
  ScannerError,
  verifyRequestSignature,
} from "./security.mjs";

const config = loadConfig();
const scanner = new NasLibraryScanner(config);
const limiter = new FixedWindowRateLimiter(config.maxRequestsPerMinute);

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function rawBody(request, maxBytes = 1024) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) {
      throw new ScannerError("Anfrage ist zu groß.", "BODY_TOO_LARGE", 413);
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (request, response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const pathname = new URL(request.url || "/", "http://scanner.local").pathname;

  try {
    if (request.method === "GET" && pathname === "/health") {
      const snapshot = await scanner.readSavedSnapshot();
      return json(response, 200, {
        ok: true,
        service: "project1337-nas-library-scanner",
        snapshot_available: Boolean(snapshot),
        last_scan_at: snapshot?.scanned_at || null,
      });
    }

    if (request.method !== "POST" || pathname !== "/inventory") {
      throw new ScannerError("Nicht gefunden.", "NOT_FOUND", 404);
    }

    limiter.consume();
    const body = await rawBody(request);
    verifyRequestSignature({
      secret: config.secret,
      timestamp: request.headers["x-project1337-timestamp"],
      signature: request.headers["x-project1337-signature"],
      rawBody: body,
    });

    let payload;
    try {
      payload = body ? JSON.parse(body) : {};
    } catch {
      throw new ScannerError("JSON-Anfrage ist ungültig.", "INVALID_JSON", 400);
    }

    if (payload.refresh != null && typeof payload.refresh !== "boolean") {
      throw new ScannerError("refresh muss true oder false sein.", "INVALID_REQUEST", 400);
    }

    const inventory = await scanner.inventory({ refresh: Boolean(payload.refresh) });
    json(response, 200, inventory);
    console.log(
      JSON.stringify({
        level: "info",
        event: "inventory_delivered",
        request_id: requestId,
        refresh: Boolean(payload.refresh),
        cached: inventory.cached,
        files: inventory.total_files,
        duration_ms: Date.now() - startedAt,
      })
    );
  } catch (error) {
    const known = error instanceof ScannerError;
    const status = known ? error.status : 500;
    const code = known ? error.code : "INTERNAL_ERROR";
    json(response, status, {
      error: known ? error.message : "Der NAS Library Scanner ist fehlgeschlagen.",
      code,
      request_id: requestId,
    });
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

server.requestTimeout = 60000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;

server.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "scanner_started",
      host: config.host,
      port: config.port,
      library_name: config.libraryName,
      extensions: config.videoExtensions.size,
    })
  );
});

function shutdown(signal) {
  console.log(JSON.stringify({ level: "info", event: "shutdown", signal }));
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
