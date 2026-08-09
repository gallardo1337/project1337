function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizedName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeLibraryPath(value, rootName = "1337") {
  let raw = String(value || "").trim();
  if (!raw) return "";

  try {
    raw = new URL(raw).pathname;
  } catch {
    raw = raw.split(/[?#]/)[0];
  }

  const parts = raw
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => safeDecode(part).normalize("NFC"))
    .filter((part) => part !== "." && part !== "..");

  const normalizedRoot = normalizedName(rootName);
  if (
    parts.length > 1 &&
    (normalizedName(parts[0]) === normalizedRoot ||
      normalizedName(parts[0]) === "1337")
  ) {
    parts.shift();
  }

  return parts.join("/");
}

function pathKey(value, rootName) {
  return normalizeLibraryPath(value, rootName).toLocaleLowerCase("de");
}

function basenameKey(value, rootName) {
  const path = normalizeLibraryPath(value, rootName);
  return (path.split("/").pop() || "").toLocaleLowerCase("de");
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function percentage(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function fileExtension(file) {
  const explicit = String(file?.extension || "").replace(/^\./, "").trim();
  if (explicit) return explicit.toLocaleLowerCase("de");
  const match = String(file?.name || file?.path || "").match(/\.([^.\/]+)$/);
  return match ? match[1].toLocaleLowerCase("de") : "unbekannt";
}

function fileFolder(path) {
  const parts = String(path || "").split("/").filter(Boolean);
  return parts.length > 1 ? parts[0] : "Ohne Darstellerordner";
}

function inferFolderQuality(path) {
  const parts = String(path || "")
    .split("/")
    .slice(0, -1)
    .map(normalizedName);

  if (parts.some((part) => /^(4k|uhd|2160p)$/.test(part))) return "4K";
  if (parts.some((part) => /^(fullhd|full hd|fhd|1080p)$/.test(part))) {
    return "FullHD";
  }
  if (parts.some((part) => part === "retro")) return "Retro";
  return "Nicht aus Ordner ableitbar";
}

function sortBreakdown(object) {
  return Object.entries(object)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "de"));
}

function publicMovie(movie, actorMap, resolutionMap, status, relativePath) {
  const actorNames = (Array.isArray(movie.main_actor_ids)
    ? movie.main_actor_ids
    : []
  )
    .map((id) => actorMap.get(String(id))?.name)
    .filter(Boolean);

  return {
    id: movie.id,
    title: movie.title || "Ohne Titel",
    file_url: movie.file_url || "",
    relative_path: relativePath,
    resolution:
      resolutionMap.get(String(movie.resolution_id))?.name || "Ohne Qualität",
    main_actors: actorNames,
    status,
  };
}

function compactFile(file, rootName) {
  const relativePath = normalizeLibraryPath(file?.path || file?.name, rootName);
  const name = String(file?.name || relativePath.split("/").pop() || "Unbenannt");
  return {
    path: relativePath,
    name,
    extension: fileExtension({ ...file, name }),
    size: numberValue(file?.size),
    modified_at: file?.modified_at || null,
    folder: fileFolder(relativePath),
    inferred_quality: inferFolderQuality(relativePath),
  };
}

export function analyzeNasLibrary({ inventory, movies, actors, resolutions }) {
  const rootName = String(inventory?.root_name || "1337");
  const files = (Array.isArray(inventory?.files) ? inventory.files : [])
    .map((file) => compactFile(file, rootName))
    .filter((file) => file.path);
  const databaseMovies = Array.isArray(movies) ? movies : [];
  const mainActors = Array.isArray(actors) ? actors : [];
  const resolutionRows = Array.isArray(resolutions) ? resolutions : [];

  const actorMap = new Map(mainActors.map((actor) => [String(actor.id), actor]));
  const actorsByName = new Map(
    mainActors.map((actor) => [normalizedName(actor.name), actor])
  );
  const resolutionMap = new Map(
    resolutionRows.map((resolution) => [String(resolution.id), resolution])
  );

  const nasByPath = new Map();
  const nasByBasename = new Map();
  files.forEach((file, index) => {
    const exactKey = pathKey(file.path, rootName);
    const nameKey = basenameKey(file.path, rootName);
    if (!nasByPath.has(exactKey)) nasByPath.set(exactKey, []);
    nasByPath.get(exactKey).push(index);
    if (!nasByBasename.has(nameKey)) nasByBasename.set(nameKey, []);
    nasByBasename.get(nameKey).push(index);
  });

  const movieRows = databaseMovies.map((movie) => {
    const relativePath = normalizeLibraryPath(movie.file_url, rootName);
    return {
      movie,
      relativePath,
      exactKey: pathKey(movie.file_url, rootName),
      nameKey: basenameKey(movie.file_url, rootName),
      status: "missing",
      fileIndex: null,
    };
  });

  const moviesByPath = new Map();
  const moviesByBasename = new Map();
  movieRows.forEach((row, index) => {
    if (row.exactKey) {
      if (!moviesByPath.has(row.exactKey)) moviesByPath.set(row.exactKey, []);
      moviesByPath.get(row.exactKey).push(index);
    }
    if (row.nameKey) {
      if (!moviesByBasename.has(row.nameKey)) moviesByBasename.set(row.nameKey, []);
      moviesByBasename.get(row.nameKey).push(index);
    }
  });

  const fileMatches = files.map(() => ({ status: "missing", movieIndexes: [] }));

  moviesByPath.forEach((matchingMovies, exactKey) => {
    const matchingFiles = nasByPath.get(exactKey) || [];
    if (!matchingFiles.length) return;

    matchingMovies.forEach((movieIndex) => {
      movieRows[movieIndex].status = "exact";
      movieRows[movieIndex].fileIndex = matchingFiles[0];
    });
    matchingFiles.forEach((fileIndex) => {
      fileMatches[fileIndex] = {
        status: "exact",
        movieIndexes: [...matchingMovies],
      };
    });
  });

  moviesByBasename.forEach((matchingMovies, nameKey) => {
    const matchingFiles = nasByBasename.get(nameKey) || [];
    const unmatchedMovies = matchingMovies.filter(
      (movieIndex) => movieRows[movieIndex].status === "missing"
    );
    const unmatchedFiles = matchingFiles.filter(
      (fileIndex) => fileMatches[fileIndex].status === "missing"
    );

    if (unmatchedMovies.length !== 1 || unmatchedFiles.length !== 1) return;
    const movieIndex = unmatchedMovies[0];
    const fileIndex = unmatchedFiles[0];
    movieRows[movieIndex].status = "probable";
    movieRows[movieIndex].fileIndex = fileIndex;
    fileMatches[fileIndex] = { status: "probable", movieIndexes: [movieIndex] };
  });

  const reportFiles = files.map((file, index) => {
    const match = fileMatches[index];
    const matchedMovies = match.movieIndexes.map((movieIndex) => {
      const row = movieRows[movieIndex];
      return publicMovie(
        row.movie,
        actorMap,
        resolutionMap,
        row.status,
        row.relativePath
      );
    });

    return {
      ...file,
      status: match.status,
      database_movies: matchedMovies,
      database_duplicate: matchedMovies.length > 1,
    };
  });

  const database = movieRows.map((row) =>
    publicMovie(
      row.movie,
      actorMap,
      resolutionMap,
      row.status,
      row.relativePath
    )
  );

  const formatMap = new Map();
  reportFiles.forEach((file) => {
    if (!formatMap.has(file.extension)) {
      formatMap.set(file.extension, {
        name: file.extension.toUpperCase(),
        extension: file.extension,
        files: 0,
        bytes: 0,
        exact: 0,
        probable: 0,
        missing: 0,
      });
    }
    const entry = formatMap.get(file.extension);
    entry.files += 1;
    entry.bytes += file.size;
    entry[file.status] += 1;
  });
  const formats = [...formatMap.values()].sort(
    (left, right) => right.files - left.files || left.name.localeCompare(right.name, "de")
  );

  const inferredQualityMap = new Map();
  reportFiles.forEach((file) => {
    if (!inferredQualityMap.has(file.inferred_quality)) {
      inferredQualityMap.set(file.inferred_quality, {
        name: file.inferred_quality,
        files: 0,
        bytes: 0,
        exact: 0,
      });
    }
    const entry = inferredQualityMap.get(file.inferred_quality);
    entry.files += 1;
    entry.bytes += file.size;
    if (file.status === "exact") entry.exact += 1;
  });

  const databaseQualityMap = new Map();
  database.forEach((movie) => {
    if (!databaseQualityMap.has(movie.resolution)) {
      databaseQualityMap.set(movie.resolution, {
        name: movie.resolution,
        database_movies: 0,
        exact: 0,
        probable: 0,
        missing: 0,
      });
    }
    const entry = databaseQualityMap.get(movie.resolution);
    entry.database_movies += 1;
    entry[movie.status] += 1;
  });

  const actorDatabaseCounts = new Map(mainActors.map((actor) => [String(actor.id), 0]));
  databaseMovies.forEach((movie) => {
    (Array.isArray(movie.main_actor_ids) ? movie.main_actor_ids : []).forEach((actorId) => {
      const id = String(actorId);
      actorDatabaseCounts.set(id, (actorDatabaseCounts.get(id) || 0) + 1);
    });
  });

  const performerMap = new Map();
  const rowForFile = (file) => {
    const actor = actorsByName.get(normalizedName(file.folder)) || null;
    const key = actor ? `actor:${actor.id}` : `folder:${normalizedName(file.folder)}`;
    if (!performerMap.has(key)) {
      performerMap.set(key, {
        key,
        actor_id: actor?.id || null,
        name: actor?.name || file.folder,
        folders: new Set(),
        nas_files: 0,
        nas_bytes: 0,
        exact: 0,
        probable: 0,
        missing: 0,
        database_movies: actor ? actorDatabaseCounts.get(String(actor.id)) || 0 : 0,
        formatCounts: {},
        qualityCounts: {},
      });
    }
    return performerMap.get(key);
  };

  reportFiles.forEach((file) => {
    const performer = rowForFile(file);
    performer.folders.add(file.folder);
    performer.nas_files += 1;
    performer.nas_bytes += file.size;
    performer[file.status] += 1;
    performer.formatCounts[file.extension.toUpperCase()] =
      (performer.formatCounts[file.extension.toUpperCase()] || 0) + 1;

    const quality =
      file.database_movies[0]?.resolution || file.inferred_quality;
    performer.qualityCounts[quality] =
      (performer.qualityCounts[quality] || 0) + 1;
  });

  mainActors.forEach((actor) => {
    const key = `actor:${actor.id}`;
    if (performerMap.has(key)) return;
    performerMap.set(key, {
      key,
      actor_id: actor.id,
      name: actor.name,
      folders: new Set(),
      nas_files: 0,
      nas_bytes: 0,
      exact: 0,
      probable: 0,
      missing: 0,
      database_movies: actorDatabaseCounts.get(String(actor.id)) || 0,
      formatCounts: {},
      qualityCounts: {},
    });
  });

  const performers = [...performerMap.values()]
    .map((performer) => ({
      key: performer.key,
      actor_id: performer.actor_id,
      name: performer.name,
      folders: [...performer.folders].sort((a, b) => a.localeCompare(b, "de")),
      nas_files: performer.nas_files,
      nas_bytes: performer.nas_bytes,
      exact: performer.exact,
      probable: performer.probable,
      missing: performer.missing,
      database_movies: performer.database_movies,
      coverage: percentage(performer.exact, performer.nas_files),
      formats: sortBreakdown(performer.formatCounts),
      qualities: sortBreakdown(performer.qualityCounts),
      folder_matched: Boolean(performer.actor_id),
    }))
    .sort(
      (left, right) =>
        right.nas_files - left.nas_files || left.name.localeCompare(right.name, "de")
    );

  const exactFiles = reportFiles.filter((file) => file.status === "exact").length;
  const probableFiles = reportFiles.filter((file) => file.status === "probable").length;
  const nasOnlyFiles = reportFiles.length - exactFiles - probableFiles;
  const exactDatabase = database.filter((movie) => movie.status === "exact").length;
  const probableDatabase = database.filter((movie) => movie.status === "probable").length;
  const missingDatabase = database.length - exactDatabase - probableDatabase;
  const mp4Files = reportFiles.filter((file) => file.extension === "mp4").length;

  return {
    schema_version: 1,
    scan: {
      root_name: rootName,
      scanned_at: inventory?.scanned_at || null,
      duration_ms: numberValue(inventory?.duration_ms),
      source: inventory?.source || "nas-scanner",
      cached: Boolean(inventory?.cached),
    },
    summary: {
      nas_files: reportFiles.length,
      nas_bytes: reportFiles.reduce((sum, file) => sum + file.size, 0),
      database_movies: database.length,
      exact_files: exactFiles,
      probable_files: probableFiles,
      nas_only_files: nasOnlyFiles,
      database_exact: exactDatabase,
      database_probable: probableDatabase,
      database_missing: missingDatabase,
      coverage: percentage(exactFiles, reportFiles.length),
      mp4_files: mp4Files,
      non_mp4_files: reportFiles.length - mp4Files,
      conversion_progress: percentage(mp4Files, reportFiles.length),
      unmatched_folders: performers.filter(
        (performer) => performer.nas_files > 0 && !performer.folder_matched
      ).length,
      duplicate_database_paths: reportFiles.filter(
        (file) => file.database_duplicate
      ).length,
    },
    formats,
    qualities: {
      database: [...databaseQualityMap.values()].sort(
        (left, right) =>
          right.database_movies - left.database_movies ||
          left.name.localeCompare(right.name, "de")
      ),
      inferred_nas: [...inferredQualityMap.values()].sort(
        (left, right) => right.files - left.files || left.name.localeCompare(right.name, "de")
      ),
    },
    performers,
    files: reportFiles.sort((left, right) => left.path.localeCompare(right.path, "de")),
    database_gaps: database
      .filter((movie) => movie.status !== "exact")
      .sort((left, right) => left.title.localeCompare(right.title, "de")),
  };
}

export const nasLibraryInternals = {
  basenameKey,
  inferFolderQuality,
  normalizedName,
  pathKey,
};
