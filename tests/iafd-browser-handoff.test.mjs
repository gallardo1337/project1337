import assert from "node:assert/strict";
import test from "node:test";
import {
  buildIafdSearchUrl,
  iafdHtmlLooksUnavailable,
  parseIafdSearchHtml,
  parseIafdTitleHtml,
  validateIafdSearchUrl,
} from "../lib/iafd.js";

test("validiert ausschließlich die echte IAFD-Suchroute", () => {
  const url = validateIafdSearchUrl(
    "https://iafd.com/results.asp?searchtype=title&searchstring=Test#ignored"
  );
  assert.equal(
    url,
    "https://www.iafd.com/results.asp?searchtype=title&searchstring=Test"
  );
  assert.throws(
    () => validateIafdSearchUrl("https://example.com/results.asp"),
    /keine gültige IAFD-Suchseite/
  );
  assert.throws(
    () => validateIafdSearchUrl("https://www.iafd.com/title.rme/id=1"),
    /keine gültige IAFD-Suchseite/
  );
});

test("baut eine normalisierte IAFD-Titelsuche", () => {
  assert.equal(
    buildIafdSearchUrl("  Example Movie  "),
    "https://www.iafd.com/results.asp?searchtype=title&searchstring=Example+Movie"
  );
});

test("erkennt eine übergebene Cloudflare-Prüfseite", () => {
  assert.equal(
    iafdHtmlLooksUnavailable(
      "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>"
    ),
    true
  );
  assert.equal(
    iafdHtmlLooksUnavailable(
      "<html><body><h1>Example Movie (2024)</h1><p>Studio and cast</p></body></html>"
    ),
    false
  );
});

test("parst bereinigtes Browser-HTML für Suche und Filmdetails", () => {
  const searchHtml = `
    <html><body><table><tr>
      <td><a href="/title.rme/id=example/year=2024">Example Movie (2024)</a></td>
      <td>Example Studio</td>
    </tr></table></body></html>`;
  const results = parseIafdSearchHtml(searchHtml, {
    query: "Example Movie",
    year: 2024,
    source: "IAFD · Edge/Chrome",
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Example Movie");
  assert.equal(results[0].year, 2024);

  const titleHtml = `
    <html><head>
      <link rel="canonical" href="https://www.iafd.com/title.rme/id=example/year=2024">
    </head><body>
      <h1>Example Movie (2024)</h1>
      <span class="bioheading">Studio</span><span class="biodata">Example Studio</span>
      <span class="bioheading">Minutes</span><span class="biodata">95</span>
      <div class="castbox"><p>
        <a href="/person.rme/id=performer">Example Performer</a>
      </p></div>
    </body></html>`;
  const details = parseIafdTitleHtml(
    titleHtml,
    "https://www.iafd.com/title.rme/id=example/year=2024"
  );
  assert.equal(details.title, "Example Movie");
  assert.equal(details.year, 2024);
  assert.equal(details.studio, "Example Studio");
  assert.equal(details.duration_minutes, 95);
  assert.deepEqual(details.cast.map((entry) => entry.name), ["Example Performer"]);
});
