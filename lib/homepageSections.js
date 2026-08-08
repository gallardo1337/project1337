export const HOMEPAGE_SECTION_TYPES = {
  showcase: {
    label: "Cinema Showcase",
    defaultTitle: "Cinema Showcase",
    defaultEyebrow: "Aus dem Archiv",
    defaultLimit: 5,
    minLimit: 1,
    maxLimit: 8,
    unique: true,
  },
  recent: {
    label: "Neu im Archiv",
    defaultTitle: "Neu im Archiv",
    defaultEyebrow: "Just added",
    defaultLimit: 9,
    minLimit: 3,
    maxLimit: 12,
  },
  top_rated: {
    label: "Top bewertet",
    defaultTitle: "Top bewertet",
    defaultEyebrow: "Best of the archive",
    defaultLimit: 9,
    minLimit: 3,
    maxLimit: 12,
  },
  most_viewed: {
    label: "Meistgesehen",
    defaultTitle: "Meistgesehen",
    defaultEyebrow: "Audience favourites",
    defaultLimit: 9,
    minLimit: 3,
    maxLimit: 12,
  },
  random: {
    label: "Zufällige Auswahl",
    defaultTitle: "Für dich ausgewählt",
    defaultEyebrow: "Random selection",
    defaultLimit: 9,
    minLimit: 3,
    maxLimit: 12,
  },
  studio: {
    label: "Studio-Spotlight",
    defaultTitle: "Studio Spotlight",
    defaultEyebrow: "Selected studio",
    defaultLimit: 9,
    minLimit: 3,
    maxLimit: 12,
  },
  actors: {
    label: "Darsteller",
    defaultTitle: "Talents der Collection",
    defaultEyebrow: "The faces",
    defaultLimit: 7,
    minLimit: 3,
    maxLimit: 12,
    unique: true,
  },
  manifesto: {
    label: "Abschlussfläche",
    defaultTitle: "Not streaming.",
    defaultEyebrow: "Collecting.",
    defaultLimit: 1,
    minLimit: 1,
    maxLimit: 1,
    unique: true,
  },
};

export const DEFAULT_HOMEPAGE_SECTIONS = [
  {
    id: "cinema-showcase",
    type: "showcase",
    enabled: true,
    title: "Cinema Showcase",
    eyebrow: "Aus dem Archiv",
    itemLimit: 5,
    config: {},
  },
  {
    id: "new-in-archive",
    type: "recent",
    enabled: true,
    title: "Neu im Archiv",
    eyebrow: "Just added",
    itemLimit: 9,
    config: {},
  },
  {
    id: "collection-talents",
    type: "actors",
    enabled: true,
    title: "Talents der Collection",
    eyebrow: "The faces",
    itemLimit: 7,
    config: {},
  },
  {
    id: "archive-manifesto",
    type: "manifesto",
    enabled: true,
    title: "Not streaming.",
    eyebrow: "Collecting.",
    itemLimit: 1,
    config: {},
  },
];

const safeText = (value, fallback, maxLength = 80) => {
  const normalized = String(value || "").trim().slice(0, maxLength);
  return normalized || fallback;
};

const safeId = (value, type, index, seenIds) => {
  const requested = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 80);
  const base = requested || `${type}-${index + 1}`;
  let id = base;
  let suffix = 2;

  while (seenIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  seenIds.add(id);
  return id;
};

export function normalizeHomepageSections(value, { fallbackToDefault = true } = {}) {
  if (!Array.isArray(value)) {
    return fallbackToDefault
      ? DEFAULT_HOMEPAGE_SECTIONS.map((section) => ({
          ...section,
          config: { ...section.config },
        }))
      : [];
  }

  const seenIds = new Set();
  const seenUniqueTypes = new Set();
  const normalized = [];

  value.slice(0, 16).forEach((section, index) => {
    const type = String(section?.type || "");
    const definition = HOMEPAGE_SECTION_TYPES[type];
    if (!definition) return;
    if (definition.unique && seenUniqueTypes.has(type)) return;
    if (definition.unique) seenUniqueTypes.add(type);

    const requestedLimit = Number(section?.itemLimit);
    const itemLimit = Math.min(
      definition.maxLimit,
      Math.max(
        definition.minLimit,
        Number.isFinite(requestedLimit)
          ? Math.round(requestedLimit)
          : definition.defaultLimit
      )
    );

    normalized.push({
      id: safeId(section?.id, type, index, seenIds),
      type,
      enabled: section?.enabled !== false,
      title: safeText(section?.title, definition.defaultTitle),
      eyebrow: safeText(section?.eyebrow, definition.defaultEyebrow),
      itemLimit,
      config: {
        studio: safeText(section?.config?.studio, "", 120),
        includeRetro: section?.config?.includeRetro === true,
      },
    });
  });

  if (normalized.length) return normalized;
  return fallbackToDefault
    ? DEFAULT_HOMEPAGE_SECTIONS.map((section) => ({
        ...section,
        config: { ...section.config },
      }))
    : [];
}

export function createHomepageSection(type, id) {
  const definition = HOMEPAGE_SECTION_TYPES[type];
  if (!definition) return null;

  return {
    id,
    type,
    enabled: true,
    title: definition.defaultTitle,
    eyebrow: definition.defaultEyebrow,
    itemLimit: definition.defaultLimit,
    config: {
      studio: "",
      includeRetro: false,
    },
  };
}
