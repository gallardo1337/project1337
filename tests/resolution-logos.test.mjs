import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("V1-Qualitätslogos erscheinen farbcodiert auf Hauptseite und im Admin", async () => {
  const [indicator, experience, experienceStyles, overview, dashboard, adminStyles, logo4k, logoFullHd, logoRetro] =
    await Promise.all([
      projectFile("app/components/ResolutionIndicator.jsx"),
      projectFile("app/beta/BetaExperience.jsx"),
      projectFile("app/beta/experience.module.css"),
      projectFile("app/dashboard/beta/AdminBetaOverview.jsx"),
      projectFile("app/dashboard/page.jsx"),
      projectFile("app/dashboard/beta/admin-beta.css"),
      projectFile("public/4k.svg"),
      projectFile("public/fullhd.svg"),
      projectFile("public/retro.svg"),
    ]);

  assert.match(indicator, /src: "\/4k\.svg"/);
  assert.match(indicator, /src: "\/fullhd\.svg"/);
  assert.match(indicator, /src: "\/retro\.svg"/);
  assert.equal((experience.match(/<ResolutionIndicator/g) || []).length, 3);
  assert.equal(
    (experience.match(/logoClassName=\{styles\.qualityInlineLogo\}/g) || []).length,
    2
  );
  assert.match(experience, /className=\{styles\.movieTitleRow\}[\s\S]*logoClassName=\{styles\.qualityInlineLogo\}/);
  assert.match(experience, /className=\{styles\.similarTitleRow\}[\s\S]*logoClassName=\{styles\.qualityInlineLogo\}/);
  assert.match(experienceStyles, /\.qualityInlineLogo \{/);
  assert.match(experienceStyles, /\.movieTitleRow \{/);
  assert.match(experienceStyles, /\.similarTitleRow \{/);
  assert.doesNotMatch(experienceStyles, /\.qualityLogo \{/);
  assert.match(experienceStyles, /\.playerQualityLogo \{/);
  assert.match(overview, /logoClassName="adminRecentMovie__qualityLogo"/);
  assert.match(dashboard, /logoClassName="adminMovieColumns__qualityLogo"/);
  assert.match(adminStyles, /\.adminRecentMovie__qualityLogo \{/);
  assert.match(adminStyles, /\.adminMovieColumns__qualityLogo \{/);
  assert.match(logo4k, /fill="#E50914"/);
  assert.match(logo4k, /fill="#FF5A64"/);
  assert.match(logoFullHd, /fill:#ffcb00/);
  assert.match(logoFullHd, /fill:#fd5/);
  assert.match(logoRetro, /fill:#b8bcc4/);
  assert.match(logoRetro, /fill:#f1f1f3/);
  assert.match(
    dashboard,
    /V1-Qualitätslogos auf Hauptseite und im Admin wiederhergestellt: 4K rot, FullHD gelb und Retro weiß-grau/
  );
  assert.match(
    dashboard,
    /Qualitätslogos in V2 unter die Thumbnails neben den Filmtitel verschoben/
  );
});
