import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeNasLibrary,
  normalizeLibraryPath,
} from "../lib/nasLibraryAnalysis.mjs";

test("normalisiert öffentliche Video-URLs und optionale 1337-Wurzel", () => {
  assert.equal(
    normalizeLibraryPath(
      "https://video.my1337.de/1337/Anna_Asti/4K/Film%20Eins.mkv"
    ),
    "Anna_Asti/4K/Film Eins.mkv"
  );
  assert.equal(
    normalizeLibraryPath("https://video.my1337.de/Anna_Asti/Film.mp4"),
    "Anna_Asti/Film.mp4"
  );
});

test("erstellt exakte, wahrscheinliche und fehlende NAS-Abgleiche", () => {
  const report = analyzeNasLibrary({
    inventory: {
      root_name: "1337",
      scanned_at: "2026-08-09T18:00:00.000Z",
      duration_ms: 248,
      files: [
        {
          path: "Anna_Asti/4K/Film_Eins.mkv",
          name: "Film_Eins.mkv",
          extension: "mkv",
          size: 2000,
        },
        {
          path: "Anna_Asti/Film_Zwei.mp4",
          name: "Film_Zwei.mp4",
          extension: "mp4",
          size: 1000,
        },
        {
          path: "Unbekannt/Film_Drei.avi",
          name: "Film_Drei.avi",
          extension: "avi",
          size: 500,
        },
      ],
    },
    actors: [{ id: "actor-1", name: "Anna Asti" }],
    resolutions: [
      { id: "res-4k", name: "4K" },
      { id: "res-fhd", name: "FullHD" },
    ],
    movies: [
      {
        id: "movie-1",
        title: "Film Eins",
        file_url: "https://video.my1337.de/Anna_Asti/4K/Film_Eins.mkv",
        main_actor_ids: ["actor-1"],
        resolution_id: "res-4k",
      },
      {
        id: "movie-2",
        title: "Film Zwei",
        file_url: "https://video.my1337.de/Alter_Ordner/Film_Zwei.mp4",
        main_actor_ids: ["actor-1"],
        resolution_id: "res-fhd",
      },
      {
        id: "movie-4",
        title: "Film Vier",
        file_url: "https://video.my1337.de/Anna_Asti/Film_Vier.mp4",
        main_actor_ids: ["actor-1"],
        resolution_id: "res-fhd",
      },
    ],
  });

  assert.deepEqual(
    report.files.map((file) => [file.name, file.status]),
    [
      ["Film_Eins.mkv", "exact"],
      ["Film_Zwei.mp4", "probable"],
      ["Film_Drei.avi", "missing"],
    ]
  );
  assert.equal(report.summary.nas_files, 3);
  assert.equal(report.summary.exact_files, 1);
  assert.equal(report.summary.probable_files, 1);
  assert.equal(report.summary.nas_only_files, 1);
  assert.equal(report.summary.database_missing, 1);
  assert.equal(report.summary.mp4_files, 1);
  assert.equal(report.summary.non_mp4_files, 2);
  assert.equal(report.formats[0].files, 1);

  const anna = report.performers.find((performer) => performer.actor_id === "actor-1");
  assert.equal(anna.nas_files, 2);
  assert.equal(anna.exact, 1);
  assert.equal(anna.probable, 1);
  assert.equal(anna.coverage, 50);
  assert.equal(anna.database_movies, 3);
  assert.equal(report.summary.unmatched_folders, 1);

  assert.deepEqual(
    report.qualities.database.map((quality) => [quality.name, quality.database_movies]),
    [
      ["FullHD", 2],
      ["4K", 1],
    ]
  );
  assert.equal(report.qualities.inferred_nas[0].name, "Nicht aus Ordner ableitbar");
});
