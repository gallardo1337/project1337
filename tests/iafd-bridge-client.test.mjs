import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import test from "node:test";
import {
  IafdBridgeClientError,
  fetchIafdHtmlThroughBridge,
} from "../lib/iafdBridge.mjs";

test("signiert den Bridge-Aufruf und übernimmt HTML", async (t) => {
  const secret = "s".repeat(64);
  let captured = null;
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks).toString("utf8");
    captured = { headers: request.headers, rawBody, url: request.url };
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, html: "<html><h1>Test</h1></html>" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const previousUrl = process.env.IAFD_BRIDGE_URL;
  const previousSecret = process.env.IAFD_BRIDGE_SECRET;
  t.after(() => {
    if (previousUrl == null) delete process.env.IAFD_BRIDGE_URL;
    else process.env.IAFD_BRIDGE_URL = previousUrl;
    if (previousSecret == null) delete process.env.IAFD_BRIDGE_SECRET;
    else process.env.IAFD_BRIDGE_SECRET = previousSecret;
  });
  process.env.IAFD_BRIDGE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.IAFD_BRIDGE_SECRET = secret;

  const html = await fetchIafdHtmlThroughBridge(
    "https://www.iafd.com/title.rme/id=test"
  );
  assert.equal(html, "<html><h1>Test</h1></html>");
  assert.equal(captured.url, "/v1/fetch");
  const timestamp = captured.headers["x-iafd-timestamp"];
  const expected = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${captured.rawBody}`)
    .digest("hex")}`;
  assert.equal(captured.headers["x-iafd-signature"], expected);
});

test("meldet eine fehlende Bridge-Konfiguration eindeutig", async (t) => {
  const previousUrl = process.env.IAFD_BRIDGE_URL;
  const previousSecret = process.env.IAFD_BRIDGE_SECRET;
  t.after(() => {
    if (previousUrl == null) delete process.env.IAFD_BRIDGE_URL;
    else process.env.IAFD_BRIDGE_URL = previousUrl;
    if (previousSecret == null) delete process.env.IAFD_BRIDGE_SECRET;
    else process.env.IAFD_BRIDGE_SECRET = previousSecret;
  });
  delete process.env.IAFD_BRIDGE_URL;
  delete process.env.IAFD_BRIDGE_SECRET;

  await assert.rejects(
    () => fetchIafdHtmlThroughBridge("https://www.iafd.com/title.rme/id=test"),
    (error) =>
      error instanceof IafdBridgeClientError &&
      error.code === "IAFD_BRIDGE_NOT_CONFIGURED"
  );
});
