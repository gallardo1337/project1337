const RESOLUTION_LOGOS = [
  {
    matches: (value) => value.includes("4k"),
    src: "/4k.svg",
    alt: "4K",
  },
  {
    matches: (value) => value.includes("fullhd") || value.includes("full hd"),
    src: "/fullhd.svg",
    alt: "FullHD",
  },
  {
    matches: (value) => value.includes("retro"),
    src: "/retro.svg",
    alt: "Retro",
  },
];

export function getResolutionLogo(resolution) {
  const value = String(resolution || "").trim().toLowerCase();
  if (!value) return null;

  return RESOLUTION_LOGOS.find((logo) => logo.matches(value)) || null;
}

export default function ResolutionIndicator({
  value,
  logoClassName = "",
  fallbackClassName = "",
  fallback = "HD",
}) {
  const logo = getResolutionLogo(value);

  if (!logo) {
    return (
      <span className={fallbackClassName} title={String(value || fallback)}>
        {value || fallback}
      </span>
    );
  }

  return (
    <span
      className={logoClassName}
      title={logo.alt}
      aria-label={`Qualität: ${logo.alt}`}
    >
      <img src={logo.src} alt={logo.alt} />
    </span>
  );
}
