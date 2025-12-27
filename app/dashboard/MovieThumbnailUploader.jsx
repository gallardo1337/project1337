"use client";

import { useRef, useState } from "react";

export default function MovieThumbnailUploader({
  onUploaded,
  label = "Bild auswählen",
  accept = "image/*",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);

  const pickFile = () => inputRef.current?.click();

  const uploadFile = async (file) => {
    if (!file) return;

    setErr(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Wichtig: Das ist dieselbe Upload-Route wie bei deinem ActorImageUploader.
      // Wenn dein upload.php einen anderen Pfad hat, hier anpassen.
      const res = await fetch("/upload.php", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload fehlgeschlagen.");
      }

      const data = await res.json();

      // Erwartet: { url: "https://..." } oder ähnlich.
      // Falls dein upload.php anders antwortet (z.B. { success: true, fileUrl: ... }),
      // dann hier die Property anpassen.
      const url = data?.url || data?.fileUrl || data?.file_url;

      if (!url) {
        throw new Error("Upload OK, aber keine URL zurückbekommen.");
      }

      onUploaded?.(url);
    } catch (e) {
      setErr(e?.message || "Fehler beim Upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-neutral-700 bg-neutral-950/60 p-3">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => uploadFile(e.target.files?.[0])}
      />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={pickFile}
          disabled={uploading}
          className={
            "rounded-lg px-3 py-2 text-sm font-semibold transition-all " +
            (uploading
              ? "bg-red-500/50 text-black/80 cursor-default"
              : "bg-red-500 text-black hover:bg-red-400 hover:shadow-md hover:shadow-red-900/60")
          }
        >
          {uploading ? "Upload…" : label}
        </button>

        <div className="text-xs text-neutral-500">
          Kein Crop – Original wird 1:1 hochgeladen.
        </div>
      </div>

      {err ? <div className="mt-2 text-xs text-red-400">{err}</div> : null}
    </div>
  );
}
