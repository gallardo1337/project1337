const appBaseUrl = "https://my1337.de";
const videoBaseUrl = "https://video.my1337.de";

function normalizeUrl(value, baseUrl) {
  if (!value) return null;

  const cleanValue = String(value).trim();
  if (!cleanValue) return null;
  if (cleanValue.startsWith("https://")) return cleanValue;
  if (cleanValue.startsWith("http://")) return cleanValue;
  if (cleanValue.startsWith("//")) return `https:${cleanValue}`;

  return encodeURI(`${baseUrl}/${cleanValue.replace(/^\/+/, "")}`);
}

function normalizeOption(row) {
  return {
    id: String(row.id),
    name:
      row.name ||
      row.title ||
      row.label ||
      row.value ||
      row.display_name ||
      "Unbekannt",
  };
}

function sortByName(a, b) {
  return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
}

function asIdList(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function makeEntityMap(rows) {
  return new Map((rows || []).map((row) => [String(row.id), row]));
}

function actorImage(actor) {
  return normalizeUrl(
    actor?.profile_image ||
      actor?.image_url ||
      actor?.photo_url ||
      actor?.avatar_url ||
      actor?.thumbnail_url ||
      actor?.image ||
      null,
    appBaseUrl
  );
}

function castMember(actor) {
  if (!actor) return null;

  return {
    id: String(actor.id),
    name: actor.name || actor.title || "Unbekannt",
    image_url: actorImage(actor),
    slug: actor.slug || null,
  };
}

function buildMetricMap(metrics) {
  return new Map(
    (metrics || []).map((metric) => [String(metric.movie_id), metric])
  );
}

function buildActorMetrics(actorId, movies, metricMap) {
  const actorMovies = movies.filter((movie) =>
    asIdList(movie.main_actor_ids).includes(String(actorId))
  );
  const ratings = actorMovies
    .map((movie) => Number(metricMap.get(String(movie.id))?.rating))
    .filter((rating) => Number.isInteger(rating) && rating > 0);

  return {
    movie_count: actorMovies.length,
    total_views: actorMovies.reduce(
      (sum, movie) =>
        sum + Math.max(0, Number(metricMap.get(String(movie.id))?.view_count) || 0),
      0
    ),
    average_rating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null,
    rated_movies: ratings.length,
  };
}

export function buildTvLibraryPayload({
  movies = [],
  actors = [],
  supportingActors = [],
  studios = [],
  tags = [],
  resolutions = [],
  metrics = [],
  sections = [],
}) {
  const actorMap = makeEntityMap(actors);
  const supportingActorMap = makeEntityMap(supportingActors);
  const studioMap = makeEntityMap(studios);
  const tagMap = makeEntityMap(tags);
  const resolutionMap = makeEntityMap(resolutions);
  const metricMap = buildMetricMap(metrics);

  const mappedMovies = movies.map((movie) => {
    const id = String(movie.id);
    const mainActorIds = asIdList(movie.main_actor_ids);
    const supportingActorIds = asIdList(movie.supporting_actor_ids);
    const tagIds = asIdList(movie.tag_ids);
    const metric = metricMap.get(id);
    const mainCast = mainActorIds
      .map((actorId) => castMember(actorMap.get(actorId)))
      .filter(Boolean);
    const supportCast = supportingActorIds
      .map((actorId) => castMember(supportingActorMap.get(actorId)))
      .filter(Boolean);

    return {
      id,
      title: movie.title || movie.name || "Ohne Titel",
      year: movie.year || null,
      thumbnail_url: normalizeUrl(
        movie.thumbnail_url ||
          movie.thumbnail ||
          movie.thumb_url ||
          movie.image_url ||
          null,
        appBaseUrl
      ),
      file_url:
        normalizeUrl(
          movie.file_url || movie.video_url || movie.url || null,
          videoBaseUrl
        ) || "",
      added_at:
        movie.created_at || movie.inserted_at || movie.createdAt || null,
      quality:
        resolutionMap.get(String(movie.resolution_id))?.name ||
        movie.quality ||
        movie.resolution ||
        movie.resolution_name ||
        null,
      resolution_id: movie.resolution_id ? String(movie.resolution_id) : null,
      studio:
        studioMap.get(String(movie.studio_id))?.name ||
        movie.studio ||
        movie.studio_name ||
        null,
      studio_id: movie.studio_id ? String(movie.studio_id) : null,
      tag_ids: tagIds,
      main_actor_ids: mainActorIds,
      supporting_actor_ids: supportingActorIds,
      tags: tagIds
        .map((tagId) => tagMap.get(tagId)?.name)
        .filter(Boolean),
      actors: mainCast.map((person) => person.name),
      support_actors: supportCast.map((person) => person.name),
      main_cast: mainCast,
      support_cast: supportCast,
      rating:
        metric?.rating != null && Number.isInteger(Number(metric.rating))
          ? Number(metric.rating)
          : null,
      view_count: Math.max(0, Number(metric?.view_count) || 0),
      is_favorite: metric?.is_favorite === true,
    };
  });

  const mappedActors = actors
    .map((actor) => ({
      id: String(actor.id),
      name: actor.name || actor.title || "Unbekannt",
      image_url: actorImage(actor),
      slug: actor.slug || null,
      origin: actor.origin || null,
      birth_date: actor.birth_date || null,
      iafd_url: actor.iafd_url || null,
      planetsuzy_url: actor.planetsuzy_url || null,
      ...buildActorMetrics(actor.id, movies, metricMap),
    }))
    .filter((actor) => actor.movie_count > 0)
    .sort(sortByName);

  return {
    movies: mappedMovies,
    actors: mappedActors,
    filters: {
      tags: tags.map(normalizeOption).sort(sortByName),
      studios: studios.map(normalizeOption).sort(sortByName),
      main_actors: actors.map(normalizeOption).sort(sortByName),
      supporting_actors: supportingActors.map(normalizeOption).sort(sortByName),
      resolutions: resolutions.map(normalizeOption).sort(sortByName),
    },
    sections,
  };
}
