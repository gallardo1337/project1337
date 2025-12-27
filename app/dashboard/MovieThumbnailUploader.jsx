"use client";

import { useState } from "react";

const UPLOAD_URL = process.env.NEXT_PUBLIC_MOVIE_UPLOAD_URL;

/**
 * MovieThumbnailUploader
 * - KEIN Crop
 * - direkter Upload der Originaldatei
 * - Preview bleibt 16:9 (object-fit: contain), also NICHT geschnitten
 *
 * Props:
 *  onUploaded(url: string) – wird aufgerufen, wenn Upload fertig ist
 */
export default function MovieThumbnailUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!UPLOAD_URL) {
      alert("UPLOAD_URL ist nicht gesetzt (NEXT_PUBLIC_HOSTINGER_UPLOAD_URL).");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();

      // WICHTIG:
      // ActorImageUploader nutzt "image" als Key – wir bleiben kompatibel.
      // Wenn dein upload.php stattdessen "file" erwartet, ändere hier auf "file".
      const filename = `movie_thumb_${Date.now()}_${file.name}`;
      formData.append("image", file, filename);

      const res = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error(txt);
        throw new Error(`Upload fehlgeschlagen (HTTP ${res.status})`);
      }

      const data = await res.json().catch(() => null);
      if (!data?.url) {
        console.error(data);
        throw new Error("Upload-Response ohne URL");
      }

      setPreviewUrl(data.url);
      onUploaded && onUploaded(data.url);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Fehler beim Upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Movie-Thumbnail hochladen (16:9, ohne Crop)
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="block w-full text-sm"
        />
      </div>

      {uploading && (
        <div className="text-sm text-neutral-400">Upload läuft…</div>
      )}

      {error && <div className="text-sm text-red-500">{error}</div>}

      {previewUrl && (
        <div className="mt-2">
          {/* 16:9 Preview – NICHT schneiden */}
          <div className="relative w-full max-w-xl overflow-hidden rounded-lg border bg-black">
            <div style={{ paddingTop: "56.25%" }} />
            <img
              src={previewUrl}
              alt="Movie Thumbnail"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>

          <p className="mt-2 text-xs break-all text-neutral-500">
            {previewUrl}
          </p>
        </div>
      )}
    </div>
  );
}
