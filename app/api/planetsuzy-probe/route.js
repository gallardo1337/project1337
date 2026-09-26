import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expectedTokenHash =
  "73888196a942bd3c75eda645ecb63f76cb5bdd2c2460ae239e359bc5a619f3f1";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (createHash("sha256").update(token).digest("hex") !== expectedTokenHash) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const response = await fetch(
    "https://www.planetsuzy.org/t853241-p114-reagan-foxx.html",
    {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Project1337UpdateCheck/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    }
  );
  const html = await response.text();
  const idMatches = [
    ...html.matchAll(/\b(id|name|data-post-id|data-postid)\s*=\s*["']([^"']*(?:post|message)[^"']*)["']/gi),
  ].map((match) => ({ attribute: match[1], value: match[2] }));
  const timeIndex = html.search(/09[:.]38/);
  const rawWindow =
    timeIndex >= 0 ? html.slice(Math.max(0, timeIndex - 500), timeIndex + 250) : "";
  const markupAroundTime = rawWindow
    .replace(/>[^<]*</g, "><")
    .match(/<[^>]+>/g)
    ?.map((tag) =>
      tag.replace(
        /\s+(?!id|class|title|datetime|data-[\w-]+)[\w:-]+\s*=\s*(["']).*?\1/gi,
        ""
      )
    )
    .slice(-20);

  return Response.json(
    {
      status: response.status,
      bytes: new TextEncoder().encode(html).length,
      pageTitle: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim(),
      postIdLikeAttributes: idMatches.slice(-30),
      postIdLikeCount: idMatches.length,
      markupAround0938: markupAroundTime || [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}