"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient"; // app/page.jsx -> ../lib/supabaseClient
import BetaExperience from "./beta/BetaExperience";

function safeOpen(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export default function HomePage() {
  const router = useRouter();
  const rootUrl = "/";

  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [selectedActor, setSelectedActor] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [viewMode, setViewMode] = useState("actors"); // "actors" | "movies"
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [movieSort, setMovieSort] = useState("added_desc");
  const [moviesTitle, setMoviesTitle] = useState("Filme");
  const [moviesSubtitle, setMoviesSubtitle] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStudio, setSelectedStudio] = useState("");
  const [selectedResolution, setSelectedResolution] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [selectedMainActors, setSelectedMainActors] = useState([]);
  const [selectedSupportingActors, setSelectedSupportingActors] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem("auth_1337_flag");
    const user = window.localStorage.getItem("auth_1337_user");
    if (flag === "1" && user) {
      setLoggedIn(true);
      setLoginUser(user);
    } else {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setMovies([]);
      setActors([]);
      setSelectedActor(null);
      setSelectedMovieId(null);
      setVisibleMovies([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [
          moviesRes,
          actorsRes,
          actors2Res,
          studiosRes,
          tagsRes,
          resolutionsRes,
          metricsResponse,
        ] = await Promise.all([
          supabase.from("movies").select("*"),
          supabase.from("actors").select("*"),
          supabase.from("actors2").select("*"),
          supabase.from("studios").select("*"),
          supabase.from("tags").select("*"),
          supabase.from("resolutions").select("*"),
          fetch("/api/movie-metrics", { cache: "no-store" }).catch(() => null),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (resolutionsRes.error) throw resolutionsRes.error;

        const moviesData = moviesRes.data || [];
        const mainActors = actorsRes.data || [];
        const supportActors = actors2Res.data || [];
        const studios = studiosRes.data || [];
        const tags = tagsRes.data || [];
        const resolutions = resolutionsRes.data || [];
        const metricsPayload = metricsResponse?.ok
          ? await metricsResponse.json()
          : { metrics: [] };
        const metricsByMovieId = new Map(
          (Array.isArray(metricsPayload?.metrics) ? metricsPayload.metrics : []).map(
            (metric) => [String(metric.movie_id), metric]
          )
        );

        const mainActorById = Object.fromEntries(
          mainActors.map((a) => [a.id, a])
        );
        const supportActorById = Object.fromEntries(
          supportActors.map((a) => [a.id, a])
        );
        const studioMap = Object.fromEntries(
          studios.map((s) => [s.id, s.name])
        );
        const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.name]));
        const resolutionMap = Object.fromEntries(
          resolutions.map((r) => [r.id, r.name])
        );

        const mappedMovies = (moviesData || []).map((m) => {
          const metric = metricsByMovieId.get(String(m.id));
          const mainIds = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          const supportIds = Array.isArray(m.supporting_actor_ids)
            ? m.supporting_actor_ids
            : [];

          const mainNames = mainIds
            .map((id) => mainActorById[id]?.name)
            .filter(Boolean);
          const supportNames = supportIds
            .map((id) => supportActorById[id]?.name)
            .filter(Boolean);

          const allActors = [...mainNames, ...supportNames];
          const tagNames = Array.isArray(m.tag_ids)
            ? m.tag_ids
                .map((id) => tagMap[id])
                .filter(Boolean)
                .sort((a, b) =>
                  a.localeCompare(b, "de", { sensitivity: "base" })
                )
            : [];

          const resolutionName = m.resolution_id
            ? resolutionMap[m.resolution_id] || null
            : null;

          return {
            id: m.id,
            title: m.title,
            year: m.year,
            fileUrl: m.file_url,
            studio: m.studio_id ? studioMap[m.studio_id] || null : null,
            resolution: resolutionName,
            thumbnailUrl: m.thumbnail_url || null,
            addedAt: m.created_at || m.inserted_at || m.createdAt || null,
            rating:
              metric?.rating != null && Number.isInteger(Number(metric.rating))
                ? Number(metric.rating)
                : null,
            viewCount: Math.max(0, Number(metric?.view_count) || 0),
            favorite: metric?.is_favorite === true,
            actors: allActors,
            tags: tagNames,
            mainActorIds: mainIds,
            supportingActorIds: supportIds,
            mainActorNames: mainNames,
            supportingActorNames: supportNames,
            mainCast: mainIds
              .map((id) => mainActorById[id])
              .filter(Boolean)
              .map((a) => ({
                id: a.id,
                name: a.name,
                profileImage: a.profile_image || null,
                slug: a.slug || null,
              })),
            supportCast: supportIds
              .map((id) => supportActorById[id])
              .filter(Boolean)
              .map((a) => ({
                id: a.id,
                name: a.name,
                profileImage: a.profile_image || null,
              })),
          };
        });

        setMovies(mappedMovies);

        const movieCountByActorId = new Map();
        moviesData.forEach((m) => {
          const arr = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          arr.forEach((id) =>
            movieCountByActorId.set(id, (movieCountByActorId.get(id) || 0) + 1)
          );
        });

        const actorList = mainActors
          .map((a) => ({
            id: a.id,
            slug: a.slug || null,
            name: a.name,
            profileImage: a.profile_image || null,
            origin: a.origin || null,
            birthDate: a.birth_date || null,
            iafdUrl: a.iafd_url || null,
            planetsuzyUrl: a.planetsuzy_url || null,
            movieCount: movieCountByActorId.get(a.id) || 0,
          }))
          .filter((a) => a.movieCount > 0)
          .sort((a, b) =>
            a.name.localeCompare(b.name, "de", { sensitivity: "base" })
          );

        setActors(actorList);

        let actorParam = null;
        let movieParam = null;
        let viewParam = null;
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search || "");
          actorParam = sp.get("actor");
          movieParam = sp.get("movie");
          viewParam = sp.get("view");
        }

        if (movieParam && mappedMovies.some((movie) => String(movie.id) === String(movieParam))) {
          setSelectedMovieId(movieParam);
          setViewMode("movies");
          setSelectedActor(null);
          setVisibleMovies([]);
          setMoviesTitle("Filme");
          setMoviesSubtitle("");
        } else if (actorParam) {
          const actor =
            isUuid(actorParam)
              ? actorList.find((a) => String(a.id) === String(actorParam))
              : actorList.find((a) => String(a.slug) === String(actorParam));

          if (actor) {
            const subset = mappedMovies.filter(
              (movie) =>
                Array.isArray(movie.mainActorIds) &&
                movie.mainActorIds.includes(actor.id)
            );

            if (isUuid(actorParam) && actor.slug) {
              const sp = new URLSearchParams(window.location.search || "");
              sp.set("actor", actor.slug);
              router.replace(`${rootUrl}?${sp.toString()}`, { scroll: false });
            }

            setSelectedActor(actor);
            setSelectedMovieId(null);
            setMoviesTitle(actor.name);
            setMoviesSubtitle(`${subset.length} Film(e)`);
            setVisibleMovies(subset);
            setViewMode("movies");
          } else {
            setViewMode("actors");
            setSelectedActor(null);
            setSelectedMovieId(null);
            setVisibleMovies([]);
            setMoviesTitle("Filme");
            setMoviesSubtitle("");
          }
        } else if (viewParam === "favorites") {
          setViewMode("favorites");
          setSelectedActor(null);
          setSelectedMovieId(null);
          setVisibleMovies([]);
          setMoviesTitle("Favoriten");
          setMoviesSubtitle("Deine gespeicherten Lieblingsfilme");
        } else {
          setViewMode("actors");
          setSelectedActor(null);
          setSelectedMovieId(null);
          setVisibleMovies([]);
          setMoviesTitle("Filme");
          setMoviesSubtitle("");
        }
      } catch (e) {
        console.error(e);
        setErr("Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loggedIn, rootUrl, router]);

  const allTags = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const allStudios = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      if (m.studio) set.add(m.studio);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const allResolutions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      if (m.resolution) set.add(m.resolution);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const mainActorOptions = useMemo(() => {
    return (actors || [])
      .map((a) => ({ id: a.id, name: a.name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "de", { sensitivity: "base" })
      );
  }, [actors]);

  const supportingActorOptions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) =>
      (m.supportingActorNames || []).forEach((n) => set.add(n))
    );
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const applyAdvancedFilters = (baseList) => {
    let list = baseList;

    if (selectedStudio)
      list = list.filter((m) => (m.studio || "") === selectedStudio);
    if (selectedResolution)
      list = list.filter((m) => (m.resolution || "") === selectedResolution);

    const yf = yearFrom ? parseInt(yearFrom, 10) : null;
    const yt = yearTo ? parseInt(yearTo, 10) : null;
    if (yf || yt) {
      list = list.filter((m) => {
        const y = m.year ? parseInt(m.year, 10) : null;
        if (!y) return false;
        if (yf && y < yf) return false;
        if (yt && y > yt) return false;
        return true;
      });
    }

    if (selectedTags.length > 0) {
      list = list.filter((m) => {
        const mtags = Array.isArray(m.tags) ? m.tags : [];
        return selectedTags.every((t) => mtags.includes(t));
      });
    }

    if (selectedMainActors.length > 0) {
      list = list.filter((m) => {
        const ids = Array.isArray(m.mainActorIds)
          ? m.mainActorIds.map(String)
          : [];
        return selectedMainActors.map(String).every((id) => ids.includes(id));
      });
    }

    if (selectedSupportingActors.length > 0) {
      list = list.filter((m) => {
        const names = Array.isArray(m.supportingActorNames)
          ? m.supportingActorNames
          : [];
        return selectedSupportingActors.every((n) => names.includes(n));
      });
    }

    return list;
  };

  const hasAnyFilter = useMemo(() => {
    return Boolean(
      selectedStudio ||
        selectedResolution ||
        selectedTags.length > 0 ||
        yearFrom ||
        yearTo ||
        selectedMainActors.length > 0 ||
        selectedSupportingActors.length > 0
    );
  }, [
    selectedStudio,
    selectedResolution,
    selectedTags.length,
    yearFrom,
    yearTo,
    selectedMainActors.length,
    selectedSupportingActors.length,
  ]);

  useEffect(() => {
    if (!loggedIn || typeof window === "undefined" || movies.length === 0) {
      return undefined;
    }

    const restoreViewFromHistory = () => {
      const params = new URLSearchParams(window.location.search || "");
      const movieParam = params.get("movie");
      const actorParam = params.get("actor");
      const viewParam = params.get("view");

      if (
        movieParam &&
        movies.some((movie) => String(movie.id) === String(movieParam))
      ) {
        setSelectedMovieId(String(movieParam));
        setViewMode("movies");
        requestAnimationFrame(() => window.scrollTo(0, 0));
        return;
      }

      if (actorParam) {
        const actor = isUuid(actorParam)
          ? actors.find((item) => String(item.id) === String(actorParam))
          : actors.find((item) => String(item.slug) === String(actorParam));

        if (actor) {
          const actorMovies = movies.filter(
            (movie) =>
              Array.isArray(movie.mainActorIds) &&
              movie.mainActorIds.includes(actor.id)
          );

          setSelectedActor(actor);
          setSelectedMovieId(null);
          setMoviesTitle(actor.name);
          setMoviesSubtitle(`${actorMovies.length} Film(e)`);
          setVisibleMovies(actorMovies);
          setViewMode("movies");
          requestAnimationFrame(() => window.scrollTo(0, 0));
          return;
        }
      }

      if (viewParam === "favorites") {
        setSearch("");
        setSelectedActor(null);
        setSelectedMovieId(null);
        setViewMode("favorites");
        setVisibleMovies([]);
        setMoviesTitle("Favoriten");
        setMoviesSubtitle("Deine gespeicherten Lieblingsfilme");
        requestAnimationFrame(() => window.scrollTo(0, 0));
        return;
      }

      setSearch("");
      setSelectedActor(null);
      setSelectedMovieId(null);
      setViewMode("actors");
      setVisibleMovies([]);
      setMoviesTitle("Filme");
      setMoviesSubtitle("");
      requestAnimationFrame(() => window.scrollTo(0, 0));
    };

    window.addEventListener("popstate", restoreViewFromHistory);
    return () => {
      window.removeEventListener("popstate", restoreViewFromHistory);
    };
  }, [actors, loggedIn, movies]);

  const showMovies = viewMode === "movies" || viewMode === "favorites";

  const getAddedTime = (movie) => {
    if (!movie?.addedAt) return 0;
    const t = new Date(movie.addedAt).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const getYearValue = (movie) => {
    const y = movie?.year ? parseInt(movie.year, 10) : 0;
    return Number.isNaN(y) ? 0 : y;
  };

  const getQualityRank = (movie) => {
    const r = String(movie?.resolution || "").trim().toLowerCase();
    if (r.includes("4k")) return 3;
    if (r.includes("fullhd") || r.includes("full hd")) return 2;
    if (r.includes("retro")) return 1;
    return 0;
  };

  const movieList = useMemo(() => {
    if (!showMovies) return [];

    const list =
      viewMode === "favorites"
        ? movies.filter((movie) => movie.favorite)
        : [...visibleMovies];

    list.sort((a, b) => {
      if (movieSort === "year_desc") {
        return (getYearValue(b) - getYearValue(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
      }

      if (movieSort === "quality_desc") {
        return (getQualityRank(b) - getQualityRank(a)) || (getAddedTime(b) - getAddedTime(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
      }

      if (movieSort === "views_desc") {
        return (
          (Math.max(0, Number(b.viewCount) || 0) - Math.max(0, Number(a.viewCount) || 0)) ||
          (getAddedTime(b) - getAddedTime(a)) ||
          String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" })
        );
      }

      if (movieSort === "rating_desc") {
        const rawRatingA = Number(a.rating);
        const rawRatingB = Number(b.rating);
        const ratingA = Number.isInteger(rawRatingA) && rawRatingA >= 1 && rawRatingA <= 10 ? rawRatingA : -1;
        const ratingB = Number.isInteger(rawRatingB) && rawRatingB >= 1 && rawRatingB <= 10 ? rawRatingB : -1;
        return (
          (ratingB - ratingA) ||
          (Math.max(0, Number(b.viewCount) || 0) - Math.max(0, Number(a.viewCount) || 0)) ||
          (getAddedTime(b) - getAddedTime(a)) ||
          String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" })
        );
      }

      return (getAddedTime(b) - getAddedTime(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
    });

    return list;
  }, [showMovies, viewMode, movies, visibleMovies, movieSort]);

  const handleShowMoviesForActor = (actorId, actorName, actorSlug) => {
    const actor = actors.find((a) => String(a.id) === String(actorId)) || null;
    const urlVal = actorSlug ? actorSlug : actorId;
    router.push(`${rootUrl}?actor=${encodeURIComponent(urlVal)}`, { scroll: false });

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    const subset = movies.filter(
      (movie) =>
        Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId)
    );
    const filtered = applyAdvancedFilters(subset);
    setSelectedActor(actor);
    setSelectedMovieId(null);
    setMoviesTitle(actorName);
    setMoviesSubtitle(`${filtered.length} Film(e)`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    const trimmed = val.trim();

    if (!trimmed) {
      if (hasAnyFilter) {
        const filtered = applyAdvancedFilters(movies);
        setMoviesTitle("Gefilterte Filme");
        setMoviesSubtitle(`${filtered.length} Treffer`);
        setVisibleMovies(filtered);
        setSelectedActor(null);
        setSelectedMovieId(null);
        setViewMode("movies");
      } else {
        router.replace(rootUrl, { scroll: false });
        setSelectedActor(null);
        setSelectedMovieId(null);
        setViewMode("actors");
        setVisibleMovies([]);
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
      }
      return;
    }

    router.replace(rootUrl, { scroll: false });

    const q = trimmed.toLowerCase();
    const raw = movies.filter((movie) => {
      const haystack = [
        movie.title || "",
        movie.studio || "",
        movie.resolution || "",
        movie.actors.join(" "),
        movie.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    const filtered = applyAdvancedFilters(raw);
    setSelectedActor(null);
    setSelectedMovieId(null);
    setMoviesTitle(`Suchergebnis für "${trimmed}"`);
    setMoviesSubtitle(`${filtered.length} Treffer`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const handleBackToActors = () => {
    router.replace(rootUrl, { scroll: false });
    setViewMode("actors");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
  };

  const handleShowAllActors = () => {
    router.replace(rootUrl, { scroll: false });
    setViewMode("actors_all");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  const handleSwitchToMovies = () => {
    router.replace(rootUrl, { scroll: false });
    const filtered = applyAdvancedFilters(movies);
    setSelectedActor(null);
    setSelectedMovieId(null);
    setViewMode("movies");
    setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
    setMoviesSubtitle(`${filtered.length} Film(e)`);
    setVisibleMovies(filtered);
  };

  const handleShowFavorites = () => {
    router.replace(`${rootUrl}?view=favorites`, { scroll: false });
    setSearch("");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setViewMode("favorites");
    setMoviesTitle("Favoriten");
    setMoviesSubtitle("Deine gespeicherten Lieblingsfilme");
    setVisibleMovies([]);
    setFiltersOpen(false);

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErr(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPassword }),
      });

      if (!res.ok) {
        setLoginErr(
          res.status === 401
            ? "User oder Passwort falsch."
            : "Login fehlgeschlagen."
        );
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth_1337_flag", "1");
        window.localStorage.setItem("auth_1337_user", loginUser);
      }
      setLoggedIn(true);
      setLoginErr(null);
      setLoginPassword("");
    } catch (error) {
      console.error(error);
      setLoginErr("Netzwerkfehler beim Login.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_1337_flag");
      window.localStorage.removeItem("auth_1337_user");
    }
    router.replace(rootUrl, { scroll: false });
    setLoggedIn(false);
    setSearch("");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setViewMode("actors");
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedStudio("");
    setSelectedResolution("");
    setYearFrom("");
    setYearTo("");
    setSelectedMainActors([]);
    setSelectedSupportingActors([]);

  };

  const applyFiltersNow = () => {
    if (search.trim()) handleSearchChange(search);
    else {
      router.replace(rootUrl, { scroll: false });
      const filtered = applyAdvancedFilters(movies);
      setSelectedActor(null);
      setViewMode("movies");
      setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
      setMoviesSubtitle(`${filtered.length} Treffer`);
      setVisibleMovies(filtered);
    }

    setFiltersOpen(false);
  };

  const toggleTag = (t) =>
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const toggleMainActor = (id) => {
    const sid = String(id);
    setSelectedMainActors((prev) => {
      const p = prev.map(String);
      return p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid];
    });
  };

  const toggleSupportingActor = (name) =>
    setSelectedSupportingActors((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return movies.find((movie) => String(movie.id) === String(selectedMovieId)) || null;
  }, [movies, selectedMovieId]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    if (selectedMovie?.title) {
      document.title = `${selectedMovie.title} | my1337.de`;
      return;
    }

    if (viewMode === "favorites") {
      document.title = "Favoriten | my1337.de";
      return;
    }

    if (selectedActor?.name && viewMode === "movies") {
      document.title = `${selectedActor.name} | my1337.de`;
      return;
    }

    document.title = "Home | my1337.de";
  }, [selectedMovie?.title, selectedActor?.name, viewMode]);

  const patchMovieMetric = (movieId, patch) => {
    const matchesMovie = (movie) => String(movie.id) === String(movieId);
    const patchList = (list) =>
      list.map((movie) => (matchesMovie(movie) ? { ...movie, ...patch } : movie));

    setMovies((previous) => patchList(previous));
    setVisibleMovies((previous) => patchList(previous));
  };

  const handleRateMovie = async (movieId, rating) => {
    const response = await fetch(
      `/api/movie-metrics/${encodeURIComponent(movieId)}/rating`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      }
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Bitte melde dich erneut an."
          : payload?.error || "Bewertung konnte nicht gespeichert werden."
      );
    }

    const nextRating = Number(payload?.metric?.rating);
    patchMovieMetric(movieId, { rating: nextRating });
    return nextRating;
  };

  const handleRecordMovieView = async (movieId) => {
    const response = await fetch(
      `/api/movie-metrics/${encodeURIComponent(movieId)}/view`,
      { method: "POST" }
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Bitte melde dich erneut an."
          : payload?.error || "Aufruf konnte nicht gespeichert werden."
      );
    }

    const nextViewCount = Math.max(0, Number(payload?.view_count) || 0);
    patchMovieMetric(movieId, { viewCount: nextViewCount });
    return nextViewCount;
  };

  const handleToggleFavorite = async (movieId, favorite) => {
    const previousMovie = movies.find(
      (movie) => String(movie.id) === String(movieId)
    );
    const previousFavorite = previousMovie?.favorite === true;
    const nextFavorite = favorite === true;

    patchMovieMetric(movieId, { favorite: nextFavorite });
    setErr(null);

    try {
      const response = await fetch(
        `/api/movie-metrics/${encodeURIComponent(movieId)}/favorite`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite: nextFavorite }),
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Bitte melde dich erneut an."
            : payload?.error || "Favorit konnte nicht gespeichert werden."
        );
      }

      const savedFavorite = payload?.metric?.is_favorite === true;
      patchMovieMetric(movieId, { favorite: savedFavorite });
      return savedFavorite;
    } catch (error) {
      patchMovieMetric(movieId, { favorite: previousFavorite });
      setErr(error?.message || "Favorit konnte nicht gespeichert werden.");
      throw error;
    }
  };

  const handleOpenMovie = (movie) => {
    if (!movie?.id) return;

    const sp = new URLSearchParams();
    sp.set("movie", String(movie.id));
    router.push(`${rootUrl}?${sp.toString()}`, { scroll: false });
    setSelectedMovieId(String(movie.id));

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  const handleCloseMovie = () => {
    setSelectedMovieId(null);

    if (selectedActor) {
      const urlVal = selectedActor.slug ? selectedActor.slug : selectedActor.id;
      router.replace(`${rootUrl}?actor=${encodeURIComponent(urlVal)}`, { scroll: false });
    } else if (viewMode === "favorites") {
      router.replace(`${rootUrl}?view=favorites`, { scroll: false });
    } else {
      router.replace(rootUrl, { scroll: false });
    }

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  return (
    <BetaExperience
        movies={movies}
        actors={actors}
        selectedActor={selectedActor}
        selectedMovie={selectedMovie}
        selectedMovieId={selectedMovieId}
        movieList={movieList}
        viewMode={viewMode}
        moviesTitle={moviesTitle}
        moviesSubtitle={moviesSubtitle}
        movieSort={movieSort}
        setMovieSort={setMovieSort}
        search={search}
        loggedIn={loggedIn}
        loading={loading}
        error={err}
        loginError={loginErr}
        loginUser={loginUser}
        loginPassword={loginPassword}
        loginLoading={loginLoading}
        setLoginUser={setLoginUser}
        setLoginPassword={setLoginPassword}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onDiscover={handleBackToActors}
        onShowActors={handleShowAllActors}
        onShowMovies={handleSwitchToMovies}
        onShowFavorites={handleShowFavorites}
        onShowActor={handleShowMoviesForActor}
        onOpenMovie={handleOpenMovie}
        onCloseMovie={handleCloseMovie}
        onRateMovie={handleRateMovie}
        onRecordMovieView={handleRecordMovieView}
        onToggleFavorite={handleToggleFavorite}
        onSearch={handleSearchChange}
        onDashboard={() => safeOpen("/dashboard")}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        hasAnyFilter={hasAnyFilter}
        onApplyFilters={applyFiltersNow}
        onResetFilters={resetFilters}
        allTags={allTags}
        allStudios={allStudios}
        allResolutions={allResolutions}
        mainActorOptions={mainActorOptions}
        supportingActorOptions={supportingActorOptions}
        selectedTags={selectedTags}
        selectedStudio={selectedStudio}
        selectedResolution={selectedResolution}
        yearFrom={yearFrom}
        yearTo={yearTo}
        selectedMainActors={selectedMainActors}
        selectedSupportingActors={selectedSupportingActors}
        setSelectedStudio={setSelectedStudio}
        setSelectedResolution={setSelectedResolution}
        setYearFrom={setYearFrom}
        setYearTo={setYearTo}
        onToggleTag={toggleTag}
        onToggleMainActor={toggleMainActor}
        onToggleSupportingActor={toggleSupportingActor}
    />
  );
}
