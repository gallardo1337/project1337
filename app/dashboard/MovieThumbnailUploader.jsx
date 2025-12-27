"use client";

import { useMemo, useRef, useState } from "react";

/**
 * MovieThumbnailUploader
 * - KEIN Crop
 * - Preview bleibt 16:9 (object-fit: contain)
 * - Upload zu Hostinger upload.php
 *
 * Erwartet: upload.php antwortet JSON: { "url": "https://.../uploads/xyz.jpg" }
 */
export default function MovieThumbnailUploader({
  onUploaded,
  uploadUrl,
  maxSizeMb = 15,
  accept = "image/*",
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  const resolvedUploadUrl = useMemo(() => {
    // Priorität: prop uploadUrl -> ENV -> leer (dann Error)
    return (
      uploadUrl ||
      process.env.NEXT_PUBLIC_HOSTINGER_UPLOAD_URL ||
      ""
    );
  }, [uploadUrl]);

  const pickFile = () => {
    setErr("");
    inputRef.current?.click();
  };

  const clear = () => {
    setErr("");
    setBusy(false);
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }
    }
    setPreviewUrl("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const upload = async (file) => {
    setErr("");

    if (!resolvedUploadUrl) {
      setErr(
        "Upload-URL fehlt. Setze NEXT_PUBLIC_HOSTINGER_UPLOAD_URL (oder übergib uploadUrl als Prop)."
      );
      return;
    }

    if (!file) return;

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setErr(`Datei zu groß. Maximal ${maxSizeMb} MB.`);
      return;
    }

    // Optional: sehr grobe Validierung
    if (!String(file.type || "").startsWith("image/")) {
      setErr("Bitte eine Bilddatei auswählen.");
      return;
    }

    setBusy(true);

    try {
      const fd = new FormData();

      // WICHTIG: Der Key muss zu upload.php passen. Standard hier: "file"
      fd.append("file", file);

      const res = await fetch(resolvedUploadUrl, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(
          `Upload fehlgeschlagen (HTTP ${res.status}). ${t ? "Server: " + t : ""}`
        );
      }

      const data = await res.json().catch(() => null);
      if (!data || !data.url) {
        throw new Error(
          "Upload fehlgeschlagen: Server hat kein JSON mit { url } zurückgegeben."
        );
      }

      onUploaded?.(data.url);
    } catch (e) {
      setErr(e?.message || "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = async (e) => {
    setErr("");
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview (16:9 container, Bild wird nicht beschnitten)
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // ignore
      }
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    // Direkt hochladen (ohne Crop-Dialog)
    await upload(file);
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFileChange}
        className="hidden"
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-900 disabled:opacity-60"
          >
            {busy ? "Lade hoch…" : "Thumbnail auswählen"}
          </button>

          <button
            type="button"
            onClick={clear}
            disabled={busy}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 hover:bg-neutral-900 disabled:opacity-60"
          >
            Zurücksetzen
          </button>
        </div>

        {previewUrl ? (
          <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
            {/* 16:9 Preview-Frame */}
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <img
                src={previewUrl}
                alt="Thumbnail Preview"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          </div>
        ) : null}

        {err ? <div className="text-sm text-red-300">{err}</div> : null}

        {!resolvedUploadUrl ? (
          <div className="text-xs text-neutral-500">
            Hinweis: Setze NEXT_PUBLIC_HOSTINGER_UPLOAD_URL, z. B.
            {" "}
            <span className="font-mono">https://DEINE-DOMAIN.TLD/upload.php</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
