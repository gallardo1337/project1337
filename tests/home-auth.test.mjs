import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const homePage = fs.readFileSync("app/page.jsx", "utf8");

test("home restores access from the server session instead of local storage", () => {
  assert.match(homePage, /fetch\("\/api\/login",\s*\{/);
  assert.match(homePage, /cache:\s*"no-store"/);
  assert.match(homePage, /credentials:\s*"same-origin"/);
  assert.match(homePage, /if \(response\.ok && payload\?\.ok\)/);
  assert.match(homePage, /window\.localStorage\.removeItem\("auth_1337_flag"\)/);
  assert.doesNotMatch(
    homePage,
    /if \(flag === "1" && user\) \{\s*setLoggedIn\(true\)/
  );
});

test("home does not load library data before the server session check", () => {
  assert.match(homePage, /if \(!sessionChecked \|\| !loggedIn\)/);
  assert.match(homePage, /\[loggedIn, rootUrl, router, sessionChecked\]/);
});
