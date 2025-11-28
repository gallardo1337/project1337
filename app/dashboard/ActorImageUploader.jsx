"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";

const UPLOAD_URL = process.env.NEXT_PUBLIC_ACTOR_UPLOAD_URL;

// Hilfsfunktion: Bild anhand der Crop-Area zuschneiden
async function getCroppedImage(imageSrc, pixelCrop) {
  const image = new Image();
  image.src = imageSrc;
  image.crossOrigin = "anonymous";

  await new Promise((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = (e) => reject(e);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas leer"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });
}

/**
 * Props:
 *  onUploaded(url: string) – wird aufgerufen, wenn Upload fertig ist
 */
export default function ActorImageUploader({ onUploaded }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageSrc(reader.result);
        setPreviewUrl(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    if (!UPLOAD_URL) {
      alert("UPLOAD_URL ist nicht gesetzt (NEXT_PUBLIC_ACTOR_UPLOAD_URL).");
      return;
    }

    try {
      setUploading(true);

      const blob = await getCroppedImage(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      const filename = `actor_${Date.now()}.jpg`;
      formData.append("image", blob, filename);

      const res = await fetch(UPLOAD_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        console.error(await res.text());
        alert("Upload fehlgeschlagen");
        return;
      }

      const data = await res.json();
      if (!data || !data.url) {
        console.error(data);
        alert("Upload-Response ohne URL");
        return;
      }

      setPreviewUrl(data.url);
      onUploaded && onUploaded(data.url);
    } catch (err) {
      console.error(err);
      alert("Fehler beim Croppen oder Upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Darsteller-Foto hochladen
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="block w-full text-sm"
        />
      </div>

      {imageSrc && (
        <>
          <div className="relative w-64 h-64 bg-black/80 rounded-full overflow-hidden mx-auto">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="mt-3">
            <label className="text-xs block mb-1">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full rounded-md bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
          >
            {uploading ? "Lädt hoch..." : "Bild zuschneiden & hochladen"}
          </button>
        </>
      )}

      {previewUrl && (
        <div className="mt-4 text-center">
          <div className="mx-auto h-24 w-24 rounded-full overflow-hidden border">
            <img
              src={previewUrl}
              alt="Darsteller-Avatar"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="mt-2 text-xs break-all">{previewUrl}</p>
        </div>
      )}
    </div>
  );
}
