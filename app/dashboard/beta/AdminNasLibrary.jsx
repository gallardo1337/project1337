"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sortNasPerformers } from "../../../lib/nasLibraryAnalysis.mjs";
import styles from "./AdminNasLibrary.module.css";

const FILE_PAGE_SIZE = 75;

const PERFORMER_COLUMNS = [
  { key: "name", label: "Darsteller / NAS-Ordner" },
  { key: "nas_files", label: "NAS" },
  { key: "database_movies", label: "DB-Filme" },
  { key: "exact", label: "Sicher" },
  { key: "probable", label: "Möglich" },
  { key: "missing", label: "Offen" },
  { key: "coverage", label: "Quote" },
];

const numberFormatter = new Intl.NumberFormat("de-DE");
const decimalFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 1,
});

function formatNumber(value) {
  return numberFormatter.format(Math.max(0, Number(value) || 0));
}

function formatPercent(value) {
  return `${decimalFormatter.format(Math.max(0, Number(value) || 0))} %`;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${formatNumber(bytes)} B`;

  const units = ["KB", "MB", "GB", "TB", "PB"];
  let size = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }

  return `${decimalFormatter.format(size)} ${unit}`;
}

function formatDateTime(value) {
  if (!value) return "Noch kein Scan";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unbekannter Zeitpunkt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return "–";
  if (milliseconds < 1000) return `${formatNumber(milliseconds)} ms`;
  return `${decimalFormatter.format(milliseconds / 1000)} s`;
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .trim();
}

function normalizePerformerLabel(value) {
  return normalizeSearch(value)
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ");
}

function StatusBadge({ status }) {
  const data = {
    exact: { label: "In Datenbank", className: styles.statusExact },
    probable: { label: "Möglicher Treffer", className: styles.statusProbable },
    missing: { label: "Nicht eingetragen", className: styles.statusMissing },
  }[status] || { label: "Unbekannt", className: "" };

  return <span className={`${styles.statusBadge} ${data.className}`}>{data.label}</span>;
}

function ProgressBar({ value, tone = "red" }) {
  return (
    <span className={`${styles.progress} ${styles[`progress_${tone}`] || ""}`}>
      <i style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} />
    </span>
  );
}

function EmptyState({ children }) {
  return <div className={styles.empty}>{children}</div>;
}

export default function AdminNasLibrary({ onUnauthorized }) {
  const unauthorizedRef = useRef(onUnauthorized);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [performerQuery, setPerformerQuery] = useState("");
  const [performerSort, setPerformerSort] = useState({
    key: "nas_files",
    direction: "desc",
  });
  const [fileQuery, setFileQuery] = useState("");
  const [databaseQuery, setDatabaseQuery] = useState("");
  const [fileStatus, setFileStatus] = useState("all");
  const [fileExtension, setFileExtension] = useState("all");
  const [filePage, setFilePage] = useState(1);
  const deferredFileQuery = useDeferredValue(fileQuery);

  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const loadReport = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/nas-library${refresh ? "?refresh=1" : ""}`,
          { cache: "no-store", credentials: "same-origin" }
        );
        const payload = await response.json().catch(() => null);

        if (response.status === 401) {
          unauthorizedRef.current?.();
          throw new Error("Admin-Sitzung abgelaufen. Bitte neu einloggen.");
        }
        if (!response.ok || !payload?.report) {
          const requestError = new Error(
            payload?.error || "NAS-Analyse konnte nicht geladen werden."
          );
          requestError.setupRequired = Boolean(payload?.setup_required);
          throw requestError;
        }

        setReport(payload.report);
        setFilePage(1);
      } catch (requestError) {
        setError({
          message:
            requestError?.message || "NAS-Analyse konnte nicht geladen werden.",
          setupRequired: Boolean(requestError?.setupRequired),
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadReport(false);
  }, [loadReport]);

  const performers = useMemo(() => {
    const query = normalizeSearch(performerQuery);
    const filtered = !query
      ? report?.performers || []
      : (report?.performers || []).filter((performer) =>
          normalizeSearch(`${performer.name} ${performer.folders.join(" ")}`).includes(query)
        );

    return sortNasPerformers(filtered, performerSort);
  }, [performerQuery, performerSort, report]);

  const changePerformerSort = useCallback((key) => {
    setPerformerSort((current) =>
      current.key === key
        ? {
            key,
            direction: current.direction === "desc" ? "asc" : "desc",
          }
        : {
            key,
            direction: key === "name" ? "asc" : "desc",
          }
    );
  }, []);

  const visibleFiles = useMemo(() => {
    const query = normalizeSearch(deferredFileQuery);
    return (report?.files || []).filter((file) => {
      if (fileStatus !== "all" && file.status !== fileStatus) return false;
      if (fileExtension !== "all" && file.extension !== fileExtension) return false;
      if (!query) return true;

      const movieText = file.database_movies
        .map((movie) => `${movie.title} ${movie.resolution} ${movie.main_actors.join(" ")}`)
        .join(" ");
      return normalizeSearch(`${file.path} ${movieText}`).includes(query);
    });
  }, [deferredFileQuery, fileExtension, fileStatus, report]);

  const filePageCount = Math.max(1, Math.ceil(visibleFiles.length / FILE_PAGE_SIZE));
  const pagedFiles = visibleFiles.slice(
    (Math.min(filePage, filePageCount) - 1) * FILE_PAGE_SIZE,
    Math.min(filePage, filePageCount) * FILE_PAGE_SIZE
  );

  const databaseGaps = useMemo(() => {
    const query = normalizeSearch(databaseQuery);
    if (!query) return report?.database_gaps || [];
    return (report?.database_gaps || []).filter((movie) =>
      normalizeSearch(
        `${movie.title} ${movie.relative_path} ${movie.resolution} ${movie.main_actors.join(" ")}`
      ).includes(query)
    );
  }, [databaseQuery, report]);

  useEffect(() => {
    setFilePage(1);
  }, [deferredFileQuery, fileExtension, fileStatus]);

  if (loading && !report) {
    return (
      <div className={styles.loading}>
        <span />
        <strong>NAS-Inventar und Datenbank werden abgeglichen…</strong>
        <small>Beim ersten Aufruf kann der Scanner einen neuen Katalog erstellen.</small>
      </div>
    );
  }

  if (!report) {
    return (
      <section className={styles.setup}>
        <span className={styles.setupEyebrow}>NAS-Verbindung</span>
        <h2>{error?.setupRequired ? "Library Scanner noch nicht verbunden" : "NAS-Analyse nicht erreichbar"}</h2>
        <p>{error?.message}</p>
        {error?.setupRequired ? (
          <div className={styles.setupSteps}>
            <article>
              <b>01</b>
              <div>
                <strong>Scanner auf dem NAS starten</strong>
                <span>Der Ordner `nas-library-scanner` liegt vollständig im Projekt bereit.</span>
              </div>
            </article>
            <article>
              <b>02</b>
              <div>
                <strong>Cloudflare-Tunnel verbinden</strong>
                <span>Empfohlener Host: nas-scanner.my1337.de</span>
              </div>
            </article>
            <article>
              <b>03</b>
              <div>
                <strong>Preview-Variablen setzen</strong>
                <span>URL, gemeinsames Secret und Zeitlimit werden nur serverseitig verwendet.</span>
              </div>
            </article>
          </div>
        ) : null}
        <button type="button" onClick={() => loadReport(false)}>
          Verbindung erneut prüfen
        </button>
      </section>
    );
  }

  const summary = report.summary;
  const topPerformers = report.performers
    .filter((performer) => performer.nas_files > 0)
    .slice(0, 10);

  return (
    <div className={styles.audit}>
      <section className={styles.scanbar}>
        <div className={styles.scanIdentity}>
          <span className={styles.scanPulse} />
          <div>
            <strong>NAS-Katalog „{report.scan.root_name}“</strong>
            <small>
              Letzter Scan: {formatDateTime(report.scan.scanned_at)} · Laufzeit {formatDuration(
                report.scan.duration_ms
              )} · {report.scan.cached ? "gespeicherter Stand" : "frisch gelesen"}
            </small>
          </div>
        </div>
        <div className={styles.scanActions}>
          <span>Nur Metadaten · keine Videoinhalte</span>
          <button
            type="button"
            onClick={() => loadReport(true)}
            disabled={refreshing}
          >
            {refreshing ? "NAS wird gelesen…" : "Neu scannen"}
          </button>
        </div>
      </section>

      {error ? (
        <div className={styles.inlineError}>
          <span>{error.message}</span>
          <button type="button" onClick={() => setError(null)}>Schließen</button>
        </div>
      ) : null}

      <section className={styles.kpis} aria-label="NAS-Katalogkennzahlen">
        <article>
          <span>NAS-Bestand</span>
          <strong>{formatNumber(summary.nas_files)}</strong>
          <small>{formatBytes(summary.nas_bytes)} Videodaten</small>
        </article>
        <article>
          <span>Datenbank</span>
          <strong>{formatNumber(summary.database_movies)}</strong>
          <small>{formatNumber(summary.database_exact)} Pfade sicher gefunden</small>
        </article>
        <article className={styles.kpiAccent}>
          <span>Erfassungsquote</span>
          <strong>{formatPercent(summary.coverage)}</strong>
          <ProgressBar value={summary.coverage} />
        </article>
        <article className={summary.nas_only_files ? styles.kpiWarning : ""}>
          <span>Noch nicht erfasst</span>
          <strong>{formatNumber(summary.nas_only_files)}</strong>
          <small>NAS-Dateien ohne Treffer</small>
        </article>
        <article className={summary.database_missing ? styles.kpiDanger : ""}>
          <span>DB ohne Datei</span>
          <strong>{formatNumber(summary.database_missing)}</strong>
          <small>Pfad auf NAS nicht exakt gefunden</small>
        </article>
        <article>
          <span>MP4-Fortschritt</span>
          <strong>{formatPercent(summary.conversion_progress)}</strong>
          <small>{formatNumber(summary.non_mp4_files)} Dateien noch nicht MP4</small>
        </article>
      </section>

      <nav className={styles.views} aria-label="NAS-Analysebereiche">
        {[
          ["overview", "Übersicht"],
          ["performers", `Darsteller (${report.performers.length})`],
          ["files", `Alle Dateien (${report.files.length})`],
          ["database", `DB-Lücken (${report.database_gaps.length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeView === key ? styles.viewActive : ""}
            onClick={() => setActiveView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {activeView === "overview" ? (
        <div className={styles.overview}>
          <section className={styles.matchGrid}>
            <article className={styles.matchExact}>
              <span>Sicher zugeordnet</span>
              <strong>{formatNumber(summary.exact_files)}</strong>
              <small>vollständiger Pfad stimmt überein</small>
            </article>
            <article className={styles.matchProbable}>
              <span>Mögliche Treffer</span>
              <strong>{formatNumber(summary.probable_files)}</strong>
              <small>eindeutiger Dateiname, anderer Pfad</small>
            </article>
            <article className={styles.matchMissing}>
              <span>Nur auf NAS</span>
              <strong>{formatNumber(summary.nas_only_files)}</strong>
              <small>kein belastbarer Datenbanktreffer</small>
            </article>
            <article>
              <span>Ordner ohne Zuordnung</span>
              <strong>{formatNumber(summary.unmatched_folders)}</strong>
              <small>Ordnername passt zu keinem Hauptdarsteller</small>
            </article>
          </section>

          <div className={styles.overviewColumns}>
            <section className={styles.panel}>
              <header>
                <div>
                  <span>Dateiformate</span>
                  <h2>Konvertierungsbestand</h2>
                </div>
                <small>{report.formats.length} Formate erkannt</small>
              </header>
              <div className={styles.breakdownTable}>
                <div className={styles.breakdownHead}>
                  <span>Format</span><span>Dateien</span><span>Größe</span><span>In DB</span>
                </div>
                {report.formats.map((format) => (
                  <div key={format.extension}>
                    <strong>{format.name}</strong>
                    <span>{formatNumber(format.files)}</span>
                    <span>{formatBytes(format.bytes)}</span>
                    <span>{formatNumber(format.exact)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <header>
                <div>
                  <span>NAS-Ordnerstruktur</span>
                  <h2>4K-Verteilung</h2>
                </div>
                <small>nur Ordner „4K“ wird als 4K erkannt</small>
              </header>
              <div className={styles.qualityList}>
                {report.qualities.nas.map((quality) => {
                  const share = summary.nas_files
                    ? (quality.files / summary.nas_files) * 100
                    : 0;
                  return (
                    <article key={quality.name}>
                      <div>
                        <strong>{quality.name}</strong>
                        <span>{formatNumber(quality.files)} Dateien</span>
                      </div>
                      <ProgressBar value={share} tone={quality.name === "4K" ? "green" : "red"} />
                      <small>
                        {formatPercent(share)} des NAS-Bestands · {formatBytes(quality.bytes)}
                      </small>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <section className={styles.panel}>
            <header>
              <div>
                <span>Abdeckung nach Hauptdarsteller</span>
                <h2>Größte NAS-Ordner</h2>
              </div>
              <button type="button" onClick={() => setActiveView("performers")}>
                Alle Darsteller anzeigen →
              </button>
            </header>
            <div className={styles.performerPreview}>
              {topPerformers.map((performer) => (
                <article key={performer.key}>
                  <div className={styles.performerName}>
                    <strong>{performer.name}</strong>
                    <span>
                      {performer.folder_matched ? performer.folders.join(" · ") : "Kein Stammdaten-Treffer"}
                    </span>
                  </div>
                  <div>
                    <strong>{formatNumber(performer.exact)} / {formatNumber(performer.nas_files)}</strong>
                    <span>eingetragen</span>
                  </div>
                  <div className={styles.performerCoverage}>
                    <strong>{formatPercent(performer.coverage)}</strong>
                    <ProgressBar value={performer.coverage} tone="green" />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.inferenceNote}>
            <strong>Qualität auf dem NAS</strong>
            <p>
              Als 4K zählen ausschließlich Dateien, deren Ordnerpfad einen eigenen Ordner namens „4K“ enthält.
              Alle übrigen Dateien werden als „Nicht 4K“ gezählt. Dateiname, Videoformat und Datenbankqualität
              beeinflussen diese Auswertung nicht.
            </p>
          </section>
        </div>
      ) : null}

      {activeView === "performers" ? (
        <section className={styles.panel}>
          <header className={styles.listHeader}>
            <div>
              <span>Darstelleranalyse</span>
              <h2>{formatNumber(performers.length)} Ordner und Darsteller</h2>
            </div>
            <input
              type="search"
              value={performerQuery}
              onChange={(event) => setPerformerQuery(event.target.value)}
              placeholder="Darsteller oder Ordner suchen…"
              aria-label="Darstelleranalyse durchsuchen"
            />
          </header>
          <div className={styles.performerTable}>
            <div className={styles.performerTableHead}>
              {PERFORMER_COLUMNS.map((column) => {
                const active = performerSort.key === column.key;
                const direction = active ? performerSort.direction : null;
                return (
                  <span
                    key={column.key}
                    role="columnheader"
                    aria-sort={
                      active
                        ? direction === "desc"
                          ? "descending"
                          : "ascending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className={active ? styles.sortActive : ""}
                      onClick={() => changePerformerSort(column.key)}
                      title={`${column.label} sortieren`}
                    >
                      {column.label}
                      <i aria-hidden="true">{active ? (direction === "desc" ? "↓" : "↑") : "↕"}</i>
                    </button>
                  </span>
                );
              })}
            </div>
            {performers.map((performer) => {
              const distinctFolders = performer.folders.filter(
                (folder) =>
                  normalizePerformerLabel(folder) !==
                  normalizePerformerLabel(performer.name)
              );

              return (
                <article key={performer.key}>
                  <div className={styles.performerIdentity}>
                    <strong>{performer.name}</strong>
                    {distinctFolders.length ? (
                      <span title={distinctFolders.join(" · ")}>
                        NAS-Ordner: {distinctFolders.join(" · ")}
                      </span>
                    ) : null}
                    <div
                      className={styles.performerFormats}
                      aria-label={`Dateitypen von ${performer.name}`}
                    >
                      {performer.formats
                        .slice(0, 4)
                        .map((item) => `${item.name} ${formatNumber(item.count)}`)
                        .join(" · ") || "Keine NAS-Dateien"}
                    </div>
                  </div>
                  <span>{formatNumber(performer.nas_files)}</span>
                  <span>{formatNumber(performer.database_movies)}</span>
                  <span className={styles.valueExact}>{formatNumber(performer.exact)}</span>
                  <span className={styles.valueProbable}>{formatNumber(performer.probable)}</span>
                  <span className={styles.valueMissing}>{formatNumber(performer.missing)}</span>
                  <div className={styles.tableCoverage}>
                    <strong>{performer.nas_files ? formatPercent(performer.coverage) : "–"}</strong>
                    <ProgressBar value={performer.coverage} tone="green" />
                  </div>
                </article>
              );
            })}
          </div>
          {!performers.length ? <EmptyState>Kein passender Darsteller gefunden.</EmptyState> : null}
        </section>
      ) : null}

      {activeView === "files" ? (
        <section className={styles.panel}>
          <header className={styles.listHeader}>
            <div>
              <span>Vollständiges NAS-Inventar</span>
              <h2>{formatNumber(visibleFiles.length)} Videodateien</h2>
            </div>
            <div className={styles.fileFilters}>
              <input
                type="search"
                value={fileQuery}
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder="Pfad, Film oder Darsteller…"
                aria-label="NAS-Dateien durchsuchen"
              />
              <select
                value={fileStatus}
                onChange={(event) => setFileStatus(event.target.value)}
                aria-label="Datenbankstatus filtern"
              >
                <option value="all">Alle Status</option>
                <option value="exact">In Datenbank</option>
                <option value="probable">Möglicher Treffer</option>
                <option value="missing">Nicht eingetragen</option>
              </select>
              <select
                value={fileExtension}
                onChange={(event) => setFileExtension(event.target.value)}
                aria-label="Dateiformat filtern"
              >
                <option value="all">Alle Formate</option>
                {report.formats.map((format) => (
                  <option key={format.extension} value={format.extension}>
                    {format.name} ({format.files})
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className={styles.fileTable}>
            <div className={styles.fileTableHead}>
              <span>Datei / Pfad</span>
              <span>Format</span>
              <span>Größe</span>
              <span>Datenbankabgleich</span>
            </div>
            {pagedFiles.map((file) => {
              const movie = file.database_movies[0] || null;
              return (
                <article key={file.path}>
                  <div className={styles.fileIdentity}>
                    <strong>{file.name}</strong>
                    <span title={file.path}>{file.path}</span>
                    <small>Geändert: {formatDateTime(file.modified_at)}</small>
                  </div>
                  <b>{file.extension.toUpperCase()}</b>
                  <span>{formatBytes(file.size)}</span>
                  <div className={styles.fileMatch}>
                    <StatusBadge status={file.status} />
                    {movie ? (
                      <span>
                        <strong>{movie.title}</strong>
                        <small>
                          {movie.resolution} · {movie.main_actors.join(", ") || "Ohne Hauptdarsteller"}
                          {file.database_duplicate
                            ? ` · ${file.database_movies.length} DB-Einträge auf diesem Pfad`
                            : ""}
                        </small>
                      </span>
                    ) : (
                      <span><small>Noch keinem Film zugeordnet</small></span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!pagedFiles.length ? <EmptyState>Keine Datei passt zu diesen Filtern.</EmptyState> : null}

          {visibleFiles.length > FILE_PAGE_SIZE ? (
            <div className={styles.pagination}>
              <span>
                Seite {Math.min(filePage, filePageCount)} von {filePageCount} · maximal {FILE_PAGE_SIZE} Zeilen
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => setFilePage((page) => Math.max(1, page - 1))}
                  disabled={filePage <= 1}
                >
                  ← Zurück
                </button>
                <button
                  type="button"
                  onClick={() => setFilePage((page) => Math.min(filePageCount, page + 1))}
                  disabled={filePage >= filePageCount}
                >
                  Weiter →
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "database" ? (
        <section className={styles.panel}>
          <header className={styles.listHeader}>
            <div>
              <span>Datenbankpfade ohne exakten NAS-Treffer</span>
              <h2>{formatNumber(databaseGaps.length)} Einträge prüfen</h2>
            </div>
            <input
              type="search"
              value={databaseQuery}
              onChange={(event) => setDatabaseQuery(event.target.value)}
              placeholder="Titel, Pfad oder Darsteller…"
              aria-label="Datenbanklücken durchsuchen"
            />
          </header>
          <div className={styles.databaseList}>
            {databaseGaps.map((movie) => (
              <article key={movie.id}>
                <StatusBadge status={movie.status} />
                <div>
                  <strong>{movie.title}</strong>
                  <span>{movie.relative_path || "Kein Dateipfad hinterlegt"}</span>
                  <small>
                    {movie.resolution} · {movie.main_actors.join(", ") || "Ohne Hauptdarsteller"}
                  </small>
                </div>
              </article>
            ))}
          </div>
          {!databaseGaps.length ? (
            <EmptyState>Alle Datenbankpfade wurden exakt auf dem NAS gefunden.</EmptyState>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
