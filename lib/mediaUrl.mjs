// KH7 owns the apex domain; existing uploads remain on the media host.
export function mediaUrl(value) {
  if (typeof value !== "string" || !value) return value;
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) &&
        ["gallardo1337.io", "www.gallardo1337.io"].includes(url.hostname)) {
      url.protocol = "https:";
      url.hostname = "media.gallardo1337.io";
      url.port = "";
      return url.toString();
    }
  } catch {
    // Existing callers handle missing or invalid addresses.
  }
  return value;
}
