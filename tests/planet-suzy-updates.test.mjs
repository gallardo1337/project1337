import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePostIds,
  extractLatestPostId,
  hasUnreadPost,
  markPostsRead,
  observePostId,
} from "../lib/planetSuzyUpdates.mjs";

test("extracts the greatest ID from post containers", () => {
  const html =
    '<div id="post_1200">one</div>' +
    '<div id="post_98765432101234567890">two</div>' +
    '<div id="post_44">three</div>';
  assert.equal(extractLatestPostId(html), "98765432101234567890");
});

test("supports alternative post ID attributes and ignores unrelated IDs", () => {
  const html =
    '<div id="page_900000"></div>' +
    '<article data-post-id="123456"></article>' +
    '<div name="post-123499"></div>';
  assert.equal(extractLatestPostId(html), "123499");
});

test("returns null when the page does not expose a recognized post ID", () => {
  assert.equal(
    extractLatestPostId('<div id="page_5000">Today, 09:38</div>'),
    null
  );
});

test("compares post IDs without losing precision", () => {
  assert.equal(comparePostIds("9007199254740993", "9007199254740992"), 1);
  assert.equal(comparePostIds("19", "20"), -1);
});

test("new higher IDs remain unread until explicitly marked read", () => {
  const baseline = observePostId(null, "100", 1);
  assert.equal(hasUnreadPost(baseline), false);

  const update = observePostId(baseline, "105", 2);
  assert.equal(hasUnreadPost(update), true);
  assert.equal(hasUnreadPost(markPostsRead(update)), false);
});

test("deleted latest posts do not lower the saved high-water mark", () => {
  const baseline = observePostId(null, "200", 1);
  const update = observePostId(baseline, "250", 2);
  const deletedLatest = observePostId(update, "230", 3);

  assert.equal(deletedLatest.maxPostId, "250");
  assert.equal(hasUnreadPost(deletedLatest), true);

  const nextNewPost = observePostId(deletedLatest, "251", 4);
  assert.equal(nextNewPost.maxPostId, "251");
  assert.equal(hasUnreadPost(nextNewPost), true);
});
