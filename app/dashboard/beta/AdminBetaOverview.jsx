const formatNumber = (value) =>
  new Intl.NumberFormat("de-DE").format(Math.max(0, Number(value) || 0));

const formatRating = (value) => {
  const rating = Number(value);
  return Number.isFinite(rating) ? rating.toFixed(1).replace(".", ",") : "–";
};

const movieDate = (movie) => {
  const value = movie?.created_at || movie?.inserted_at || movie?.createdAt;
  if (!value) return "Ohne Datum";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ohne Datum";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function AdminBetaOverview({
  movies,
  mainActors,
  supportActors,
  studios,
  tags,
  resolutions,
  metricMap,
  studioMap,
  resolutionMap,
  onNavigate,
  onEditMovie,
}) {
  const totalViews = movies.reduce(
    (sum, movie) => sum + (Number(metricMap[movie.id]?.view_count) || 0),
    0
  );

  const ratings = movies
    .map((movie) => Number(metricMap[movie.id]?.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 10);

  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    : null;

  const moviesWithoutThumbnail = movies.filter(
    (movie) => !movie.thumbnail_url
  ).length;
  const moviesWithoutStudio = movies.filter((movie) => !movie.studio_id).length;
  const moviesWithoutCast = movies.filter(
    (movie) =>
      !Array.isArray(movie.main_actor_ids) || movie.main_actor_ids.length === 0
  ).length;
  const moviesWithoutFile = movies.filter((movie) => !movie.file_url).length;

  const completenessFields = movies.length * 5;
  const completedFields = movies.reduce(
    (sum, movie) =>
      sum +
      Number(Boolean(movie.thumbnail_url)) +
      Number(Boolean(movie.studio_id)) +
      Number(Boolean(movie.file_url)) +
      Number(Boolean(movie.resolution_id)) +
      Number(
        Array.isArray(movie.main_actor_ids) && movie.main_actor_ids.length > 0
      ),
    0
  );
  const completeness = completenessFields
    ? Math.round((completedFields / completenessFields) * 100)
    : 100;

  const resolutionStats = resolutions
    .map((resolution) => ({
      id: resolution.id,
      name: resolution.name,
      count: movies.filter((movie) => movie.resolution_id === resolution.id)
        .length,
    }))
    .sort((a, b) => b.count - a.count);
  const maxResolutionCount = Math.max(
    1,
    ...resolutionStats.map((item) => item.count)
  );

  const studioStats = studios
    .map((studio) => ({
      id: studio.id,
      name: studio.name,
      count: movies.filter((movie) => movie.studio_id === studio.id).length,
    }))
    .filter((studio) => studio.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
    .slice(0, 5);

  const recentMovies = movies.slice(0, 6);
  const issueCount =
    moviesWithoutThumbnail +
    moviesWithoutStudio +
    moviesWithoutCast +
    moviesWithoutFile;

  return (
    <div className="adminOverview">
      <header className="adminOverview__header">
        <div>
          <span className="adminOverview__eyebrow">Command Center</span>
          <h1>Dein Archiv auf einen Blick.</h1>
          <p>
            Bestand kontrollieren, offene Daten erkennen und direkt dort
            weitermachen, wo Arbeit anfällt.
          </p>
        </div>

        <div className="adminOverview__headerActions">
          <button
            type="button"
            className="adminOverview__secondaryButton"
            onClick={() => onNavigate("stats")}
          >
            Archiv öffnen
          </button>
          <button
            type="button"
            className="adminOverview__primaryButton"
            onClick={() => onNavigate("new")}
          >
            <span>+</span> Neuer Film
          </button>
        </div>
      </header>

      <section className="adminKpiGrid" aria-label="Archivkennzahlen">
        <article className="adminKpi adminKpi--accent">
          <div className="adminKpi__topline">
            <span>Gesamtbestand</span>
            <small>Live</small>
          </div>
          <strong>{formatNumber(movies.length)}</strong>
          <p>Filme im Archiv</p>
        </article>

        <article className="adminKpi">
          <div className="adminKpi__topline">
            <span>Reichweite</span>
            <small>Alle Filme</small>
          </div>
          <strong>{formatNumber(totalViews)}</strong>
          <p>Gespeicherte Aufrufe</p>
        </article>

        <article className="adminKpi">
          <div className="adminKpi__topline">
            <span>Bewertung</span>
            <small>{ratings.length} bewertet</small>
          </div>
          <strong>{formatRating(averageRating)}</strong>
          <p>Durchschnitt von 10</p>
        </article>

        <article className="adminKpi">
          <div className="adminKpi__topline">
            <span>Datenqualität</span>
            <small>{issueCount ? `${issueCount} Hinweise` : "Sauber"}</small>
          </div>
          <strong>{completeness}%</strong>
          <p>Vollständiger Katalog</p>
        </article>
      </section>

      <section className="adminOverviewGrid">
        <article className="adminOverviewPanel adminOverviewPanel--recent">
          <div className="adminPanelHeading">
            <div>
              <span>Zuletzt hinzugefügt</span>
              <h2>Aktuelle Filme</h2>
            </div>
            <button type="button" onClick={() => onNavigate("stats")}>
              Alle {movies.length} anzeigen <span>→</span>
            </button>
          </div>

          {recentMovies.length ? (
            <div className="adminRecentList">
              {recentMovies.map((movie, index) => {
                const metric = metricMap[movie.id] || {};
                const studio = studioMap[movie.studio_id]?.name || "Kein Studio";
                const resolution =
                  resolutionMap[movie.resolution_id]?.name || "Ohne Qualität";

                return (
                  <div className="adminRecentMovie" key={movie.id}>
                    <span className="adminRecentMovie__index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="adminRecentMovie__cover">
                      {movie.thumbnail_url ? (
                        <img src={movie.thumbnail_url} alt="" loading="lazy" />
                      ) : (
                        <span>{movie.title?.slice(0, 1) || "?"}</span>
                      )}
                    </div>
                    <div className="adminRecentMovie__identity">
                      <strong>{movie.title}</strong>
                      <span>
                        {studio} · {movie.year || "Jahr offen"}
                      </span>
                    </div>
                    <span className="adminRecentMovie__quality">{resolution}</span>
                    <div className="adminRecentMovie__metric">
                      <strong>{formatNumber(metric.view_count)}</strong>
                      <span>Aufrufe</span>
                    </div>
                    <div className="adminRecentMovie__metric">
                      <strong>{formatRating(metric.rating)}</strong>
                      <span>Bewertung</span>
                    </div>
                    <span className="adminRecentMovie__date">{movieDate(movie)}</span>
                    <button
                      type="button"
                      className="adminRecentMovie__edit"
                      onClick={() => onEditMovie(movie)}
                      aria-label={`${movie.title} bearbeiten`}
                    >
                      Bearbeiten
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="adminEmptyState">
              <strong>Noch keine Filme vorhanden.</strong>
              <button type="button" onClick={() => onNavigate("new")}>
                Ersten Film anlegen
              </button>
            </div>
          )}
        </article>

        <aside className="adminOverviewPanel adminOverviewPanel--health">
          <div className="adminPanelHeading">
            <div>
              <span>Katalogpflege</span>
              <h2>Offene Punkte</h2>
            </div>
          </div>

          <div
            className="adminHealthScore"
            style={{ "--admin-health": `${completeness * 3.6}deg` }}
          >
            <div>
              <strong>{completeness}%</strong>
              <span>vollständig</span>
            </div>
          </div>

          <div className="adminIssueList">
            <button type="button" onClick={() => onNavigate("stats")}>
              <span>Ohne Thumbnail</span>
              <strong>{moviesWithoutThumbnail}</strong>
            </button>
            <button type="button" onClick={() => onNavigate("stats")}>
              <span>Ohne Studio</span>
              <strong>{moviesWithoutStudio}</strong>
            </button>
            <button type="button" onClick={() => onNavigate("stats")}>
              <span>Ohne Hauptdarsteller</span>
              <strong>{moviesWithoutCast}</strong>
            </button>
            <button type="button" onClick={() => onNavigate("stats")}>
              <span>Ohne Dateipfad</span>
              <strong>{moviesWithoutFile}</strong>
            </button>
          </div>
        </aside>
      </section>

      <section className="adminOverviewGrid adminOverviewGrid--lower">
        <article className="adminOverviewPanel">
          <div className="adminPanelHeading">
            <div>
              <span>Verteilung</span>
              <h2>Qualitäten</h2>
            </div>
          </div>
          <div className="adminBarList">
            {resolutionStats.map((item) => (
              <div className="adminBarItem" key={item.id}>
                <div>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>
                <span className="adminBarTrack">
                  <i
                    style={{
                      width: `${Math.max(
                        item.count ? 5 : 0,
                        (item.count / maxResolutionCount) * 100
                      )}%`,
                    }}
                  />
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="adminOverviewPanel">
          <div className="adminPanelHeading">
            <div>
              <span>Bestand</span>
              <h2>Top Studios</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("meta", "studios")}
            >
              Verwalten <span>→</span>
            </button>
          </div>
          <div className="adminStudioRanking">
            {studioStats.map((studio, index) => (
              <div key={studio.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{studio.name}</strong>
                <small>{studio.count} Filme</small>
              </div>
            ))}
          </div>
        </article>

        <article className="adminOverviewPanel adminOverviewPanel--quick">
          <div className="adminPanelHeading">
            <div>
              <span>Schnellzugriff</span>
              <h2>Stammdaten</h2>
            </div>
          </div>
          <div className="adminQuickLinks">
            <button
              type="button"
              onClick={() => onNavigate("meta", "mainActors")}
            >
              <span>Hauptdarsteller</span>
              <strong>{mainActors.length}</strong>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("meta", "supportActors")}
            >
              <span>Nebendarsteller</span>
              <strong>{supportActors.length}</strong>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("meta", "studios")}
            >
              <span>Studios</span>
              <strong>{studios.length}</strong>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("meta", "tags")}
            >
              <span>Tags</span>
              <strong>{tags.length}</strong>
            </button>
          </div>
        </article>
      </section>
    </div>
  );
}
