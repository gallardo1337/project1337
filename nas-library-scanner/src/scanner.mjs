import {
  readdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { ScannerError } from "./security.mjs";

const SKIPPABLE_ENTRY_ERRORS = new Set(["EACCES", "EPERM", "ENOENT", "ESTALE"]);

function relativeMediaPath(rootPath, filePath) {
  return relative(rootPath, filePath).split(sep).join("/");
}

function lowercase(value) {
  return String(value || "").toLocaleLowerCase("de");
}

function filesystemErrorCode(error) {
  return String(error?.code || error?.cause?.code || "UNKNOWN");
}

function logFilesystemWarning(event, error) {
  console.warn(
    JSON.stringify({
      level: "warn",
      event,
      code: filesystemErrorCode(error),
    })
  );
}

function publicSnapshot(snapshot, cached) {
  return {
    ...snapshot,
    cached,
    source: "nas-scanner",
  };
}

function snapshotTime(snapshot) {
  const value = Date.parse(snapshot?.scanned_at || "");
  return Number.isFinite(value) ? value : 0;
}

export class NasLibraryScanner {
  constructor(config) {
    this.config = config;
    this.scanPromise = null;
    this.lastSnapshot = null;
  }

  async readSavedSnapshot() {
    try {
      const raw = await readFile(this.config.dataPath, "utf8");
      const snapshot = JSON.parse(raw);
      if (!snapshot || !Array.isArray(snapshot.files) || !snapshot.scanned_at) {
        return null;
      }

      if (!this.lastSnapshot || snapshotTime(snapshot) >= snapshotTime(this.lastSnapshot)) {
        this.lastSnapshot = snapshot;
      }

      return publicSnapshot(this.lastSnapshot, true);
    } catch (error) {
      if (error?.code === "ENOENT") {
        return this.lastSnapshot ? publicSnapshot(this.lastSnapshot, true) : null;
      }
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "snapshot_read_failed",
          code: filesystemErrorCode(error),
        })
      );
      return this.lastSnapshot ? publicSnapshot(this.lastSnapshot, true) : null;
    }
  }

  async inventory({ refresh = false } = {}) {
    if (!refresh) {
      if (this.lastSnapshot) return publicSnapshot(this.lastSnapshot, true);
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
        `Der NAS-Hauptordner ist nicht lesbar (${filesystemErrorCode(error)}).`,
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
    let skippedEntries = 0;

    const walk = async (directoryPath, depth) => {
      if (depth > this.config.maxDepth) {
        throw new ScannerError(
          `Maximale Ordnertiefe von ${this.config.maxDepth} überschritten.`,
          "MAX_DEPTH_EXCEEDED",
          422
        );
      }

      let entries;
      try {
        entries = await readdir(directoryPath, { withFileTypes: true });
      } catch (error) {
        const code = filesystemErrorCode(error);
        if (depth > 0 && SKIPPABLE_ENTRY_ERRORS.has(code)) {
          skippedEntries += 1;
          logFilesystemWarning("directory_skipped", error);
          return;
        }
        throw new ScannerError(
          `Ein NAS-Ordner konnte nicht gelesen werden (${code}).`,
          "DIRECTORY_READ_FAILED",
          503
        );
      }

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

        let fileStat;
        try {
          fileStat = await stat(fullPath);
        } catch (error) {
          const code = filesystemErrorCode(error);
          if (SKIPPABLE_ENTRY_ERRORS.has(code)) {
            skippedEntries += 1;
            logFilesystemWarning("file_skipped", error);
            continue;
          }
          throw new ScannerError(
            `Eine Videodatei konnte nicht geprüft werden (${code}).`,
            "FILE_STAT_FAILED",
            503
          );
        }

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
      skipped_entries: skippedEntries,
      video_extensions: [...extensions].sort(),
      files,
    };

    this.lastSnapshot = snapshot;

    const temporaryPath = `${this.config.dataPath}.${process.pid}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(snapshot), {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.config.dataPath);
    } catch (error) {
      logFilesystemWarning("snapshot_write_failed", error);
      await unlink(temporaryPath).catch(() => {});
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "library_scan_completed",
        files: snapshot.total_files,
        bytes: snapshot.total_bytes,
        skipped_entries: snapshot.skipped_entries,
        duration_ms: snapshot.duration_ms,
      })
    );

    return publicSnapshot(snapshot, false);
  }
}
