import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { ScannerError } from "./security.mjs";

function relativeMediaPath(rootPath, filePath) {
  return relative(rootPath, filePath).split(sep).join("/");
}

function lowercase(value) {
  return String(value || "").toLocaleLowerCase("de");
}

function publicSnapshot(snapshot, cached) {
  return {
    ...snapshot,
    cached,
    source: "nas-scanner",
  };
}

export class NasLibraryScanner {
  constructor(config) {
    this.config = config;
    this.scanPromise = null;
  }

  async readSavedSnapshot() {
    try {
      const raw = await readFile(this.config.dataPath, "utf8");
      const snapshot = JSON.parse(raw);
      if (!snapshot || !Array.isArray(snapshot.files) || !snapshot.scanned_at) {
        return null;
      }
      return publicSnapshot(snapshot, true);
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "snapshot_read_failed",
          code: error?.code || "UNKNOWN",
        })
      );
      return null;
    }
  }

  async inventory({ refresh = false } = {}) {
    if (!refresh) {
      const saved = await this.readSavedSnapshot();
      if (saved) return saved;
    }

    if (!this.scanPromise) {
      this.scanPromise = this.#scan().finally(() => {
        this.scanPromise = null;
      });
    }
    return this.scanPromise;
  }

  async #scan() {
    const startedAt = Date.now();
    const rootStat = await stat(this.config.libraryPath).catch((error) => {
      throw new ScannerError(
        `Der NAS-Hauptordner ist nicht lesbar (${error?.code || "unbekannter Fehler"}).`,
        "LIBRARY_UNREADABLE",
        503
      );
    });

    if (!rootStat.isDirectory()) {
      throw new ScannerError(
        "Der konfigurierte NAS-Pfad ist kein Ordner.",
        "LIBRARY_NOT_DIRECTORY",
        503
      );
    }

    const files = [];
    const ignoredDirectories = this.config.ignoredDirectories;
    const extensions = this.config.videoExtensions;

    const walk = async (directoryPath, depth) => {
      if (depth > this.config.maxDepth) {
        throw new ScannerError(
          `Maximale Ordnertiefe von ${this.config.maxDepth} überschritten.`,
          "MAX_DEPTH_EXCEEDED",
          422
        );
      }

      const entries = await readdir(directoryPath, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name, "de"));

      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const fullPath = join(directoryPath, entry.name);

        if (entry.isDirectory()) {
          if (ignoredDirectories.has(lowercase(entry.name))) continue;
          await walk(fullPath, depth + 1);
          continue;
        }

        if (!entry.isFile()) continue;
        const extension = extname(entry.name).slice(1).toLocaleLowerCase("de");
        if (!extensions.has(extension)) continue;

        if (files.length >= this.config.maxFiles) {
          throw new ScannerError(
            `Mehr als ${this.config.maxFiles} Videodateien gefunden. Sicherheitslimit anheben.`,
            "MAX_FILES_EXCEEDED",
            422
          );
        }

        const fileStat = await stat(fullPath);
        files.push({
          path: relativeMediaPath(this.config.libraryPath, fullPath),
          name: entry.name,
          extension,
          size: fileStat.size,
          modified_at: fileStat.mtime.toISOString(),
        });
      }
    };

    await walk(this.config.libraryPath, 0);
    const snapshot = {
      schema_version: 1,
      root_name: this.config.libraryName,
      scanned_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      total_files: files.length,
      total_bytes: files.reduce((sum, file) => sum + file.size, 0),
      video_extensions: [...extensions].sort(),
      files,
    };

    const temporaryPath = `${this.config.dataPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(snapshot), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.config.dataPath);

    console.log(
      JSON.stringify({
        level: "info",
        event: "library_scan_completed",
        files: snapshot.total_files,
        bytes: snapshot.total_bytes,
        duration_ms: snapshot.duration_ms,
      })
    );

    return publicSnapshot(snapshot, false);
  }
}
