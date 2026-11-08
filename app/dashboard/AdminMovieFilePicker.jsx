"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  movieFileUrlKey,
  resolveSelectedVideoUrl,
} from "../../lib/movieFilePaths.mjs";
import styles from "./AdminMovieFilePicker.module.css";

const MAX_FOLDER_FILES = 15000;
const VIDEO_FILE_PATTERN = /\.(mp4|m4v|mkv|avi|mov|wmv|webm|mpg|mpeg|mpe|m2v|mts|m2ts|ts|vob|ogv|ogg|flv|f4v|3gp|3g2|asf|divx|rm|rmvb)$/i;

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function collectDirectoryVideos(directoryHandle, prefix = "", output = []) {
  for await (const [name, handle] of directoryHandle.entries()) {
    if (output.length >= MAX_FOLDER_FILES) break;
    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "directory") {
      await collectDirectoryVideos(handle, path, output);
    } else if (VIDEO_FILE_PATTERN.test(name)) {
      output.push({ name, path, fileHandle: handle });
    }
  }

  return output;
}

function sortEntries(entries) {
  return entries.sort((left, right) =>
    left.path.localeCompare(right.path, "de", { sensitivity: "base" })
  );
}

export default function AdminMovieFilePicker({
  movies,
  mainActors,
  supportActors,
  value,
  editingMovieId,
  onChange,
}) {
  const fallbackInputRef = useRef(null);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [folderLoading, setFolderLoading] = useState(false);
  const [selectingPath, setSelectingPath] = useState("");
  const [query, setQuery] = useState("");
  const [hideExisting, setHideExisting] = useState(false);
  const [error, setError] = useState("");
  const deferredQuery = useDeferredValue(query);

  const actorNames = useMemo(
    () => [...mainActors, ...supportActors].map((actor) => actor.name),
    [mainActors, supportActors]
  );

  const moviesByFile = useMemo(() => {
    const index = new Map();
    movies.forEach((movie) => {
      const key = movieFileUrlKey(movie.file_url);
      if (key && !index.has(key)) index.set(key, movie);
    });
    return index;
  }, [movies]);

  const selectedKey = useMemo(() => movieFileUrlKey(value), [value]);

  const resolvedFiles = useMemo(
    () =>
      folderFiles.map((entry) => {
        const url = resolveSelectedVideoUrl({
          relativePath: entry.path,
          rootName: folderName,
          actorNames,
        });
        const key = movieFileUrlKey(url);
        return {
          ...entry,
          url,
          key,
          movie: moviesByFile.get(key) || null,
        };
      }),
    [actorNames, folderFiles, folderName, moviesByFile]
  );

  const visibleFiles = useMemo(() => {
    const normalizedQuery = normalizeSearchText(deferredQuery);
    return resolvedFiles.filter((entry) =>
      (!hideExisting || !entry.movie) &&
      (!normalizedQuery || normalizeSearchText(entry.path).includes(normalizedQuery))
    );
  }, [deferredQuery, hideExisting, resolvedFiles]);

  const existingCount = useMemo(
    () => resolvedFiles.filter((entry) => entry.movie).length,
    [resolvedFiles]
  );

  const applyFolder = (name, entries) => {
    setFolderName(name || "NAS");
    setFolderFiles(sortEntries(entries));
    setQuery("");
    setError(
      entries.length ? "" : "In diesem Ordner wurden keine Videodateien gefunden."
    );
  };

  const openNasFolder = async () => {
    if (typeof window.showDirectoryPicker !== "function") {
      fallbackInputRef.current?.click();
      return;
    }

    setFolderLoading(true);
    setError("");
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      const entries = await collectDirectoryVideos(handle);
      applyFolder(handle.name, entries);
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
      VIDEO_FILE_PATTERN.test(file.name)
    );
    const firstPath = files[0]?.webkitRelativePath || "";
    const root = firstPath.split("/")[0] || "NAS";
    const entries = files.map((file) => {
      const fullPath = file.webkitRelativePath || file.name;
      const path = fullPath.startsWith(`${root}/`)
        ? fullPath.slice(root.length + 1)
        : fullPath;
      return { name: file.name, path, file };
    });

    applyFolder(root, entries);
    event.target.value = "";
  };

  const handleFileSelect = async (entry) => {
    setSelectingPath(entry.path);
    setError("");

    try {
      const file = entry.file || (await entry.fileHandle?.getFile()) || null;
      onChange(entry.url, file);
    } catch (fileError) {
      console.error(fileError);
      setError(
        "Die ausgewählte MP4 konnte nicht für den Thumbnail-Generator geöffnet werden."
      );
    } finally {
      setSelectingPath("");
    }
  };

  return (
    <section className={styles.picker} aria-labelledby="movie-file-picker-title">
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>Videodatei</span>
          <h3 id="movie-file-picker-title">MP4 aus dem NAS-Ordner auswählen</h3>
          <p>
            Bereits verwendete Dateien sind grün markiert und können nicht erneut
            ausgewählt werden. Andere Videoformate sind gelb markiert und müssen
            vor dem Hinzufügen in MP4 umgewandelt werden. Die Videos bleiben vollständig auf deinem Gerät.
          </p>
        </div>
        <button
          type="button"
          className={styles.folderButton}
          onClick={openNasFolder}
          disabled={folderLoading}
        >
          {folderLoading ? "Ordner wird gelesen…" : "NAS-Ordner öffnen"}
          {!folderLoading ? <span>↗</span> : null}
        </button>
        <input
          ref={fallbackInputRef}
          className={styles.fallbackInput}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          onChange={handleFallbackFolder}
          tabIndex={-1}
        />
      </div>

      <div className={styles.browser}>
        <header>
          <div>
            <strong>{folderName || "Noch kein NAS-Ordner geöffnet"}</strong>
            <small>
              {folderFiles.length
                ? `${visibleFiles.length.toLocaleString("de-DE")} von ${folderFiles.length.toLocaleString("de-DE")} Videodateien · ${existingCount.toLocaleString("de-DE")} bereits vorhanden`
                : "Ordner auswählen, um die Videodateien anzuzeigen"}
            </small>
          </div>
          {folderFiles.length ? (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Datei oder Ordner suchen…"
              aria-label="Videodateien durchsuchen"
            />
          ) : null}
        </header>

        {folderFiles.length ? (
          <label className={styles.filter}>
            <input
              type="checkbox"
              checked={hideExisting}
              onChange={(event) => setHideExisting(event.target.checked)}
            />
            Bereits hinzugefügte ausblenden
          </label>
        ) : null}

        <div className={styles.fileList}>
          {visibleFiles.length ? (
            visibleFiles.map((entry) => {
              const isCurrentMovie = entry.movie?.id === editingMovieId;
              const isNonMp4 = !/\.mp4$/i.test(entry.name);
              const isBlocked = Boolean(entry.movie && !isCurrentMovie);
              const isActive = entry.key === selectedKey;
              const classNames = [
                isActive ? styles.active : "",
                entry.movie ? styles.existing : "",
                isNonMp4 ? styles.nonMp4 : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={entry.path}
                  type="button"
                  className={classNames}
                  onClick={() => handleFileSelect(entry)}
                  disabled={isBlocked || isNonMp4 || selectingPath === entry.path}
                  aria-pressed={isActive}
                  title={
                    isBlocked
                      ? `Bereits als „${entry.movie.title}“ hinzugefügt`
                      : isNonMp4 ? `${entry.path} – vor dem Hinzufügen in MP4 umwandeln` : entry.path
                  }
                >
                  <i>{isNonMp4 ? entry.name.split(".").pop().toUpperCase() : entry.movie ? "✓" : isActive ? "●" : "MP4"}</i>
                  <span>
                    <strong>{entry.name}</strong>
                    <small>
                      {entry.movie
                        ? `${entry.path} · Film: ${entry.movie.title}`
                        : entry.path}
                    </small>
                  </span>
                  <b>
                    {isNonMp4
                      ? entry.movie ? "Bereits vorhanden · Kein MP4" : "Kein MP4"
                      : isCurrentMovie
                      ? "Aktueller Film"
                      : entry.movie
                      ? "Bereits vorhanden"
                      : selectingPath === entry.path
                      ? "Wird geöffnet…"
                      : isActive
                      ? "Ausgewählt"
                      : "Auswählen"}
                  </b>
                </button>
              );
            })
          ) : (
            <div className={styles.empty}>
              <i>MP4</i>
              <span>
                {folderFiles.length ? "Keine passende Datei" : "NAS wartet"}
              </span>
            </div>
          )}
        </div>

        {folderFiles.length >= MAX_FOLDER_FILES ? (
          <p className={styles.limit}>
            Maximal {MAX_FOLDER_FILES.toLocaleString("de-DE")} Dateien geladen.
          </p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      <p className={styles.hint}>
        Am besten den übergeordneten Ordner auswählen, der alle Darstellerordner
        enthält.
      </p>
    </section>
  );
}
