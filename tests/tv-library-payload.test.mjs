import assert from "node:assert/strict";
import test from "node:test";

import { buildTvLibraryPayload } from "../lib/tvLibraryPayload.mjs";

test("builds the authenticated tvOS v2 payload with metrics and cast", () => {
  const payload = buildTvLibraryPayload({
    movies: [
      {
        id: "movie-1",
        title: "Testfilm",
        year: 2026,
        file_url: "Folder/Testfilm.mp4",
        thumbnail_url: "/thumb.webp",
        studio_id: "studio-1",
        resolution_id: "resolution-1",
        main_actor_ids: ["actor-1"],
        supporting_actor_ids: ["support-1"],
        tag_ids: ["tag-1"],
      },
    ],
    actors: [
      {
        id: "actor-1",
        name: "Main Actor",
        profile_image: "/actor.jpg",
        transparent_image: "/actor-transparent.png",
        cast_image: "/actor-cast.png",
      },
    ],
    supportingActors: [
      {
        id: "support-1",
        name: "Support Actor",
        profile_image: "/support.jpg",
        transparent_image: "/support-transparent.png",
        cast_image: "/support-cast.png",
      },
    ],
    studios: [{ id: "studio-1", name: "Studio" }],
    tags: [{ id: "tag-1", name: "Tag" }],
    resolutions: [{ id: "resolution-1", name: "4K" }],
    metrics: [
      {
        movie_id: "movie-1",
        rating: 9,
        view_count: 12,
        is_favorite: true,
      },
    ],
    sections: [{ id: "recent", type: "recent", enabled: true }],
  });

  assert.equal(payload.movies.length, 1);
  assert.equal(payload.movies[0].rating, 9);
  assert.equal(payload.movies[0].view_count, 12);
  assert.equal(payload.movies[0].is_favorite, true);
  assert.equal(payload.movies[0].studio, "Studio");
  assert.equal(payload.movies[0].quality, "4K");
  assert.deepEqual(payload.movies[0].tags, ["Tag"]);
  assert.equal(payload.movies[0].main_cast[0].name, "Main Actor");
  assert.equal(payload.movies[0].support_cast[0].name, "Support Actor");
  assert.equal(
    payload.movies[0].main_cast[0].image_url,
    "https://my1337.de/actor-cast.png"
  );
  assert.equal(
    payload.movies[0].support_cast[0].transparent_image_url,
    "https://my1337.de/support-transparent.png"
  );
  assert.equal(
    payload.actors[0].image_url,
    "https://my1337.de/actor-cast.png"
  );
  assert.equal(
    payload.actors[0].profile_image_url,
    "https://my1337.de/actor.jpg"
  );
  assert.equal(
    payload.actors[0].transparent_image_url,
    "https://my1337.de/actor-transparent.png"
  );
  assert.equal(payload.actors[0].movie_count, 1);
  assert.equal(payload.actors[0].total_views, 12);
  assert.equal(payload.actors[0].average_rating, 9);
  assert.equal(payload.movies[0].file_url, "https://video.my1337.de/Folder/Testfilm.mp4");
  assert.equal(payload.movies[0].thumbnail_url, "https://my1337.de/thumb.webp");
});

test("uses the supporting actor fallback only when no image is stored", () => {
  const payload = buildTvLibraryPayload({
    movies: [
      {
        id: "movie-1",
        title: "Testfilm",
        supporting_actor_ids: ["support-without-image"],
      },
    ],
    supportingActors: [
      { id: "support-without-image", name: "Support Actor" },
    ],
  });

  assert.equal(
    payload.movies[0].support_cast[0].image_url,
    "https://my1337.de/support-actor-fallback.webp"
  );
  assert.equal(
    payload.movies[0].support_cast[0].profile_image_url,
    "https://my1337.de/support-actor-fallback.webp"
  );
});

test("places Main Tags first in each tvOS movie while preserving tag order within groups", () => {
  const payload = buildTvLibraryPayload({
    movies: [{ id: "movie-1", tag_ids: ["regular-1", "main-1", "regular-2", "main-2"] }],
    tags: [
      { id: "regular-1", name: "Drama" },
      { id: "main-1", name: "Action", is_main: true },
      { id: "regular-2", name: "Comedy" },
      { id: "main-2", name: "Iconic", is_main: true },
    ],
  });

  assert.deepEqual(payload.movies[0].tag_ids, ["main-1", "main-2", "regular-1", "regular-2"]);
  assert.deepEqual(payload.movies[0].tags, ["Action", "Iconic", "Drama", "Comedy"]);
  assert.deepEqual(
    payload.filters.tags.map(({ name, is_main }) => [name, is_main]),
    [["Action", true], ["Iconic", true], ["Comedy", false], ["Drama", false]]
  );
});
