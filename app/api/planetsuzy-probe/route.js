import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expectedTokenHash =
  "bc94e12b9c960d2e55903e8e9a504988f3b1e39b1a85b4bf62f5b8ed14b80695";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const suppliedHash = createHash("sha256").update(token).digest("hex");
  if (suppliedHash !== expectedTokenHash) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const target =
    "https://www.planetsuzy.org/t853241-p114-reagan-foxx.html";

  try {
    const response = await fetch(target, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Project1337UpdateCheck/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();
    const title =
      html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i)?.[1]
        ?.replace(/<[^>]+>/g, "")
        ?.replace(/\\s+/g, " ")
        ?.trim() || null;

    return Response.json(
      {
        status: response.status,
        finalHost: new URL(response.url).host,
        contentType: response.headers.get("content-type"),
        bytes: new TextEncoder().encode(html).length,
        title,
        looksUnavailable: /site unavailable|unable to access this site/i.test(html),
        containsReaganFoxx: /reagan\\s*foxx/i.test(html),
        contains0938: /09[:.]38/.test(html),
        containsToday: /today/i.test(html),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      { fetchError: error instanceof Error ? error.message : "Unknown fetch error" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
