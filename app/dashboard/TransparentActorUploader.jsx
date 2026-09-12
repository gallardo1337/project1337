"use client";

import { useRef, useState } from "react";

const UPLOAD_URL = process.env.NEXT_PUBLIC_ACTOR_UPLOAD_URL;

export default function TransparentActorUploader({
  value,
  onChange,
  title = "Großes Profilbild (PNG)",
  description = "Freigestelltes PNG für die Darstellerübersicht und die große Profilseite.",
  recommendedSize = "Empfohlen: mindestens 900 × 1125 px im Verhältnis 4:5.",
  filenamePrefix = "actor_profile",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("Bitte ein PNG mit höchstens 10 MB auswählen.");
      return;
    }
    setUploading(true);
    try {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => signature[i] === byte)) {
        throw new Error("Bitte eine PNG-Datei auswählen.");
      }
      if (!UPLOAD_URL) throw new Error("Der Bild-Upload ist nicht eingerichtet.");
      const body = new FormData();
      body.append("image", file, `${filenamePrefix}_${crypto.randomUUID()}.png`);
      const response = await fetch(UPLOAD_URL, { method: "POST", body });
      if (!response.ok) throw new Error("Upload fehlgeschlagen. Bitte erneut versuchen.");
      const data = await response.json();
      if (typeof data?.url !== "string" || !/^https?:\/\//i.test(data.url)) {
        throw new Error("Der Upload hat keine gültige Bildadresse zurückgegeben.");
      }
      onChange(data.url);
    } catch (cause) {
      setError(cause.message || "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-700 p-3" aria-busy={uploading}>
      <div className="text-sm font-medium">{title}</div>
      <p className="text-sm text-neutral-400">{description}</p>
      {value && (
        <div className="flex items-center gap-3">
          <img src={value} alt={title} className="h-32 w-24 object-contain"
            style={{ backgroundColor: "#262626", backgroundImage: "conic-gradient(#404040 25%, transparent 0 50%, #404040 0 75%, transparent 0)", backgroundSize: "16px 16px" }} />
          <button type="button" disabled={uploading} onClick={() => onChange("")} className="rounded-lg border border-neutral-700 px-3 py-2 text-sm disabled:opacity-50">Zusatzbild entfernen</button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/png,.png" onChange={upload} hidden aria-label={`${title} auswählen`} />
      <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-2 text-sm hover:border-red-500 disabled:opacity-50">
        {uploading ? "Lädt hoch…" : value ? "PNG ersetzen" : "PNG hochladen"}
      </button>
      <p className="text-sm text-neutral-500">{recommendedSize} Bis 10 MB. Anschließend den Darsteller speichern.</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
