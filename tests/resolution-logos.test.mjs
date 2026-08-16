import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V1-Qualitätslogos erscheinen auf Hauptseite und im Admin", async () => {
  const [indicator, experience, experienceStyles, overview, dashboard, adminStyles] =
    await Promise.all([
      projectFile("app/components/ResolutionIndicator.jsx"),
      projectFile("app/beta/BetaExperience.jsx"),
      projectFile("app/beta/experience.module.css"),
      projectFile("app/dashboard/beta/AdminBetaOverview.jsx"),
      projectFile("app/dashboard/page.jsx"),
      projectFile("app/dashboard/beta/admin-beta.css"),
    ]);

  assert.match(indicator, /src: "\/4k\.svg"/);
  assert.match(indicator, /src: "\/fullhd\.svg"/);
  assert.match(indicator, /src: "\/retro\.svg"/);
  assert.equal((experience.match(/<ResolutionIndicator/g) || []).length, 3);
  assert.match(experienceStyles, /\.qualityLogo \{/);
  assert.match(experienceStyles, /\.playerQualityLogo \{/);
  assert.match(overview, /logoClassName="adminRecentMovie__qualityLogo"/);
  assert.match(dashboard, /logoClassName="adminMovieColumns__qualityLogo"/);
  assert.match(adminStyles, /\.adminRecentMovie__qualityLogo \{/);
  assert.match(adminStyles, /\.adminMovieColumns__qualityLogo \{/);
  assert.match(
    dashboard,
    /V1-Qualitätslogos für 4K, FullHD und Retro auf Hauptseite und im Admin wiederhergestellt/
  );
});
