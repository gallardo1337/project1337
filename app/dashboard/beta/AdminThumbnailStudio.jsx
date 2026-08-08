"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const UPLOAD_URL = process.env.NEXT_PUBLIC_MOVIE_UPLOAD_URL;
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const ANALYSIS_WIDTH = 192;
const ANALYSIS_HEIGHT = 108;
const SAMPLES_PER_BAND = 5;
const SUGGESTION_COUNT = 6;
const CHAPTER_POINTS = [0.12, 0.26, 0.4, 0.54, 0.68, 0.82];
const SUGGESTION_BANDS = [
  [0.07, 0.18],
  [0.2, 0.32],
  [0.34, 0.46],
  [0.48, 0.6],
  [0.62, 0.74],
  [0.76, 0.9],
];

function createAnalysisPoints() {
  return SUGGESTION_BANDS.flatMap(([start, end], bandIndex) => {
    const sliceSize = (end - start) / SAMPLES_PER_BAND;

    return Array.from({ length: SAMPLES_PER_BAND }, (_, sampleIndex) => ({
      bandIndex,
      point:
        start +
        sliceSize * (sampleIndex + 0.16 + Math.random() * 0.68),
    }));
  });
}

function waitForFramePaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function createDifferenceHash(luminance, width, height) {
  const hash = [];

  for (let row = 0; row < 8; row += 1) {
    const y = Math.min(height - 1, Math.floor(((row + 0.5) * height) / 8));

    for (let column = 0; column < 8; column += 1) {
      const leftX = Math.min(
        width - 1,
        Math.floor(((column + 0.5) * width) / 9)
      );
      const rightX = Math.min(
        width - 1,
        Math.floor(((column + 1.5) * width) / 9)
      );
      hash.push(
        luminance[y * width + leftX] > luminance[y * width + rightX]
      );
    }
  }

  return hash;
}

function hashDistance(left, right) {
  if (!left?.length || left.length !== right?.length) return 1;

  let differences = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) differences += 1;
  }
  return differences / left.length;
}

function analyzeVideoFrame(video, canvas, focusX, focusY) {
  const ctx = canvas.getContext("2d", {
    alpha: false,
    willReadFrequently: true,
  });
  if (!ctx) throw new Error("Die Bildanalyse konnte nicht gestartet werden.");

  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCover(ctx, video, canvas.width, canvas.height, focusX, focusY);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const pixelCount = canvas.width * canvas.height;
  const luminance = new Float32Array(pixelCount);
  let luminanceTotal = 0;
  let luminanceSquareTotal = 0;
  let colorTotal = 0;
  let darkPixels = 0;
  let brightPixels = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const red = pixels[dataIndex];
    const green = pixels[dataIndex + 1];
    const blue = pixels[dataIndex + 2];
    const value = red * 0.2126 + green * 0.7152 + blue * 0.0722;

    luminance[pixelIndex] = value;
    luminanceTotal += value;
    luminanceSquareTotal += value * value;
    colorTotal += Math.max(red, green, blue) - Math.min(red, green, blue);
    if (value < 22) darkPixels += 1;
    if (value > 242) brightPixels += 1;
  }

  const mean = luminanceTotal / pixelCount;
  const variance = Math.max(
    0,
    luminanceSquareTotal / pixelCount - mean * mean
  );
  const contrast = Math.sqrt(variance);
  let detailSquareTotal = 0;
  let centerDetailSquareTotal = 0;
  let detailCount = 0;
  let centerDetailCount = 0;

  for (let y = 1; y < canvas.height - 1; y += 1) {
    for (let x = 1; x < canvas.width - 1; x += 1) {
      const index = y * canvas.width + x;
      const laplacian =
        luminance[index] * 4 -
        luminance[index - 1] -
        luminance[index + 1] -
        luminance[index - canvas.width] -
        luminance[index + canvas.width];
      const detailSquare = laplacian * laplacian;

      detailSquareTotal += detailSquare;
      detailCount += 1;

      if (
        x > canvas.width * 0.2 &&
        x < canvas.width * 0.8 &&
        y > canvas.height * 0.18 &&
        y < canvas.height * 0.82
      ) {
        centerDetailSquareTotal += detailSquare;
        centerDetailCount += 1;
      }
    }
  }

  const detail = Math.sqrt(detailSquareTotal / Math.max(1, detailCount));
  const centerDetail = Math.sqrt(
    centerDetailSquareTotal / Math.max(1, centerDetailCount)
  );
  const darkRatio = darkPixels / pixelCount;
  const brightRatio = brightPixels / pixelCount;
  const exposureScore = Math.max(0, 1 - Math.abs(mean - 126) / 112);
  const contrastScore = Math.min(1, contrast / 68);
  const detailScore = Math.min(1, detail / 62);
  const colorScore = Math.min(1, colorTotal / pixelCount / 82);
  const centerScore = Math.min(1, centerDetail / Math.max(1, detail) / 1.25);
  let score =
    detailScore * 0.4 +
    contrastScore * 0.24 +
    exposureScore * 0.2 +
    colorScore * 0.08 +
    centerScore * 0.08;

  if (darkRatio > 0.45) score -= (darkRatio - 0.45) * 1.45;
  if (brightRatio > 0.34) score -= (brightRatio - 0.34) * 0.9;
  if (mean < 25 || mean > 232) score -= 0.5;
  if (contrast < 14) score -= 0.28;

  return {
    score,
    hash: createDifferenceHash(luminance, canvas.width, canvas.height),
  };
}

function chooseBestFrames(analyses) {
  const ranked = [...analyses].sort((left, right) => right.score - left.score);
  const selected = [];
  const passes = [
    { minimumDistance: 0.07, minimumHashDistance: 0.14 },
    { minimumDistance: 0.05, minimumHashDistance: 0.1 },
    { minimumDistance: 0.035, minimumHashDistance: 0.06 },
    { minimumDistance: 0, minimumHashDistance: 0 },
  ];

  for (const pass of passes) {
    for (const analysis of ranked) {
      if (selected.includes(analysis)) continue;

      const isDifferentEnough = selected.every(
        (current) =>
          Math.abs(current.point - analysis.point) >= pass.minimumDistance &&
          hashDistance(current.hash, analysis.hash) >= pass.minimumHashDistance
      );

      if (isDifferentEnough) selected.push(analysis);
      if (selected.length === SUGGESTION_COUNT) {
        return selected.sort((left, right) => left.point - right.point);
      }
    }
  }

  return selected.sort((left, right) => left.point - right.point);
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainder
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function safeFilename(value) {
  return String(value || "film")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "film";
}

function waitForSeek(video, target) {
  const safeTarget = Math.max(
    0,
    Math.min(target, Math.max(0, (video.duration || 0) - 0.05))
  );

  if (Math.abs(video.currentTime - safeTarget) < 0.04) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Die Videoposition konnte nicht geladen werden."));
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    const handleSeeked = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Das Video konnte nicht gelesen werden."));
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = safeTarget;
  });
}

function drawCover(ctx, video, width, height, focusX = 50, focusY = 50) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  const outputAspect = width / height;
  const sourceAspect = sourceWidth / sourceHeight;

  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceAspect > outputAspect) {
    cropWidth = sourceHeight * outputAspect;
    sourceX = (sourceWidth - cropWidth) * (focusX / 100);
  } else if (sourceAspect < outputAspect) {
    cropHeight = sourceWidth / outputAspect;
    sourceY = (sourceHeight - cropHeight) * (focusY / 100);
  }

  ctx.drawImage(
    video,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height
  );
}

function drawSmartFit(ctx, video, width, height) {
  ctx.save();
  ctx.filter = "blur(28px) brightness(0.42) saturate(0.82)";
  drawCover(ctx, video, width, height);
  ctx.restore();

  ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.min(
    width / video.videoWidth,
    height / video.videoHeight
  );
  const drawWidth = video.videoWidth * scale;
  const drawHeight = video.videoHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 34;
  ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function frameToBlob(video, mode, focusX, focusY) {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Das Video hat noch kein lesbares Bild geliefert.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Der Browser konnte kein Bild erzeugen.");

  ctx.fillStyle = "#050506";
  ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  if (mode === "smart") {
    drawSmartFit(ctx, video, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  } else {
    drawCover(
      ctx,
      video,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
      focusX,
      focusY
    );
  }

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Der erfasste Frame ist leer."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    } catch (error) {
      reject(error);
    }
  });
}

export default function AdminThumbnailStudio({
  movies,
  studioMap,
  resolutionMap,
  onThumbnailSaved,
  onEditMovie,
  onUnauthorized,
}) {
  const videoRef = useRef(null);
  const generatedUrlsRef = useRef(new Set());
  const localSourceRef = useRef(null);

  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [localSource, setLocalSource] = useState(null);
  const [remoteAccess, setRemoteAccess] = useState("idle");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(null);
  const [mode, setMode] = useState("crop");
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [previewCandidateId, setPreviewCandidateId] = useState(null);
  const [generating, setGenerating] = useState({
    active: false,
    phase: "idle",
    done: 0,
    total: 0,
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const sortedMovies = useMemo(
    () =>
      [...movies].sort((left, right) =>
        String(left.title || "").localeCompare(String(right.title || ""), "de", {
          sensitivity: "base",
        })
      ),
    [movies]
  );

  const visibleMovies = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");

    return sortedMovies.filter((movie) => {
      if (onlyMissing && movie.thumbnail_url) return false;
      if (!query) return true;

      const haystack = `${movie.title || ""} ${
        studioMap[movie.studio_id]?.name || ""
      } ${resolutionMap[movie.resolution_id]?.name || ""}`.toLocaleLowerCase(
        "de"
      );
      return haystack.includes(query);
    });
  }, [sortedMovies, search, onlyMissing, studioMap, resolutionMap]);

  const selectedMovie = useMemo(
    () => movies.find((movie) => movie.id === selectedMovieId) || null,
    [movies, selectedMovieId]
  );

  const selectedCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === selectedCandidateId) ||
      null,
    [candidates, selectedCandidateId]
  );

  const previewCandidate = useMemo(
    () =>
      candidates.find((candidate) => candidate.id === previewCandidateId) ||
      null,
    [candidates, previewCandidateId]
  );

  const previewCandidateNumber = previewCandidate
    ? candidates.findIndex((candidate) => candidate.id === previewCandidate.id) + 1
    : 0;

  const resetCandidates = () => {
    generatedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    generatedUrlsRef.current.clear();
    setCandidates([]);
    setSelectedCandidateId(null);
    setPreviewCandidateId(null);
  };

  const clearLocalSource = () => {
    if (localSourceRef.current) {
      URL.revokeObjectURL(localSourceRef.current.url);
      localSourceRef.current = null;
    }
    setLocalSource(null);
  };

  useEffect(() => {
    if (selectedMovieId && movies.some((movie) => movie.id === selectedMovieId)) {
      return;
    }

    const preferred = movies.find((movie) => !movie.thumbnail_url) || movies[0];
    setSelectedMovieId(preferred?.id || null);
  }, [movies, selectedMovieId]);

  useEffect(() => {
    clearLocalSource();
    resetCandidates();
    setDuration(0);
    setCurrentTime(0);
    setVideoReady(false);
    setVideoError(null);
    setNotice(null);
    setError(null);
  }, [selectedMovieId]);

  useEffect(() => {
    if (!selectedMovie?.file_url || localSource) {
      setRemoteAccess("idle");
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setRemoteAccess("checking");

    fetch(selectedMovie.file_url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.body) await response.body.cancel().catch(() => {});
        setRemoteAccess(response.ok ? "exportable" : "playback-only");
      })
      .catch(() => setRemoteAccess("playback-only"))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [selectedMovie?.id, selectedMovie?.file_url, localSource]);

  useEffect(
    () => () => {
      generatedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      if (localSourceRef.current) {
        URL.revokeObjectURL(localSourceRef.current.url);
      }
    },
    []
  );

  useEffect(() => {
    if (!previewCandidateId) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setPreviewCandidateId(null);
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      const currentIndex = candidates.findIndex(
        (candidate) => candidate.id === previewCandidateId
      );
      if (currentIndex < 0 || candidates.length < 2) return;

      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + candidates.length) % candidates.length;
      setPreviewCandidateId(candidates[nextIndex].id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [candidates, previewCandidateId]);

  const videoSource = localSource?.url || selectedMovie?.file_url || "";
  const canCapture = Boolean(
    videoReady && (localSource || remoteAccess === "exportable")
  );

  const handleMovieSelect = (movieId) => {
    if (generating.active || saving) return;
    setSelectedMovieId(movieId);
  };

  const handleLocalFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    clearLocalSource();
    resetCandidates();

    const url = URL.createObjectURL(file);
    const source = { file, url };
    localSourceRef.current = source;
    setLocalSource(source);
    setVideoReady(false);
    setVideoError(null);
    setError(null);
    setNotice(
      "Lokale Quelle aktiv. Nur der erzeugte JPEG-Frame wird hochgeladen – nicht das Video."
    );
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setCurrentTime(video.currentTime || 0);
    setVideoReady(Boolean(video.videoWidth && video.videoHeight));
    setVideoError(null);
  };

  const captureCurrentFrame = async ({ select = true } = {}) => {
    const video = videoRef.current;
    if (!video || !canCapture) {
      throw new Error(
        remoteAccess === "playback-only"
          ? "Der Videohost blockiert den Frame-Export. Bitte unten dieselbe MP4-Datei lokal auswählen."
          : "Das Video ist noch nicht bereit."
      );
    }

    try {
      const blob = await frameToBlob(video, mode, focusX, focusY);
      const url = URL.createObjectURL(blob);
      generatedUrlsRef.current.add(url);
      const candidate = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        blob,
        url,
        time: video.currentTime,
        mode,
      };

      setCandidates((current) => {
        const next = [...current, candidate];
        if (next.length <= 12) return next;

        const removed = next.shift();
        if (removed) {
          URL.revokeObjectURL(removed.url);
          generatedUrlsRef.current.delete(removed.url);
        }
        return next;
      });

      if (select) setSelectedCandidateId(candidate.id);
      return candidate;
    } catch (captureError) {
      if (
        captureError?.name === "SecurityError" ||
        /tainted|cross-origin|insecure/i.test(captureError?.message || "")
      ) {
        setRemoteAccess("playback-only");
        throw new Error(
          "Der Videohost erlaubt keinen Frame-Export. Wähle dieselbe MP4-Datei unten lokal aus."
        );
      }
      throw captureError;
    }
  };

  const handleSingleCapture = async () => {
    setError(null);
    setNotice(null);
    try {
      await captureCurrentFrame();
      setNotice("Frame erfasst. Du kannst ihn unten prüfen und auswählen.");
    } catch (captureError) {
      setError(captureError?.message || "Frame konnte nicht erfasst werden.");
    }
  };

  const generateSuggestions = async () => {
    const video = videoRef.current;
    if (!video || !duration || generating.active) return;

    setError(null);
    setNotice(null);
    const analysisPoints = createAnalysisPoints();
    setGenerating({
      active: true,
      phase: "analysis",
      done: 0,
      total: analysisPoints.length,
    });

    const originalTime = video.currentTime;
    const wasPaused = video.paused;
    video.pause();

    try {
      const analysisCanvas = document.createElement("canvas");
      analysisCanvas.width = ANALYSIS_WIDTH;
      analysisCanvas.height = ANALYSIS_HEIGHT;
      const analyses = [];

      for (let index = 0; index < analysisPoints.length; index += 1) {
        const analysisPoint = analysisPoints[index];
        await waitForSeek(video, duration * analysisPoint.point);
        await waitForFramePaint();
        const result = analyzeVideoFrame(
          video,
          analysisCanvas,
          focusX,
          focusY
        );
        analyses.push({ ...analysisPoint, ...result });
        setGenerating({
          active: true,
          phase: "analysis",
          done: index + 1,
          total: analysisPoints.length,
        });
      }

      const bestFrames = chooseBestFrames(analyses);
      if (bestFrames.length < SUGGESTION_COUNT) {
        throw new Error("Es konnten nicht genug unterschiedliche Frames gefunden werden.");
      }

      setGenerating({
        active: true,
        phase: "capture",
        done: 0,
        total: bestFrames.length,
      });
      let firstCandidate = null;

      for (let index = 0; index < bestFrames.length; index += 1) {
        await waitForSeek(video, duration * bestFrames[index].point);
        await waitForFramePaint();
        const candidate = await captureCurrentFrame({ select: false });
        if (!firstCandidate) firstCandidate = candidate;
        setGenerating({
          active: true,
          phase: "capture",
          done: index + 1,
          total: bestFrames.length,
        });
      }

      if (firstCandidate) setSelectedCandidateId(firstCandidate.id);
      setNotice(
        `${analysisPoints.length} Szenen geprüft: Die sechs stärksten, möglichst unterschiedlichen Frames sind fertig.`
      );
    } catch (generationError) {
      if (
        generationError?.name === "SecurityError" ||
        /tainted|cross-origin|insecure/i.test(generationError?.message || "")
      ) {
        setRemoteAccess("playback-only");
        setError(
          "Der Videohost erlaubt keine Bildanalyse. Wähle dieselbe MP4-Datei unten lokal aus."
        );
        return;
      }
      setError(
        generationError?.message || "Vorschläge konnten nicht erzeugt werden."
      );
    } finally {
      try {
        await waitForSeek(video, originalTime);
        if (!wasPaused) await video.play().catch(() => {});
      } catch {
        // Die Vorschläge bleiben auch dann nutzbar, wenn das Zurückspringen scheitert.
      }
      setGenerating({ active: false, phase: "idle", done: 0, total: 0 });
    }
  };

  const stepPreview = (direction) => {
    if (!previewCandidate || candidates.length < 2) return;
    const currentIndex = candidates.findIndex(
      (candidate) => candidate.id === previewCandidate.id
    );
    const nextIndex =
      (currentIndex + direction + candidates.length) % candidates.length;
    setPreviewCandidateId(candidates[nextIndex].id);
  };

  const seekBy = (seconds) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const seekToPercent = (percent) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = duration * percent;
  };

  const saveThumbnail = async () => {
    if (!selectedMovie || !selectedCandidate || saving) return;

    if (!UPLOAD_URL) {
      setError("NEXT_PUBLIC_MOVIE_UPLOAD_URL ist für den Upload nicht gesetzt.");
      return;
    }

    if (selectedMovie.thumbnail_url) {
      const confirmed = window.confirm(
        `Das aktuelle Thumbnail von „${selectedMovie.title}“ ersetzen?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const sessionResponse = await fetch("/api/login", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
      });
      const sessionPayload = await sessionResponse.json().catch(() => null);

      if (!sessionResponse.ok || !sessionPayload?.ok) {
        onUnauthorized?.();
        throw new Error(
          "Deine Admin-Sitzung ist abgelaufen. Bitte einmal neu einloggen."
        );
      }

      const formData = new FormData();
      const filename = `movie_thumb_${safeFilename(
        selectedMovie.title
      )}_${Date.now()}.jpg`;
      formData.append("image", selectedCandidate.blob, filename);

      const uploadResponse = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Bild-Upload fehlgeschlagen (HTTP ${uploadResponse.status}).`);
      }

      const uploadPayload = await uploadResponse.json().catch(() => null);
      if (!uploadPayload?.url) {
        throw new Error("Der Bild-Upload hat keine URL zurückgegeben.");
      }

      const saveResponse = await fetch(
        `/api/movies/${selectedMovie.id}/thumbnail`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thumbnail_url: uploadPayload.url }),
        }
      );
      const savePayload = await saveResponse.json().catch(() => null);

      if (!saveResponse.ok) {
        if (saveResponse.status === 401) onUnauthorized?.();
        throw new Error(
          savePayload?.error || "Thumbnail konnte dem Film nicht zugeordnet werden."
        );
      }

      onThumbnailSaved?.(selectedMovie.id, savePayload.thumbnail_url);
      setNotice(`Thumbnail für „${selectedMovie.title}“ wurde gespeichert.`);
    } catch (saveError) {
      setError(saveError?.message || "Thumbnail konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const generationCounter = generating.active
    ? `${generating.done}/${generating.total}`
    : "✦";
  const generationTitle = generating.active
    ? generating.phase === "analysis"
      ? "Filmszenen werden analysiert"
      : "Beste Frames werden erstellt"
    : candidates.length
      ? "6 weitere Vorschläge erzeugen"
      : "6 Vorschläge erzeugen";
  const generationActionLabel = generating.active
    ? generating.phase === "analysis"
      ? `${generating.done}/${generating.total} Szenen geprüft…`
      : `${generating.done}/${generating.total} Frames werden erstellt…`
    : "6 neue Vorschläge";

  return (
    <section className="thumbnailStudio">
      <div className="thumbnailStudio__intro">
        <div>
          <span>Workflow 01—04</span>
          <h2>Aus Video wird Cover.</h2>
          <p>
            Quelle wählen, Szene finden, Varianten vergleichen und den Favoriten
            direkt dem Film zuordnen.
          </p>
        </div>
        <div className="thumbnailStudio__specs" aria-label="Ausgabeformat">
          <span>JPEG</span>
          <strong>1280 × 720</strong>
          <small>16:9 · 90 % Qualität</small>
        </div>
      </div>

      <div className="thumbnailStudio__layout">
        <aside className="thumbnailStudio__library">
          <header>
            <div>
              <span>01</span>
              <h3>Film wählen</h3>
            </div>
            <small>{visibleMovies.length}</small>
          </header>

          <label className="thumbnailStudio__search">
            <span>⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filmtitel oder Studio"
            />
          </label>

          <label className="thumbnailStudio__toggle">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(event) => setOnlyMissing(event.target.checked)}
            />
            <span />
            Nur Filme ohne Thumbnail
          </label>

          <div className="thumbnailStudio__movieList">
            {visibleMovies.map((movie) => {
              const active = movie.id === selectedMovieId;
              return (
                <button
                  type="button"
                  key={movie.id}
                  className={active ? "is-active" : ""}
                  onClick={() => handleMovieSelect(movie.id)}
                  disabled={generating.active || saving}
                >
                  <span className="thumbnailStudio__movieCover">
                    {movie.thumbnail_url ? (
                      <img src={movie.thumbnail_url} alt="" loading="lazy" />
                    ) : (
                      <b>＋</b>
                    )}
                  </span>
                  <span>
                    <strong>{movie.title || "Ohne Titel"}</strong>
                    <small>
                      {movie.year || "—"} · {resolutionMap[movie.resolution_id]?.name || "Ohne Qualität"}
                    </small>
                  </span>
                  <i>{active ? "→" : ""}</i>
                </button>
              );
            })}

            {!visibleMovies.length ? (
              <div className="thumbnailStudio__listEmpty">
                Keine passenden Filme gefunden.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="thumbnailStudio__workbench">
          {selectedMovie ? (
            <>
              <div className="thumbnailStudio__sourceHeader">
                <div>
                  <span>02 / Quelle &amp; Szene</span>
                  <h3>{selectedMovie.title}</h3>
                  <p>
                    {studioMap[selectedMovie.studio_id]?.name || "Ohne Studio"}
                    <i />
                    {selectedMovie.year || "Jahr unbekannt"}
                  </p>
                </div>
                <div className="thumbnailStudio__sourceState">
                  {localSource ? (
                    <span className="is-local">Lokale MP4</span>
                  ) : remoteAccess === "exportable" ? (
                    <span className="is-ready">Direkt erfassbar</span>
                  ) : remoteAccess === "checking" ? (
                    <span>Quelle wird geprüft</span>
                  ) : remoteAccess === "playback-only" ? (
                    <span className="is-warning">Nur Wiedergabe</span>
                  ) : (
                    <span>Keine Quelle</span>
                  )}
                </div>
              </div>

              <div className="thumbnailStudio__stage">
                {videoSource ? (
                  <video
                    key={`${selectedMovie.id}-${videoSource}-${remoteAccess}`}
                    ref={videoRef}
                    src={videoSource}
                    crossOrigin={
                      !localSource && remoteAccess === "exportable"
                        ? "anonymous"
                        : undefined
                    }
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={handleLoadedMetadata}
                    onCanPlay={() => setVideoReady(true)}
                    onTimeUpdate={(event) =>
                      setCurrentTime(event.currentTarget.currentTime || 0)
                    }
                    onError={() => {
                      setVideoReady(false);
                      setVideoError(
                        "Diese Videoquelle konnte im Browser nicht geladen werden."
                      );
                    }}
                  />
                ) : (
                  <div className="thumbnailStudio__noSource">
                    <strong>Kein Dateipfad hinterlegt</strong>
                    <span>Wähle unten eine lokale MP4-Datei als Quelle.</span>
                  </div>
                )}
                <div className="thumbnailStudio__timecode">
                  <strong>{formatTime(currentTime)}</strong>
                  <span>/ {formatTime(duration)}</span>
                </div>
              </div>

              <div className="thumbnailStudio__transport">
                <button type="button" onClick={() => seekBy(-10)} disabled={!videoReady}>−10s</button>
                <button type="button" onClick={() => seekBy(-1)} disabled={!videoReady}>−1s</button>
                <input
                  aria-label="Videoposition"
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.05"
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = Number(event.target.value);
                    }
                  }}
                  disabled={!videoReady}
                />
                <button type="button" onClick={() => seekBy(1)} disabled={!videoReady}>+1s</button>
                <button type="button" onClick={() => seekBy(10)} disabled={!videoReady}>+10s</button>
              </div>

              <div className="thumbnailStudio__chapters">
                {CHAPTER_POINTS.map((point) => (
                  <button
                    type="button"
                    key={point}
                    onClick={() => seekToPercent(point)}
                    disabled={!videoReady}
                  >
                    {Math.round(point * 100)}%
                  </button>
                ))}
              </div>

              {remoteAccess === "playback-only" && !localSource ? (
                <div className="thumbnailStudio__corsNotice">
                  <span>!</span>
                  <div>
                    <strong>Videohost schützt den Frame-Export</strong>
                    <p>
                      Du kannst das NAS-Video ansehen, aber der Browser darf daraus
                      noch kein JPEG bauen. Wähle dieselbe MP4 lokal – sie bleibt auf
                      deinem Gerät.
                    </p>
                  </div>
                </div>
              ) : null}

              {videoError ? (
                <div className="thumbnailStudio__message is-error">{videoError}</div>
              ) : null}

              <div className="thumbnailStudio__localSource">
                <div>
                  <strong>{localSource ? localSource.file.name : "Lokale Quelle verwenden"}</strong>
                  <span>
                    {localSource
                      ? "Video bleibt lokal · nur der JPEG-Frame wird hochgeladen"
                      : "Fallback bei blockiertem NAS-Export"}
                  </span>
                </div>
                <div>
                  {localSource ? (
                    <button type="button" onClick={clearLocalSource} disabled={generating.active || saving}>
                      NAS-Quelle
                    </button>
                  ) : null}
                  <label>
                    MP4 auswählen
                    <input type="file" accept="video/mp4,.mp4" onChange={handleLocalFile} />
                  </label>
                </div>
              </div>

              <div className="thumbnailStudio__renderSettings">
                <div>
                  <span>03 / Bildstil</span>
                  <h3>Ausgabe komponieren</h3>
                </div>
                <div className="thumbnailStudio__modeButtons">
                  <button
                    type="button"
                    className={mode === "crop" ? "is-active" : ""}
                    onClick={() => setMode("crop")}
                  >
                    <strong>Kino-Crop</strong>
                    <small>Flächig · 16:9</small>
                  </button>
                  <button
                    type="button"
                    className={mode === "smart" ? "is-active" : ""}
                    onClick={() => setMode("smart")}
                  >
                    <strong>Smart Fit</strong>
                    <small>Ganzes Bild · Blur</small>
                  </button>
                </div>
              </div>

              {mode === "crop" ? (
                <div className="thumbnailStudio__focusControls">
                  <label>
                    <span>Horizontaler Fokus</span>
                    <input type="range" min="0" max="100" value={focusX} onChange={(event) => setFocusX(Number(event.target.value))} />
                  </label>
                  <label>
                    <span>Vertikaler Fokus</span>
                    <input type="range" min="0" max="100" value={focusY} onChange={(event) => setFocusY(Number(event.target.value))} />
                  </label>
                </div>
              ) : null}

              <div className="thumbnailStudio__captureActions">
                <button
                  type="button"
                  className="thumbnailStudio__generate"
                  onClick={generateSuggestions}
                  disabled={!canCapture || generating.active || saving}
                >
                  <span>{generationCounter}</span>
                  <div>
                    <strong>{generationTitle}</strong>
                    <small>30 Szenen · Schärfe · Licht · Kontrast · Vielfalt</small>
                  </div>
                </button>
                <button
                  type="button"
                  className="thumbnailStudio__capture"
                  onClick={handleSingleCapture}
                  disabled={!canCapture || generating.active || saving}
                >
                  Aktuellen Frame erfassen
                </button>
              </div>

              {error ? <div className="thumbnailStudio__message is-error">{error}</div> : null}
              {notice ? <div className="thumbnailStudio__message is-success">{notice}</div> : null}

              <div className="thumbnailStudio__selectionHeader">
                <div>
                  <span>04 / Auswahl</span>
                  <h3>Favorit festlegen</h3>
                </div>
                {candidates.length ? (
                  <div className="thumbnailStudio__selectionActions">
                    <button
                      type="button"
                      className="thumbnailStudio__refreshCandidates"
                      onClick={generateSuggestions}
                      disabled={!canCapture || saving || generating.active}
                    >
                      {generationActionLabel}
                    </button>
                    <button
                      type="button"
                      onClick={resetCandidates}
                      disabled={saving || generating.active}
                    >
                      Auswahl leeren
                    </button>
                  </div>
                ) : null}
              </div>

              {candidates.length ? (
                <div className="thumbnailStudio__candidates">
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      className="thumbnailStudio__candidateCard"
                    >
                      <button
                        type="button"
                        className={`thumbnailStudio__candidateSelect${
                          candidate.id === selectedCandidateId ? " is-active" : ""
                        }`}
                        onClick={() => setSelectedCandidateId(candidate.id)}
                      >
                        <img src={candidate.url} alt={`Thumbnail-Vorschlag ${index + 1}`} />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <small>{formatTime(candidate.time)}</small>
                        <i>{candidate.id === selectedCandidateId ? "Ausgewählt" : "Wählen"}</i>
                      </button>
                      <button
                        type="button"
                        className="thumbnailStudio__candidateZoom"
                        onClick={() => setPreviewCandidateId(candidate.id)}
                        aria-label={`Thumbnail-Vorschlag ${index + 1} vergrößern`}
                        title="Groß ansehen"
                      >
                        ⛶
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="thumbnailStudio__candidateEmpty">
                  <span>✦</span>
                  <strong>Noch keine Frames erfasst</strong>
                  <small>Nutze die Automatik oder halte eine einzelne Szene fest.</small>
                </div>
              )}

              {selectedCandidate ? (
                <div className="thumbnailStudio__final">
                  <div className="thumbnailStudio__comparison">
                    <figure>
                      <figcaption>Aktuell</figcaption>
                      {selectedMovie.thumbnail_url ? (
                        <img src={selectedMovie.thumbnail_url} alt="Aktuelles Thumbnail" />
                      ) : (
                        <span>Kein Thumbnail</span>
                      )}
                    </figure>
                    <b>→</b>
                    <figure className="is-new">
                      <figcaption>Neu</figcaption>
                      <img src={selectedCandidate.url} alt="Neues Thumbnail" />
                    </figure>
                  </div>
                  <div className="thumbnailStudio__saveBar">
                    <div>
                      <span>Bereit zum Speichern</span>
                      <strong>{selectedMovie.title}</strong>
                      <small>Frame bei {formatTime(selectedCandidate.time)} · {selectedCandidate.mode === "smart" ? "Smart Fit" : "Kino-Crop"}</small>
                    </div>
                    <button type="button" onClick={saveThumbnail} disabled={saving}>
                      {saving
                        ? "Thumbnail wird gespeichert…"
                        : selectedMovie.thumbnail_url
                        ? "Thumbnail ersetzen"
                        : "Thumbnail speichern"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="thumbnailStudio__editLink">
                <span>Metadaten, Dateipfad oder bestehende URL ändern?</span>
                <button type="button" onClick={() => onEditMovie?.(selectedMovie)}>
                  Film im Editor öffnen →
                </button>
              </div>
            </>
          ) : (
            <div className="thumbnailStudio__empty">
              <strong>Kein Film ausgewählt</strong>
              <span>Wähle links einen Film aus dem Archiv.</span>
            </div>
          )}
        </div>
      </div>

      {previewCandidate ? (
        <div
          className="thumbnailStudio__lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="thumbnail-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewCandidateId(null);
            }
          }}
        >
          <div className="thumbnailStudio__lightboxPanel">
            <header>
              <div>
                <span>Detailansicht · {String(previewCandidateNumber).padStart(2, "0")}/{String(candidates.length).padStart(2, "0")}</span>
                <h3 id="thumbnail-preview-title">
                  {selectedMovie?.title || "Thumbnail-Vorschlag"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCandidateId(null)}
                aria-label="Detailansicht schließen"
              >
                ×
              </button>
            </header>

            <div className="thumbnailStudio__lightboxStage">
              {candidates.length > 1 ? (
                <button
                  type="button"
                  className="is-previous"
                  onClick={() => stepPreview(-1)}
                  aria-label="Vorherigen Vorschlag anzeigen"
                >
                  ←
                </button>
              ) : null}
              <img
                src={previewCandidate.url}
                alt={`Vergrößerter Thumbnail-Vorschlag ${previewCandidateNumber}`}
              />
              {candidates.length > 1 ? (
                <button
                  type="button"
                  className="is-next"
                  onClick={() => stepPreview(1)}
                  aria-label="Nächsten Vorschlag anzeigen"
                >
                  →
                </button>
              ) : null}
            </div>

            <footer>
              <div>
                <span>Frame bei {formatTime(previewCandidate.time)}</span>
                <small>Pfeiltasten wechseln · Esc schließt</small>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCandidateId(previewCandidate.id);
                  setPreviewCandidateId(null);
                }}
              >
                {previewCandidate.id === selectedCandidateId
                  ? "Bereits ausgewählt"
                  : "Diesen Frame auswählen"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </section>
  );
}
