"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PUBLIC_VIDEO_BASE = "https://video.my1337.de/";
const MAX_FOLDER_FILES = 15000;

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function entityLabel(items, id) {
  return items.find((item) => item.id === id)?.name || "Unbekannt";
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** index).toLocaleString("de-DE", {
    maximumFractionDigits: index >= 3 ? 2 : 1,
  })} ${units[index]}`;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(
        2,
        "0"
      )}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function encodeVideoPath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function resolvedVideoUrl(entry, rootName, actors) {
  const actorFolders = new Set(actors.map((actor) => normalizeName(actor.name)));
  const includeRoot = actorFolders.has(normalizeName(rootName));
  const path = includeRoot ? `${rootName}/${entry.path}` : entry.path;
  return new URL(encodeVideoPath(path), PUBLIC_VIDEO_BASE).toString();
}

async function collectDirectoryVideos(directoryHandle, prefix = "", output = []) {
  for await (const [name, handle] of directoryHandle.entries()) {
    if (output.length >= MAX_FOLDER_FILES) break;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      await collectDirectoryVideos(handle, path, output);
    } else if (/\.mp4$/i.test(name)) {
      output.push({ name, path, handle, file: null });
    }
  }
  return output;
}

function probeVideo(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let finished = false;
    const finish = (metadata) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
      resolve({
        width: Number(metadata?.width) || null,
        height: Number(metadata?.height) || null,
        duration_seconds: Number(metadata?.duration_seconds) || null,
        size_bytes: Number(file.size) || null,
        last_modified: Number(file.lastModified) || null,
      });
    };
    const timer = window.setTimeout(() => finish({}), 12000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish({
        width: video.videoWidth,
        height: video.videoHeight,
        duration_seconds: Number.isFinite(video.duration) ? video.duration : null,
      });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      finish({});
    };
    video.src = objectUrl;
  });
}

function EntityPicker({
  label,
  items,
  selectedIds,
  suggestedIds = [],
  onChange,
  placeholder,
}) {
  const [query, setQuery] = useState("");
  const suggested = useMemo(() => new Set(suggestedIds), [suggestedIds]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de");
    return [...items]
      .filter((item) =>
        normalizedQuery
          ? String(item.name || "")
              .toLocaleLowerCase("de")
              .includes(normalizedQuery)
          : true
      )
      .sort((left, right) => {
        const leftSelected = selectedIds.includes(left.id) ? 1 : 0;
        const rightSelected = selectedIds.includes(right.id) ? 1 : 0;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;
        const leftSuggested = suggested.has(left.id) ? 1 : 0;
        const rightSuggested = suggested.has(right.id) ? 1 : 0;
        if (leftSuggested !== rightSuggested) return rightSuggested - leftSuggested;
        return String(left.name || "").localeCompare(
          String(right.name || ""),
          "de",
          { sensitivity: "base" }
        );
      });
  }, [items, query, selectedIds, suggested]);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((current) => current !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <section className="importAssistant__picker">
      <header>
        <div>
          <span>{label}</span>
          <small>{selectedIds.length} ausgewählt</small>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder || `${label} durchsuchen`}
          aria-label={`${label} durchsuchen`}
        />
      </header>
      <div className="importAssistant__pickerList">
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const active = selectedIds.includes(item.id);
            const isSuggested = suggested.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => toggle(item.id)}
                aria-pressed={active}
              >
                <i>{active ? "✓" : "+"}</i>
                <span>{item.name}</span>
                {isSuggested ? <small>IAFD</small> : null}
              </button>
            );
          })
        ) : (
          <p>Keine passenden Einträge.</p>
        )}
      </div>
    </section>
  );
}

function DuplicateCard({ duplicate, studioMap }) {
  const movie = duplicate.movie || {};
  return (
    <article className={`importAssistant__duplicate is-${duplicate.severity}`}>
      <div className="importAssistant__duplicateCover">
        {movie.thumbnail_url ? (
          <img src={movie.thumbnail_url} alt="" />
        ) : (
          <span>{String(movie.title || "?").slice(0, 1)}</span>
        )}
      </div>
      <div>
        <small>
          {duplicate.severity === "blocking"
            ? "Import blockiert"
            : `${Math.round((duplicate.score || 0) * 100)} % Ähnlichkeit`}
        </small>
        <strong>{movie.title || "Unbekannter Film"}</strong>
        <span>
          {studioMap[movie.studio_id]?.name || "Ohne Studio"}
          {movie.year ? ` · ${movie.year}` : ""}
        </span>
        <p>{duplicate.reason}</p>
      </div>
    </article>
  );
}

export default function AdminImportAssistant({
  movies,
  studios,
  mainActors,
  supportActors,
  tags,
  resolutions,
  onMovieImported,
  onEditMovie,
  onOpenThumbnailStudio,
  onUnauthorized,
}) {
  const fallbackInputRef = useRef(null);
  const latestCheckRef = useRef(0);
  const preIafdDraftRef = useRef(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);
  const [fileQuery, setFileQuery] = useState("");
  const [selectedFilePath, setSelectedFilePath] = useState("");
  const [source, setSource] = useState("");
  const [manualSource, setManualSource] = useState("");
  const [technical, setTechnical] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [importedMovie, setImportedMovie] = useState(null);
  const [iafdSearch, setIafdSearch] = useState(null);
  const [iafdSearching, setIafdSearching] = useState(false);
  const [iafdLoadingUrl, setIafdLoadingUrl] = useState("");
  const [iafdError, setIafdError] = useState(null);
  const [iafdUrl, setIafdUrl] = useState("");
  const [iafdMetadata, setIafdMetadata] = useState(null);
  const [newStudioName, setNewStudioName] = useState("");
  const [newSupportingNames, setNewSupportingNames] = useState([]);
  const [allowWithoutIafd, setAllowWithoutIafd] = useState(false);

  const studioMap = useMemo(
    () => Object.fromEntries(studios.map((item) => [item.id, item])),
    [studios]
  );
  const allActorFolders = useMemo(
    () => [...mainActors, ...supportActors],
    [mainActors, supportActors]
  );
  const visibleFolderFiles = useMemo(() => {
    const query = normalizeName(fileQuery);
    const filtered = query
      ? folderFiles.filter((entry) => normalizeName(entry.path).includes(query))
      : folderFiles;
    return filtered.slice(0, 240);
  }, [folderFiles, fileQuery]);
  const blockingDuplicate = analysis?.duplicates?.some(
    (duplicate) => duplicate.severity === "blocking"
  );
  const warningDuplicates = (analysis?.duplicates || []).filter(
    (duplicate) => duplicate.severity !== "blocking"
  );
  const canSave = Boolean(
    draft?.title?.trim() &&
      draft?.resolution_id &&
      draft?.file_url &&
      (iafdMetadata || allowWithoutIafd) &&
      !blockingDuplicate &&
      (!warningDuplicates.length || confirmDuplicate) &&
      !saving
  );

  const handleUnauthorized = () => {
    onUnauthorized?.();
  };

  const searchIafd = async (nextAnalysis) => {
    const query =
      nextAnalysis?.source?.title ||
      String(nextAnalysis?.source?.filename || "").replace(/\.mp4$/i, "");
    if (!query.trim()) return;

    const actorIds = nextAnalysis?.suggestions?.main_actor_ids || [];
    const actorUrls = mainActors
      .filter((actor) => actorIds.includes(actor.id) && actor.iafd_url)
      .map((actor) => actor.iafd_url);
    setIafdSearching(true);
    setIafdError(null);
    setIafdSearch(null);
    try {
      const response = await fetch("/api/movies/import/iafd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          action: "search",
          query,
          year: nextAnalysis?.suggestions?.year || null,
          actor_urls: actorUrls,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || "IAFD konnte nicht durchsucht werden.");
      }
      setIafdSearch(payload.search);
      if (!payload.search?.results?.length) {
        setIafdError(
          "IAFD hat keinen sicheren Treffer geliefert. Nutze unten den direkten IAFD-Link."
        );
      }
    } catch (searchError) {
      setIafdError(searchError?.message || "IAFD konnte nicht durchsucht werden.");
    } finally {
      setIafdSearching(false);
    }
  };

  const requestAnalysis = async ({
    fileUrl,
    technicalData = technical,
    preserveDraft = false,
  } = {}) => {
    const analyzedUrl = fileUrl || (preserveDraft ? draft?.file_url : source);
    if (!String(analyzedUrl || "").trim()) {
      setError("Bitte zuerst eine MP4-Datei auswählen.");
      return;
    }

    const checkId = latestCheckRef.current + 1;
    latestCheckRef.current = checkId;
    preserveDraft ? setChecking(true) : setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/movies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          file_url: analyzedUrl,
          title: preserveDraft ? draft?.title : undefined,
          year: preserveDraft ? draft?.year : undefined,
          technical: technicalData,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || "Die Datei konnte nicht analysiert werden.");
      }
      if (preserveDraft && checkId !== latestCheckRef.current) return;

      if (preserveDraft) {
        setAnalysis((current) => ({
          ...current,
          duplicates: payload.analysis.duplicates,
          findings: payload.analysis.findings,
        }));
        setConfirmDuplicate(false);
      } else {
        const nextAnalysis = payload.analysis;
        const nextDraft = {
          file_url: nextAnalysis.canonical_url,
          title: nextAnalysis.suggestions.title || "",
          year: nextAnalysis.suggestions.year || "",
          studio_id: nextAnalysis.suggestions.studio_id || "",
          resolution_id: nextAnalysis.suggestions.resolution_id || "",
          main_actor_ids: nextAnalysis.suggestions.main_actor_ids || [],
          supporting_actor_ids:
            nextAnalysis.suggestions.supporting_actor_ids || [],
          tag_ids: nextAnalysis.suggestions.tag_ids || [],
        };
        setSource(nextAnalysis.canonical_url);
        setAnalysis(nextAnalysis);
        setDraft(nextDraft);
        preIafdDraftRef.current = null;
        setConfirmDuplicate(false);
        setImportedMovie(null);
        setIafdMetadata(null);
        setIafdUrl("");
        setNewStudioName("");
        setNewSupportingNames([]);
        setAllowWithoutIafd(false);
        await searchIafd(nextAnalysis);
      }
    } catch (requestError) {
      setError(
        requestError?.message || "Die Videodatei konnte nicht analysiert werden."
      );
    } finally {
      setAnalyzing(false);
      if (!preserveDraft || checkId === latestCheckRef.current) setChecking(false);
    }
  };

  useEffect(() => {
    if (!analysis || !draft?.file_url || importedMovie) return undefined;
    const timer = window.setTimeout(() => {
      requestAnalysis({ preserveDraft: true });
    }, 700);
    return () => window.clearTimeout(timer);
    // Nur Titel und Jahr sollen die Duplikatprüfung leise aktualisieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.title, draft?.year]);

  const openNasFolder = async () => {
    if (typeof window.showDirectoryPicker !== "function") {
      fallbackInputRef.current?.click();
      return;
    }
    setFolderLoading(true);
    setError(null);
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const entries = await collectDirectoryVideos(handle);
      entries.sort((left, right) =>
        left.path.localeCompare(right.path, "de", { sensitivity: "base" })
      );
      setFolderName(handle.name || "NAS");
      setFolderFiles(entries);
      setFileQuery("");
      if (!entries.length) {
        setError("In diesem Ordner wurden keine MP4-Dateien gefunden.");
      }
    } catch (folderError) {
      if (folderError?.name !== "AbortError") {
        setError("Der NAS-Ordner konnte nicht gelesen werden.");
      }
    } finally {
      setFolderLoading(false);
    }
  };

  const handleFallbackFolder = (event) => {
    const files = Array.from(event.target.files || []).filter((file) =>
      /\.mp4$/i.test(file.name)
    );
    const firstPath = files[0]?.webkitRelativePath || "";
    const root = firstPath.split("/")[0] || "NAS";
    const entries = files.map((file) => {
      const fullPath = file.webkitRelativePath || file.name;
      const path = fullPath.startsWith(`${root}/`)
        ? fullPath.slice(root.length + 1)
        : fullPath;
      return { name: file.name, path, file, handle: null };
    });
    entries.sort((left, right) =>
      left.path.localeCompare(right.path, "de", { sensitivity: "base" })
    );
    setFolderName(root);
    setFolderFiles(entries);
    setFileQuery("");
    setError(entries.length ? null : "In diesem Ordner wurden keine MP4-Dateien gefunden.");
    event.target.value = "";
  };

  const selectFolderFile = async (entry) => {
    setAnalyzing(true);
    setError(null);
    setSelectedFilePath(entry.path);
    try {
      const file = entry.file || (await entry.handle.getFile());
      const technicalData = await probeVideo(file);
      const fileUrl = resolvedVideoUrl(entry, folderName, allActorFolders);
      setTechnical(technicalData);
      setSource(fileUrl);
      await requestAnalysis({ fileUrl, technicalData });
    } catch (fileError) {
      setError(
        fileError?.message || "Die ausgewählte Videodatei konnte nicht gelesen werden."
      );
      setAnalyzing(false);
    }
  };

  const loadIafdDetails = async (url) => {
    const targetUrl = String(url || iafdUrl).trim();
    if (!targetUrl) {
      setIafdError("Bitte einen IAFD-Filmlink eingeben.");
      return;
    }
    setIafdLoadingUrl(targetUrl);
    setIafdError(null);
    try {
      const response = await fetch("/api/movies/import/iafd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "details", url: targetUrl }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || "Die IAFD-Filmseite konnte nicht gelesen werden.");
      }

      const metadata = payload.metadata;
      if (!iafdMetadata && draft) {
        preIafdDraftRef.current = {
          ...draft,
          main_actor_ids: [...(draft.main_actor_ids || [])],
          supporting_actor_ids: [...(draft.supporting_actor_ids || [])],
          tag_ids: [...(draft.tag_ids || [])],
        };
      }
      setIafdMetadata(metadata);
      setIafdUrl(metadata.url || targetUrl);
      setNewStudioName(metadata.studio_match ? "" : metadata.studio || "");
      setNewSupportingNames(
        unique((metadata.unmatched_cast || []).map((performer) => performer.name))
      );
      setDraft((current) => ({
        ...current,
        title: metadata.title || current.title,
        year: metadata.year || current.year,
        studio_id: metadata.studio_match?.id || current.studio_id || "",
        main_actor_ids: unique([
          ...(current.main_actor_ids || []),
          ...(metadata.main_actor_ids || []),
        ]),
        supporting_actor_ids: unique([
          ...(current.supporting_actor_ids || []),
          ...(metadata.supporting_actor_ids || []),
        ]),
        tag_ids: unique([
          ...(current.tag_ids || []),
          ...(metadata.tag_ids || []),
        ]),
      }));
      setAllowWithoutIafd(false);
    } catch (detailsError) {
      setIafdError(
        detailsError?.message || "Die IAFD-Filmseite konnte nicht gelesen werden."
      );
    } finally {
      setIafdLoadingUrl("");
    }
  };

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const toggleNewSupportingName = (name) => {
    setNewSupportingNames((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    );
  };

  const clearIafdSelection = () => {
    if (preIafdDraftRef.current) {
      setDraft(preIafdDraftRef.current);
    }
    preIafdDraftRef.current = null;
    setIafdMetadata(null);
    setIafdUrl("");
    setNewStudioName("");
    setNewSupportingNames([]);
    setAllowWithoutIafd(false);
    setIafdError(null);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/movies/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...draft,
          iafd_url: iafdMetadata?.url || null,
          confirm_duplicate: confirmDuplicate,
          new_studio_name: draft.studio_id ? "" : newStudioName,
          new_supporting_names: newSupportingNames,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) {
        if (payload.duplicates) {
          setAnalysis((current) => ({
            ...current,
            duplicates: payload.duplicates,
          }));
          setConfirmDuplicate(false);
        }
        throw new Error(payload.error || "Der Film konnte nicht importiert werden.");
      }
      setImportedMovie(payload.movie);
      onMovieImported?.(payload.movie);
    } catch (saveError) {
      setError(saveError?.message || "Der Film konnte nicht importiert werden.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSelectedFilePath("");
    setSource("");
    setManualSource("");
    setTechnical(null);
    setAnalysis(null);
    setDraft(null);
    setImportedMovie(null);
    setConfirmDuplicate(false);
    setError(null);
    setIafdSearch(null);
    setIafdError(null);
    setIafdUrl("");
    setIafdMetadata(null);
    preIafdDraftRef.current = null;
    setNewStudioName("");
    setNewSupportingNames([]);
    setAllowWithoutIafd(false);
  };

  if (importedMovie) {
    return (
      <section className="importAssistant importAssistant--success">
        <div className="importAssistant__successMark">✓</div>
        <span className="importAssistant__eyebrow">Import abgeschlossen</span>
        <h2>{importedMovie.title}</h2>
        <p>
          Videoquelle, IAFD-Metadaten und deine Stammdaten wurden zusammengeführt.
          Als Nächstes kannst du direkt ein Thumbnail aus dem Video erzeugen.
        </p>
        <div className="importAssistant__successFacts">
          <div>
            <span>Qualität</span>
            <strong>{entityLabel(resolutions, importedMovie.resolution_id)}</strong>
          </div>
          <div>
            <span>Cast</span>
            <strong>
              {(importedMovie.main_actor_ids?.length || 0) +
                (importedMovie.supporting_actor_ids?.length || 0)}
            </strong>
          </div>
          <div>
            <span>Tags</span>
            <strong>{importedMovie.tag_ids?.length || 0}</strong>
          </div>
        </div>
        <div className="importAssistant__successActions">
          <button
            type="button"
            className="is-primary"
            onClick={() => onOpenThumbnailStudio?.(importedMovie)}
          >
            Thumbnail erzeugen <span>→</span>
          </button>
          <button type="button" onClick={() => onEditMovie?.(importedMovie)}>
            Film bearbeiten
          </button>
          <button type="button" onClick={reset}>
            Weiteren Film importieren
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="importAssistant">
      <div className="importAssistant__steps" aria-label="Importfortschritt">
        <div className={analysis ? "is-complete" : "is-active"}>
          <b>01</b>
          <span>NAS-Datei</span>
        </div>
        <i />
        <div className={iafdMetadata ? "is-complete" : analysis ? "is-active" : ""}>
          <b>02</b>
          <span>IAFD-Treffer</span>
        </div>
        <i />
        <div className={iafdMetadata ? "is-active" : ""}>
          <b>03</b>
          <span>Prüfen & speichern</span>
        </div>
      </div>

      <section className="importAssistant__source importAssistant__source--browser">
        <div>
          <span className="importAssistant__eyebrow">01 / NAS-Datei</span>
          <h2>Video auswählen. Nicht hochladen.</h2>
          <p>
            Öffne deinen NAS-Hauptordner und wähle die MP4 direkt aus der Liste.
            Die Datei bleibt lokal; gelesen werden nur Pfad, Größe, Laufzeit und
            Auflösung.
          </p>
          <button
            type="button"
            className="importAssistant__folderButton"
            onClick={openNasFolder}
            disabled={folderLoading}
          >
            {folderLoading ? "Ordner wird gelesen…" : "NAS-Ordner öffnen"}
            {!folderLoading ? <span>↗</span> : null}
          </button>
          <input
            ref={fallbackInputRef}
            className="importAssistant__fallbackInput"
            type="file"
            accept="video/mp4,.mp4"
            multiple
            webkitdirectory=""
            onChange={handleFallbackFolder}
            tabIndex={-1}
          />
          <small>Empfohlen: den Ordner auswählen, der alle Darstellerordner enthält.</small>
        </div>

        <div className="importAssistant__fileBrowser">
          <header>
            <div>
              <strong>{folderName || "Noch kein NAS-Ordner geöffnet"}</strong>
              <small>
                {folderFiles.length
                  ? `${folderFiles.length.toLocaleString("de-DE")} MP4-Dateien gefunden`
                  : "Nach dem Öffnen erscheinen hier die Videos"}
              </small>
            </div>
            {folderFiles.length ? (
              <input
                type="search"
                value={fileQuery}
                onChange={(event) => setFileQuery(event.target.value)}
                placeholder="Datei oder Ordner suchen…"
                aria-label="NAS-Dateien durchsuchen"
              />
            ) : null}
          </header>
          <div className="importAssistant__fileList">
            {visibleFolderFiles.length ? (
              visibleFolderFiles.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={selectedFilePath === entry.path ? "is-active" : ""}
                  onClick={() => selectFolderFile(entry)}
                  disabled={analyzing && selectedFilePath === entry.path}
                >
                  <i>▶</i>
                  <span>
                    <strong>{entry.name}</strong>
                    <small>{entry.path}</small>
                  </span>
                  <b>{selectedFilePath === entry.path ? "Ausgewählt" : "Wählen"}</b>
                </button>
              ))
            ) : (
              <div className="importAssistant__fileEmpty">
                <i>MP4</i>
                <span>{folderFiles.length ? "Keine passende Datei" : "NAS wartet"}</span>
              </div>
            )}
          </div>
          {folderFiles.length > visibleFolderFiles.length ? (
            <small className="importAssistant__fileLimit">
              Die ersten 240 Treffer werden angezeigt. Nutze die Suche zum Eingrenzen.
            </small>
          ) : null}
          <form
            className="importAssistant__manualSource"
            onSubmit={(event) => {
              event.preventDefault();
              setSource(manualSource);
              setTechnical(null);
              setSelectedFilePath("");
              requestAnalysis({ fileUrl: manualSource, technicalData: null });
            }}
          >
            <label htmlFor="movie-import-manual">Alternativ: bekannter MP4-Link</label>
            <div>
              <input
                id="movie-import-manual"
                value={manualSource}
                onChange={(event) => setManualSource(event.target.value)}
                placeholder="https://video.my1337.de/…/Film.mp4"
              />
              <button type="submit" disabled={!manualSource.trim() || analyzing}>
                Prüfen
              </button>
            </div>
          </form>
        </div>
      </section>

      {error ? <div className="importAssistant__message is-error">{error}</div> : null}

      {analysis && draft ? (
        <>
          <section className="importAssistant__analysisBar">
            <div>
              <span className="importAssistant__pulse" />
              <div>
                <strong>{analysis.source.filename}</strong>
                <small>
                  {technical?.width && technical?.height
                    ? `${technical.width} × ${technical.height} · ${formatDuration(
                        technical.duration_seconds
                      )} · ${formatBytes(technical.size_bytes)}`
                    : "MP4-Pfad geprüft"}
                </small>
              </div>
            </div>
            <code title={draft.file_url}>{draft.file_url}</code>
            <span>{checking ? "Duplikate werden geprüft…" : "Quelle bereit"}</span>
          </section>

          <section className="importAssistant__iafd">
            <header>
              <div>
                <span className="importAssistant__eyebrow">02 / IAFD-Abgleich</span>
                <h3>
                  {iafdMetadata
                    ? "IAFD-Daten übernommen"
                    : iafdSearching
                    ? "Filmografie wird durchsucht…"
                    : "Passenden Film auswählen"}
                </h3>
              </div>
              {iafdMetadata ? (
                <a href={iafdMetadata.url} target="_blank" rel="noreferrer">
                  IAFD öffnen ↗
                </a>
              ) : null}
            </header>

            {iafdSearching ? (
              <div className="importAssistant__iafdLoading">
                <i />
                <span>Hauptcast-Filmografie und Titelsuche werden abgeglichen…</span>
              </div>
            ) : iafdMetadata ? (
              <div className="importAssistant__iafdApplied">
                <div>
                  <span>Bestätigter Titel</span>
                  <strong>{iafdMetadata.title}</strong>
                  <small>
                    {iafdMetadata.year || "Jahr unbekannt"} · {iafdMetadata.studio || "Studio unbekannt"}
                  </small>
                </div>
                <dl>
                  <div>
                    <dt>IAFD-Cast</dt>
                    <dd>{iafdMetadata.cast?.length || 0}</dd>
                  </div>
                  <div>
                    <dt>Lokal erkannt</dt>
                    <dd>{iafdMetadata.matched_cast?.length || 0}</dd>
                  </div>
                  <div>
                    <dt>Neue Darsteller</dt>
                    <dd>{iafdMetadata.unmatched_cast?.length || 0}</dd>
                  </div>
                  <div>
                    <dt>Tags erkannt</dt>
                    <dd>{iafdMetadata.tag_ids?.length || 0}</dd>
                  </div>
                </dl>
                <button type="button" onClick={clearIafdSelection}>
                  Anderen Treffer wählen
                </button>
              </div>
            ) : (
              <div className="importAssistant__iafdResults">
                {(iafdSearch?.results || []).map((result, index) => (
                  <button
                    key={result.url}
                    type="button"
                    onClick={() => loadIafdDetails(result.url)}
                    disabled={Boolean(iafdLoadingUrl)}
                  >
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <span>
                      <strong>{result.title}</strong>
                      <small>
                        {result.year || "Jahr offen"}
                        {result.studio ? ` · ${result.studio}` : ""} · {result.source}
                      </small>
                    </span>
                    <i>{Math.round((result.score || 0) * 100)} %</i>
                    <em>
                      {iafdLoadingUrl === result.url ? "Lädt…" : "Übernehmen →"}
                    </em>
                  </button>
                ))}
              </div>
            )}

            {iafdError ? (
              <div className="importAssistant__message is-warning">{iafdError}</div>
            ) : null}

            {!iafdMetadata ? (
              <form
                className="importAssistant__iafdManual"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadIafdDetails(iafdUrl);
                }}
              >
                <label htmlFor="movie-import-iafd-url">Direkter IAFD-Filmlink</label>
                <div>
                  <input
                    id="movie-import-iafd-url"
                    value={iafdUrl}
                    onChange={(event) => setIafdUrl(event.target.value)}
                    placeholder="https://www.iafd.com/title.rme/id=…"
                  />
                  <button type="submit" disabled={!iafdUrl.trim() || Boolean(iafdLoadingUrl)}>
                    {iafdLoadingUrl === iafdUrl ? "Lädt…" : "IAFD lesen"}
                  </button>
                </div>
              </form>
            ) : null}
          </section>

          <div className="importAssistant__layout">
            <div className="importAssistant__editor">
              <section className="importAssistant__block">
                <header>
                  <div>
                    <span className="importAssistant__eyebrow">03 / Kerndaten</span>
                    <h3>Vorschlag prüfen</h3>
                  </div>
                  <small>IAFD-Daten bleiben vor dem Speichern editierbar</small>
                </header>
                <div className="importAssistant__fields">
                  <label className="is-wide">
                    <span>Filmtitel *</span>
                    <input
                      value={draft.title}
                      onChange={(event) => updateDraft("title", event.target.value)}
                      maxLength={250}
                      placeholder="Filmtitel"
                    />
                    <small>
                      {iafdMetadata
                        ? "Von der bestätigten IAFD-Filmseite"
                        : "Noch nicht durch IAFD bestätigt"}
                    </small>
                  </label>
                  <label>
                    <span>Jahr</span>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={draft.year}
                      onChange={(event) => updateDraft("year", event.target.value)}
                      placeholder="2026"
                    />
                  </label>
                  <label>
                    <span>Qualität *</span>
                    <select
                      value={draft.resolution_id}
                      onChange={(event) => updateDraft("resolution_id", event.target.value)}
                    >
                      <option value="">Qualität wählen</option>
                      {resolutions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    <span>Studio</span>
                    <select
                      value={draft.studio_id}
                      onChange={(event) => {
                        updateDraft("studio_id", event.target.value);
                        if (event.target.value) setNewStudioName("");
                      }}
                    >
                      <option value="">Noch kein vorhandenes Studio gewählt</option>
                      {studios.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!draft.studio_id && iafdMetadata?.studio ? (
                    <label className="is-wide importAssistant__newEntity">
                      <span>Neues Studio aus IAFD anlegen</span>
                      <input
                        value={newStudioName}
                        onChange={(event) => setNewStudioName(event.target.value)}
                        placeholder={iafdMetadata.studio}
                      />
                      <small>Wird zusammen mit dem Film in den Stammdaten angelegt.</small>
                    </label>
                  ) : null}
                </div>
              </section>

              {iafdMetadata?.unmatched_cast?.length ? (
                <section className="importAssistant__newCast">
                  <header>
                    <div>
                      <span className="importAssistant__eyebrow">IAFD-Cast</span>
                      <h3>Neue Nebendarsteller</h3>
                    </div>
                    <small>{newSupportingNames.length} werden angelegt</small>
                  </header>
                  <p>
                    Diese Namen stehen im IAFD-Cast, existieren aber noch nicht in deinen
                    Stammdaten. Entferne den Haken, wenn ein Eintrag nicht angelegt werden soll.
                  </p>
                  <div>
                    {iafdMetadata.unmatched_cast.map((performer) => (
                      <label key={`${performer.name}-${performer.url}`}>
                        <input
                          type="checkbox"
                          checked={newSupportingNames.includes(performer.name)}
                          onChange={() => toggleNewSupportingName(performer.name)}
                        />
                        <span>{performer.name}</span>
                        {performer.url ? (
                          <a href={performer.url} target="_blank" rel="noreferrer">
                            IAFD ↗
                          </a>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}

              <EntityPicker
                label="Hauptdarsteller"
                items={mainActors}
                selectedIds={draft.main_actor_ids}
                suggestedIds={iafdMetadata?.main_actor_ids || analysis.suggestions.main_actor_ids}
                onChange={(ids) => updateDraft("main_actor_ids", ids)}
              />
              <EntityPicker
                label="Nebendarsteller"
                items={supportActors}
                selectedIds={draft.supporting_actor_ids}
                suggestedIds={
                  iafdMetadata?.supporting_actor_ids ||
                  analysis.suggestions.supporting_actor_ids
                }
                onChange={(ids) => updateDraft("supporting_actor_ids", ids)}
              />
              <EntityPicker
                label="Tags"
                items={tags}
                selectedIds={draft.tag_ids}
                suggestedIds={iafdMetadata?.tag_ids || analysis.suggestions.tag_ids}
                onChange={(ids) => updateDraft("tag_ids", ids)}
              />
            </div>

            <aside className="importAssistant__review">
              <section>
                <span className="importAssistant__eyebrow">Erkennung</span>
                <h3>Was wirklich gelesen wurde</h3>
                <div className="importAssistant__findings">
                  {analysis.findings.map((finding, index) => (
                    <div key={`${finding.label}-${index}`} className={`is-${finding.type}`}>
                      <i>{finding.type === "warning" ? "!" : "✓"}</i>
                      <span>{finding.label}</span>
                    </div>
                  ))}
                  <div className={iafdMetadata ? "is-success" : "is-warning"}>
                    <i>{iafdMetadata ? "✓" : "!"}</i>
                    <span>
                      {iafdMetadata
                        ? `IAFD: ${iafdMetadata.cast?.length || 0} Cast-Einträge, ${
                            iafdMetadata.tag_ids?.length || 0
                          } Tags`
                        : "IAFD-Treffer noch nicht bestätigt"}
                    </span>
                  </div>
                </div>
              </section>

              <section>
                <span className="importAssistant__eyebrow">Duplikatprüfung</span>
                <h3>
                  {analysis.duplicates.length
                    ? `${analysis.duplicates.length} möglicher Treffer`
                    : "Keine Überschneidung"}
                </h3>
                {analysis.duplicates.length ? (
                  <div className="importAssistant__duplicates">
                    {analysis.duplicates.map((duplicate) => (
                      <DuplicateCard
                        key={`${duplicate.type}-${duplicate.movie.id}`}
                        duplicate={duplicate}
                        studioMap={studioMap}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="importAssistant__allClear">
                    Pfad, Titel und Jahr sind im aktuellen Archiv unauffällig.
                  </p>
                )}
                {warningDuplicates.length && !blockingDuplicate ? (
                  <label className="importAssistant__duplicateConfirm">
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={(event) => setConfirmDuplicate(event.target.checked)}
                    />
                    <span>Geprüft: Es ist kein Duplikat und darf importiert werden.</span>
                  </label>
                ) : null}
              </section>

              <section className="importAssistant__summary">
                <span className="importAssistant__eyebrow">Bereitstellen</span>
                <h3>{draft.title || "Titel fehlt"}</h3>
                <dl>
                  <div>
                    <dt>Studio</dt>
                    <dd>
                      {draft.studio_id
                        ? entityLabel(studios, draft.studio_id)
                        : newStudioName || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Qualität</dt>
                    <dd>{entityLabel(resolutions, draft.resolution_id)}</dd>
                  </div>
                  <div>
                    <dt>Cast</dt>
                    <dd>
                      {draft.main_actor_ids.length +
                        draft.supporting_actor_ids.length +
                        newSupportingNames.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Tags</dt>
                    <dd>{draft.tag_ids.length}</dd>
                  </div>
                </dl>
                {!iafdMetadata ? (
                  <label className="importAssistant__withoutIafd">
                    <input
                      type="checkbox"
                      checked={allowWithoutIafd}
                      onChange={(event) => setAllowWithoutIafd(event.target.checked)}
                    />
                    <span>Ausnahmsweise ohne bestätigten IAFD-Treffer speichern</span>
                  </label>
                ) : null}
                <button type="button" onClick={handleSave} disabled={!canSave}>
                  {saving ? "Film wird importiert…" : "Film jetzt importieren"}
                  {!saving ? <span>→</span> : null}
                </button>
                {blockingDuplicate ? (
                  <small className="is-blocked">Derselbe Dateipfad ist bereits vergeben.</small>
                ) : !iafdMetadata && !allowWithoutIafd ? (
                  <small>Bitte zuerst einen IAFD-Treffer bestätigen.</small>
                ) : warningDuplicates.length && !confirmDuplicate ? (
                  <small>Bitte die Duplikatwarnung zuerst bestätigen.</small>
                ) : (
                  <small>Speicherung erfolgt erst nach einer letzten Serverprüfung.</small>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className="importAssistant__empty">
          <div>NAS</div>
          <span>Warte auf Videodatei</span>
          <p>
            Öffne oben deinen NAS-Ordner. Danach wählst du ein Video aus und der
            IAFD-Abgleich startet automatisch.
          </p>
          <small>{movies.length} Filme stehen für die Duplikatprüfung bereit</small>
        </section>
      )}
    </section>
  );
}
