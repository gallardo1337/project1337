"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "project1337_media_health_v1";
const EXPECTED_MEDIA_HOST = "video.my1337.de";

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodedPath(value) {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}

function normalizedMediaPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${decodedPath(
      url.pathname
    )}`.replace(/\/+$/, "");
  } catch {
    return raw.split(/[?#]/)[0].replace(/\/+$/, "");
  }
}

function hasMp4Extension(value) {
  return String(value || "")
    .split(/[?#]/)[0]
    .trim()
    .toLowerCase()
    .endsWith(".mp4");
}

function sharedMainActor(left, right) {
  const rightIds = new Set(
    Array.isArray(right.main_actor_ids) ? right.main_actor_ids : []
  );
  return (Array.isArray(left.main_actor_ids) ? left.main_actor_ids : []).some(
    (id) => rightIds.has(id)
  );
}

function pairKey(movies) {
  return movies
    .map((movie) => String(movie.id))
    .sort()
    .join(":");
}

function rememberAllPairs(movies, seenPairs) {
  for (let leftIndex = 0; leftIndex < movies.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < movies.length;
      rightIndex += 1
    ) {
      seenPairs.add(pairKey([movies[leftIndex], movies[rightIndex]]));
    }
  }
}

function pairKeysForMovies(movies) {
  const keys = [];

  for (let leftIndex = 0; leftIndex < movies.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < movies.length;
      rightIndex += 1
    ) {
      keys.push(pairKey([movies[leftIndex], movies[rightIndex]]));
    }
  }

  return keys;
}

function createDuplicateGroups(movies, liveResults, ignoredPairs) {
  const groups = [];
  const seenPairs = new Set(ignoredPairs);
  const pathMap = new Map();

  movies.forEach((movie) => {
    const path = normalizedMediaPath(movie.file_url);
    if (!path) return;
    if (!pathMap.has(path)) pathMap.set(path, []);
    pathMap.get(path).push(movie);
  });

  pathMap.forEach((items) => {
    if (items.length < 2) return;
    if (pairKeysForMovies(items).every((key) => ignoredPairs.has(key))) return;
    const key = pairKey(items);
    rememberAllPairs(items, seenPairs);
    groups.push({
      id: `path:${key}`,
      confidence: "certain",
      reason: "Identischer Dateipfad",
      detail: "Mehrere Datenbankeinträge verweisen auf exakt dieselbe Videodatei.",
      movies: items,
    });
  });

  const titleMap = new Map();
  movies.forEach((movie) => {
    const title = normalizeTitle(movie.title);
    if (!title) return;
    if (!titleMap.has(title)) titleMap.set(title, []);
    titleMap.get(title).push(movie);
  });

  titleMap.forEach((items) => {
    if (items.length < 2) return;

    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < items.length;
        rightIndex += 1
      ) {
        const left = items[leftIndex];
        const right = items[rightIndex];
        const pair = [left, right];
        const key = pairKey(pair);
        if (seenPairs.has(key)) continue;

        const sameYear = Boolean(left.year && right.year && left.year === right.year);
        const sameStudio = Boolean(
          left.studio_id && right.studio_id && left.studio_id === right.studio_id
        );
        const sameActor = sharedMainActor(left, right);

        if (!sameYear && !sameStudio && !sameActor) continue;

        const evidence = [
          sameActor ? "gleicher Hauptcast" : null,
          sameStudio ? "gleiches Studio" : null,
          sameYear ? "gleiches Jahr" : null,
        ].filter(Boolean);

        seenPairs.add(key);
        groups.push({
          id: `metadata:${key}`,
          confidence: "possible",
          reason: "Sehr ähnliche Metadaten",
          detail: `Identischer Titel, ${evidence.join(" und ")}.`,
          movies: pair,
        });
      }
    }
  });

  const sizeMap = new Map();
  movies.forEach((movie) => {
    const result = liveResults[movie.id];
    const size = Number(result?.fileSize);
    if (!result?.reachable || !Number.isFinite(size) || size < 10_000_000) return;
    if (!sizeMap.has(size)) sizeMap.set(size, []);
    sizeMap.get(size).push(movie);
  });

  sizeMap.forEach((items, size) => {
    if (items.length < 2) return;
    const key = pairKey(items);
    const hasUnseenPair = items.some((left, leftIndex) =>
      items
        .slice(leftIndex + 1)
        .some((right) => !seenPairs.has(pairKey([left, right])))
    );
    if (!hasUnseenPair) return;
    rememberAllPairs(items, seenPairs);
    groups.push({
      id: `size:${key}`,
      confidence: "probable",
      reason: "Identische Dateigröße",
      detail: `${formatBytes(size)} bei unterschiedlichen Dateipfaden.`,
      movies: items,
    });
  });

  const confidenceOrder = { certain: 0, probable: 1, possible: 2 };
  return groups.sort(
    (left, right) =>
      confidenceOrder[left.confidence] - confidenceOrder[right.confidence]
  );
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }

  return `${size.toLocaleString("de-DE", {
    maximumFractionDigits: size >= 100 ? 0 : size >= 10 ? 1 : 2,
  })} ${unit}`;
}

function formatDateTime(value) {
  if (!value) return "Noch nicht live geprüft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Noch nicht live geprüft";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getMovieIssues(movie, liveResult, duplicateGroupIds) {
  const issues = [];
  const rawUrl = String(movie.file_url || "").trim();
  let parsedUrl = null;

  if (!rawUrl) {
    issues.push({ level: "error", code: "missing-url", label: "Kein Dateipfad" });
  } else {
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      issues.push({ level: "error", code: "invalid-url", label: "Ungültige URL" });
    }

    if (parsedUrl && parsedUrl.protocol !== "https:") {
      issues.push({ level: "error", code: "http", label: "Nicht HTTPS" });
    }

    if (
      parsedUrl &&
      parsedUrl.hostname.toLowerCase() !== EXPECTED_MEDIA_HOST
    ) {
      issues.push({ level: "warning", code: "host", label: "Anderer Videohost" });
    }

    if (!hasMp4Extension(rawUrl)) {
      issues.push({ level: "error", code: "extension", label: "Kein vollständiger MP4-Pfad" });
    }
  }

  if (!movie.thumbnail_url) {
    issues.push({ level: "warning", code: "thumbnail", label: "Thumbnail fehlt" });
  }
  if (!movie.studio_id) {
    issues.push({ level: "warning", code: "studio", label: "Studio fehlt" });
  }
  if (!movie.resolution_id) {
    issues.push({ level: "warning", code: "resolution", label: "Qualität fehlt" });
  }
  if (!Array.isArray(movie.main_actor_ids) || movie.main_actor_ids.length === 0) {
    issues.push({ level: "warning", code: "cast", label: "Hauptcast fehlt" });
  }

  if (duplicateGroupIds.length) {
    issues.push({
      level: "warning",
      code: "duplicate",
      label: `${duplicateGroupIds.length} Duplikatverdacht${
        duplicateGroupIds.length === 1 ? "" : "e"
      }`,
    });
  }

  if (liveResult) {
    if (!liveResult.reachable) {
      issues.push({
        level: "error",
        code: "unreachable",
        label: liveResult.error || "Video nicht erreichbar",
      });
    } else {
      if (!liveResult.rangeSupported) {
        issues.push({ level: "warning", code: "range", label: "Keine Byte-Ranges" });
      }
      if (!liveResult.contentTypeValid) {
        issues.push({
          level: "warning",
          code: "mime",
          label: liveResult.contentType
            ? `Falscher Inhaltstyp: ${liveResult.contentType}`
            : "MP4-Inhaltstyp fehlt",
        });
      }
    }
  }

  return issues;
}

function liveState(result) {
  if (!result) return { tone: "pending", label: "Nicht geprüft" };
  if (!result.reachable) return { tone: "error", label: "Nicht erreichbar" };
  if (!result.rangeSupported || !result.contentTypeValid) {
    return { tone: "warning", label: "Erreichbar mit Hinweis" };
  }
  return { tone: "ok", label: "Live geprüft" };
}

export default function AdminMediaHealth({
  movies,
  actorMap,
  studioMap,
  resolutionMap,
  onEditMovie,
}) {
  const [liveResults, setLiveResults] = useState({});
  const [storageReady, setStorageReady] = useState(false);
  const [filter, setFilter] = useState("issues");
  const [search, setSearch] = useState("");
  const [checkingIds, setCheckingIds] = useState(new Set());
  const [scanState, setScanState] = useState({ running: false, done: 0, total: 0 });
  const [scanError, setScanError] = useState(null);
  const [ignoredPairs, setIgnoredPairs] = useState(new Set());
  const [duplicateAction, setDuplicateAction] = useState({
    loading: true,
    saving: null,
    error: null,
    notice: null,
    undo: null,
  });
  const cancelScanRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      setLiveResults(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setLiveResults({});
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(liveResults));
  }, [liveResults, storageReady]);

  useEffect(() => {
    let active = true;

    const loadIgnoredPairs = async () => {
      try {
        const response = await fetch("/api/media-health/duplicates", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "Duplikatentscheidungen konnten nicht geladen werden."
          );
        }

        if (!active) return;
        const keys = (payload.ignored_pairs || []).map((pair) =>
          [String(pair.movie_id_a), String(pair.movie_id_b)].sort().join(":")
        );
        setIgnoredPairs(new Set(keys));
        setDuplicateAction((current) => ({
          ...current,
          loading: false,
          error: null,
        }));
      } catch (error) {
        if (!active) return;
        setDuplicateAction((current) => ({
          ...current,
          loading: false,
          error:
            error?.message ||
            "Duplikatentscheidungen konnten nicht geladen werden.",
        }));
      }
    };

    loadIgnoredPairs();
    return () => {
      active = false;
    };
  }, []);

  const duplicateGroups = useMemo(
    () =>
      duplicateAction.loading
        ? []
        : createDuplicateGroups(movies, liveResults, ignoredPairs),
    [movies, liveResults, ignoredPairs, duplicateAction.loading]
  );

  const duplicateGroupsByMovie = useMemo(() => {
    const map = new Map();
    duplicateGroups.forEach((group) => {
      group.movies.forEach((movie) => {
        if (!map.has(movie.id)) map.set(movie.id, []);
        map.get(movie.id).push(group.id);
      });
    });
    return map;
  }, [duplicateGroups]);

  const movieRows = useMemo(
    () =>
      movies.map((movie) => {
        const duplicateIds = duplicateGroupsByMovie.get(movie.id) || [];
        const issues = getMovieIssues(movie, liveResults[movie.id], duplicateIds);
        const errorCount = issues.filter((issue) => issue.level === "error").length;
        const warningCount = issues.filter((issue) => issue.level === "warning").length;
        return {
          movie,
          issues,
          errorCount,
          warningCount,
          duplicateIds,
          live: liveResults[movie.id],
        };
      }),
    [movies, liveResults, duplicateGroupsByMovie]
  );

  const summary = useMemo(() => {
    const errors = movieRows.filter((row) => row.errorCount > 0).length;
    const warnings = movieRows.filter(
      (row) => row.errorCount === 0 && row.warningCount > 0
    ).length;
    const clean = movieRows.filter(
      (row) => row.errorCount === 0 && row.warningCount === 0
    ).length;
    const liveChecked = movieRows.filter((row) => Boolean(row.live)).length;
    return { errors, warnings, clean, liveChecked };
  }, [movieRows]);

  const filteredRows = useMemo(() => {
    const query = normalizeTitle(search);
    return movieRows.filter((row) => {
      const matchesQuery =
        !query ||
        normalizeTitle(
          `${row.movie.title || ""} ${row.movie.file_url || ""} ${
            studioMap[row.movie.studio_id]?.name || ""
          }`
        ).includes(query);

      if (!matchesQuery) return false;
      if (filter === "all") return true;
      if (filter === "errors") return row.errorCount > 0;
      if (filter === "warnings") {
        return row.errorCount === 0 && row.warningCount > 0;
      }
      if (filter === "duplicates") return row.duplicateIds.length > 0;
      if (filter === "clean") {
        return row.errorCount === 0 && row.warningCount === 0;
      }
      return row.errorCount > 0 || row.warningCount > 0;
    });
  }, [movieRows, search, filter, studioMap]);

  const lastCheckedAt = useMemo(() => {
    const timestamps = Object.values(liveResults)
      .map((result) => new Date(result?.checkedAt || 0).getTime())
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }, [liveResults]);

  const requestCheck = async (movie) => {
    try {
      const response = await fetch(`/api/media-health/${movie.id}`, {
        method: "POST",
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        const requestError = new Error(
          payload?.error || "Live-Prüfung fehlgeschlagen."
        );
        requestError.status = response.status;
        throw requestError;
      }

      return payload.check;
    } catch (error) {
      if (error?.status === 401) throw error;
      return {
        reachable: false,
        rangeSupported: false,
        contentTypeValid: false,
        status: null,
        contentType: null,
        fileSize: null,
        responseTimeMs: null,
        checkedAt: new Date().toISOString(),
        error: error?.message || "Live-Prüfung fehlgeschlagen.",
      };
    }
  };

  const checkSingleMovie = async (movie) => {
    if (checkingIds.has(movie.id) || scanState.running) return;
    setScanError(null);
    setCheckingIds((current) => new Set(current).add(movie.id));

    try {
      const result = await requestCheck(movie);
      setLiveResults((current) => ({ ...current, [movie.id]: result }));
    } catch (error) {
      setScanError(error?.message || "Live-Prüfung fehlgeschlagen.");
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(movie.id);
        return next;
      });
    }
  };

  const scanAllMovies = async () => {
    if (scanState.running) {
      cancelScanRef.current = true;
      return;
    }

    const candidates = movies.filter((movie) => Boolean(movie.file_url));
    cancelScanRef.current = false;
    setScanError(null);
    setScanState({ running: true, done: 0, total: candidates.length });

    let cursor = 0;
    let stoppedByAuth = false;

    const worker = async () => {
      while (!cancelScanRef.current) {
        const index = cursor;
        cursor += 1;
        if (index >= candidates.length) return;

        const movie = candidates[index];
        try {
          const result = await requestCheck(movie);
          setLiveResults((current) => ({ ...current, [movie.id]: result }));
        } catch (error) {
          if (error?.status === 401) {
            stoppedByAuth = true;
            cancelScanRef.current = true;
            setScanError("Admin-Sitzung abgelaufen. Bitte neu einloggen.");
            return;
          }
        } finally {
          setScanState((current) => ({
            ...current,
            done: Math.min(current.done + 1, current.total),
          }));
        }
      }
    };

    await Promise.all(Array.from({ length: 4 }, () => worker()));
    setScanState((current) => ({ ...current, running: false }));

    if (cancelScanRef.current && !stoppedByAuth) {
      setScanError("Live-Prüfung wurde gestoppt.");
    }
  };

  const clearLiveResults = () => {
    if (!Object.keys(liveResults).length || scanState.running) return;
    const confirmed = window.confirm(
      "Gespeicherte Live-Prüfergebnisse aus diesem Browser löschen? Filmdaten bleiben unverändert."
    );
    if (confirmed) setLiveResults({});
  };

  const dismissDuplicateGroup = async (group) => {
    if (duplicateAction.saving) return;

    const movieIds = group.movies.map((movie) => movie.id);
    const confirmed = window.confirm(
      "Diesen Hinweis als „Kein Duplikat“ bestätigen? Die Filme bleiben unverändert und werden künftig nicht mehr zusammen markiert."
    );
    if (!confirmed) return;

    setDuplicateAction((current) => ({
      ...current,
      saving: group.id,
      error: null,
      notice: null,
      undo: null,
    }));

    try {
      const response = await fetch("/api/media-health/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_ids: movieIds }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Entscheidung konnte nicht gespeichert werden.");
      }

      const keys = pairKeysForMovies(group.movies);
      setIgnoredPairs((current) => {
        const next = new Set(current);
        keys.forEach((key) => next.add(key));
        return next;
      });
      setDuplicateAction({
        loading: false,
        saving: null,
        error: null,
        notice: "Bestätigt: Diese Filme sind kein Duplikat.",
        undo: { movieIds, keys },
      });
    } catch (error) {
      setDuplicateAction((current) => ({
        ...current,
        saving: null,
        error: error?.message || "Entscheidung konnte nicht gespeichert werden.",
      }));
    }
  };

  const restoreDuplicateGroup = async () => {
    const undo = duplicateAction.undo;
    if (!undo || duplicateAction.saving) return;

    setDuplicateAction((current) => ({
      ...current,
      saving: "undo",
      error: null,
    }));

    try {
      const response = await fetch("/api/media-health/duplicates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie_ids: undo.movieIds }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload?.error || "Entscheidung konnte nicht rückgängig gemacht werden."
        );
      }

      setIgnoredPairs((current) => {
        const next = new Set(current);
        undo.keys.forEach((key) => next.delete(key));
        return next;
      });
      setDuplicateAction({
        loading: false,
        saving: null,
        error: null,
        notice: "Der Duplikatverdacht wird wieder angezeigt.",
        undo: null,
      });
    } catch (error) {
      setDuplicateAction((current) => ({
        ...current,
        saving: null,
        error:
          error?.message ||
          "Entscheidung konnte nicht rückgängig gemacht werden.",
      }));
    }
  };

  const filters = [
    { key: "issues", label: "Alle Hinweise", count: summary.errors + summary.warnings },
    { key: "errors", label: "Fehler", count: summary.errors },
    { key: "warnings", label: "Warnungen", count: summary.warnings },
    { key: "duplicates", label: "Duplikate", count: duplicateGroups.length },
    { key: "clean", label: "Sauber", count: summary.clean },
    { key: "all", label: "Alle", count: movies.length },
  ];

  return (
    <div className="mediaHealth">
      <section className="mediaHealth__scanbar">
        <div>
          <span className="mediaHealth__pulse" aria-hidden="true" />
          <div>
            <strong>
              {scanState.running
                ? `Live-Prüfung ${scanState.done} / ${scanState.total}`
                : "Bereit für Live-Prüfung"}
            </strong>
            <small>
              {scanState.running
                ? "Vier sichere Prüfungen parallel – Videos werden nicht heruntergeladen."
                : `${summary.liveChecked} von ${movies.length} Filmen live geprüft · ${formatDateTime(
                    lastCheckedAt
                  )}`}
            </small>
          </div>
        </div>

        <div className="mediaHealth__scanActions">
          <button
            type="button"
            className="mediaHealth__clearButton"
            onClick={clearLiveResults}
            disabled={!summary.liveChecked || scanState.running}
          >
            Ergebnisse leeren
          </button>
          <button
            type="button"
            className={scanState.running ? "is-running" : ""}
            onClick={scanAllMovies}
          >
            {scanState.running ? "Prüfung stoppen" : "Alle live prüfen"}
          </button>
        </div>

        {scanState.running ? (
          <span className="mediaHealth__progress">
            <i
              style={{
                width: `${scanState.total ? (scanState.done / scanState.total) * 100 : 0}%`,
              }}
            />
          </span>
        ) : null}
      </section>

      {scanError ? <div className="mediaHealth__error">{scanError}</div> : null}

      <section className="mediaHealth__kpis" aria-label="Prüfstatus">
        <article>
          <span>Katalog</span>
          <strong>{movies.length}</strong>
          <small>Filme geprüft</small>
        </article>
        <article className={summary.errors ? "is-error" : ""}>
          <span>Fehler</span>
          <strong>{summary.errors}</strong>
          <small>Müssen geprüft werden</small>
        </article>
        <article className={summary.warnings ? "is-warning" : ""}>
          <span>Warnungen</span>
          <strong>{summary.warnings}</strong>
          <small>Unvollständig oder auffällig</small>
        </article>
        <article className={duplicateGroups.length ? "is-duplicate" : ""}>
          <span>Duplikate</span>
          <strong>{duplicateGroups.length}</strong>
          <small>Verdachtsgruppen</small>
        </article>
        <article className="is-ok">
          <span>Sauber</span>
          <strong>{summary.clean}</strong>
          <small>Keine Hinweise</small>
        </article>
      </section>

      {duplicateAction.error || duplicateAction.notice ? (
        <div
          className={`mediaHealth__decision ${
            duplicateAction.error ? "is-error" : "is-success"
          }`}
        >
          <span>{duplicateAction.error || duplicateAction.notice}</span>
          {duplicateAction.undo && !duplicateAction.error ? (
            <button
              type="button"
              onClick={restoreDuplicateGroup}
              disabled={duplicateAction.saving === "undo"}
            >
              {duplicateAction.saving === "undo" ? "Wird zurückgesetzt…" : "Rückgängig"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setDuplicateAction((current) => ({
                  ...current,
                  error: null,
                  notice: null,
                }))
              }
            >
              Schließen
            </button>
          )}
        </div>
      ) : null}

      {duplicateGroups.length ? (
        <section className="mediaHealth__duplicatePanel">
          <div className="mediaHealth__sectionHeading">
            <div>
              <span>Duplikaterkennung</span>
              <h2>Auffällige Übereinstimmungen</h2>
            </div>
            <small>Nichts wird automatisch gelöscht.</small>
          </div>

          <div className="mediaHealth__duplicateGrid">
            {duplicateGroups.map((group) => (
              <article key={group.id} className={`is-${group.confidence}`}>
                <header>
                  <div>
                    <span>
                      {group.confidence === "certain"
                        ? "Sicheres Duplikat"
                        : group.confidence === "probable"
                        ? "Wahrscheinlich"
                        : "Mögliches Duplikat"}
                    </span>
                    <strong>{group.reason}</strong>
                  </div>
                  <div className="mediaHealth__duplicateActions">
                    <small>{group.movies.length} Treffer</small>
                    <button
                      type="button"
                      onClick={() => dismissDuplicateGroup(group)}
                      disabled={duplicateAction.saving === group.id}
                    >
                      {duplicateAction.saving === group.id
                        ? "Wird gespeichert…"
                        : "Kein Duplikat"}
                    </button>
                  </div>
                </header>
                <p>{group.detail}</p>
                <div>
                  {group.movies.map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => onEditMovie(movie)}
                    >
                      <span className="mediaHealth__duplicateCover">
                        {movie.thumbnail_url ? (
                          <Image
                            src={movie.thumbnail_url}
                            alt=""
                            fill
                            sizes="48px"
                            unoptimized
                          />
                        ) : (
                          movie.title?.slice(0, 1) || "?"
                        )}
                      </span>
                      <span>
                        <strong>{movie.title || "Unbenannt"}</strong>
                        <small>{normalizedMediaPath(movie.file_url) || "Kein Dateipfad"}</small>
                      </span>
                      <i>Bearbeiten</i>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mediaHealth__catalog">
        <div className="mediaHealth__sectionHeading mediaHealth__sectionHeading--catalog">
          <div>
            <span>Prüfprotokoll</span>
            <h2>Alle Medien</h2>
          </div>
          <label>
            <span>Suche</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Titel, Studio oder Pfad"
            />
          </label>
        </div>

        <div className="mediaHealth__filters" aria-label="Prüfergebnisse filtern">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "is-active" : ""}
              onClick={() => setFilter(item.key)}
            >
              {item.label} <span>{item.count}</span>
            </button>
          ))}
        </div>

        {filteredRows.length ? (
          <div className="mediaHealth__list">
            {filteredRows.map((row) => {
              const state = liveState(row.live);
              const checking = checkingIds.has(row.movie.id);
              const mainCast = (
                Array.isArray(row.movie.main_actor_ids)
                  ? row.movie.main_actor_ids
                  : []
              )
                .map((id) => actorMap[id]?.name)
                .filter(Boolean)
                .join(", ");

              return (
                <article key={row.movie.id} className={`mediaHealth__row is-${state.tone}`}>
                  <div className="mediaHealth__cover">
                    {row.movie.thumbnail_url ? (
                      <Image
                        src={row.movie.thumbnail_url}
                        alt=""
                        fill
                        sizes="64px"
                        unoptimized
                      />
                    ) : (
                      <span>{row.movie.title?.slice(0, 1) || "?"}</span>
                    )}
                  </div>

                  <div className="mediaHealth__identity">
                    <strong>{row.movie.title || "Unbenannt"}</strong>
                    <span>
                      {studioMap[row.movie.studio_id]?.name || "Kein Studio"} · {mainCast || "Kein Hauptcast"}
                    </span>
                    <small>{row.movie.file_url || "Kein Dateipfad hinterlegt"}</small>
                  </div>

                  <div className="mediaHealth__issues">
                    {row.issues.length ? (
                      row.issues.slice(0, 3).map((issue) => (
                        <span key={issue.code} className={`is-${issue.level}`}>
                          {issue.label}
                        </span>
                      ))
                    ) : (
                      <span className="is-ok">Keine Hinweise</span>
                    )}
                    {row.issues.length > 3 ? (
                      <small>+{row.issues.length - 3} weitere</small>
                    ) : null}
                  </div>

                  <div className="mediaHealth__live">
                    <span className={`is-${state.tone}`}>{state.label}</span>
                    <strong>
                      {row.live?.fileSize ? formatBytes(row.live.fileSize) : "–"}
                    </strong>
                    <small>
                      {row.live
                        ? `HTTP ${row.live.status || "–"} · ${
                            row.live.responseTimeMs ?? "–"
                          } ms`
                        : resolutionMap[row.movie.resolution_id]?.name || "Qualität offen"}
                    </small>
                  </div>

                  <div className="mediaHealth__rowActions">
                    <button
                      type="button"
                      onClick={() => checkSingleMovie(row.movie)}
                      disabled={checking || scanState.running || !row.movie.file_url}
                    >
                      {checking ? "Prüft…" : row.live ? "Erneut prüfen" : "Live prüfen"}
                    </button>
                    <button type="button" onClick={() => onEditMovie(row.movie)}>
                      Bearbeiten
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mediaHealth__empty">
            <strong>Keine Filme für diesen Filter.</strong>
            <span>Filter oder Suche zurücksetzen, um weitere Einträge zu sehen.</span>
          </div>
        )}
      </section>

      <p className="mediaHealth__footnote">
        Die Live-Prüfung kontrolliert Erreichbarkeit, HTTPS, MP4-Inhaltstyp,
        Byte-Ranges und Dateigröße. Eine echte Codec-Analyse folgt mit der
        späteren NAS-Anbindung.
      </p>
    </div>
  );
}
