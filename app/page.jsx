"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient"; // app/page.jsx -> ../lib/supabaseClient

function Pill({ children }) {
  return <span className="pill">{children}</span>;
}

function EmptyState({ title, subtitle, action }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {subtitle ? <div className="empty__sub">{subtitle}</div> : null}
      {action ? <div className="empty__cta">{action}</div> : null}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="skRow" aria-hidden="true">
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
    </div>
  );
}

function safeOpen(url) {
  if (!url) return;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}

function includesLoose(hay, needle) {
  return String(hay || "")
    .toLowerCase()
    .includes(String(needle || "").toLowerCase());
}

function AutoFitTitle({ children, min = 10, max = 14 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      let size = max;
      el.style.fontSize = `${size}px`;

      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };

    const raf = requestAnimationFrame(fit);

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => fit());
      ro.observe(el);
    } else {
      window.addEventListener("resize", fit);
    }

    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", fit);
    };
  }, [children, min, max]);

  return (
    <div ref={ref} className="card__title" title={children}>
      {children}
    </div>
  );
}

function FilterSection({
  title,
  subtitle,
  items,
  selectedKeys,
  getKey,
  getLabel,
  onToggle,
  search,
  setSearch,
  showSelectedOnly,
  setShowSelectedOnly,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedSet = useMemo(
    () => new Set(selectedKeys.map(String)),
    [selectedKeys]
  );

  const filtered = useMemo(() => {
    const base = items || [];
    let list = base;

    if (showSelectedOnly)
      list = list.filter((it) => selectedSet.has(String(getKey(it))));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => includesLoose(getLabel(it), q));
    }

    return list;
  }, [items, showSelectedOnly, selectedSet, search, getKey, getLabel]);

  return (
    <div className="fsec">
      <button
        type="button"
        className="fsec__head"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="fsec__headL">
          <div className="fsec__title">{title}</div>
          <div className="fsec__sub">
            {subtitle ? (
              <>
                {subtitle} • <span className="mono">{selectedKeys.length}</span>{" "}
                aktiv
              </>
            ) : (
              <>
                <span className="mono">{selectedKeys.length}</span> aktiv
              </>
            )}
          </div>
        </div>
        <div className="fsec__headR">
          <span className="fsec__chev">{open ? "—" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="fsec__body">
          <div className="fsec__tools">
            <div className="fsearch">
              <svg
                className="fsearch__icon"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M16.5 16.5 21 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen…"
              />
              {search ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => setSearch("")}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
              />
              <span>Nur Auswahl</span>
            </label>
          </div>

          {selectedKeys.length > 0 ? (
            <div className="chipsRow">
              {selectedKeys.slice(0, 14).map((k) => {
                const it = items.find((x) => String(getKey(x)) === String(k));
                const label = it ? getLabel(it) : String(k);
                return (
                  <button
                    key={`sel-${title}-${k}`}
                    type="button"
                    className={`selChip`}
                    onClick={() => onToggle(k)}
                    title="Entfernen"
                  >
                    <span className="selChip__dot" />
                    <span className="selChip__txt">{label}</span>
                    <span className="selChip__x">×</span>
                  </button>
                );
              })}
              {selectedKeys.length > 14 ? (
                <Pill>+{selectedKeys.length - 14}</Pill>
              ) : null}
            </div>
          ) : null}

          <div className="pickList">
            {filtered.length === 0 ? (
              <div className="pickEmpty">Keine Treffer</div>
            ) : (
              filtered.map((it) => {
                const key = String(getKey(it));
                const active = selectedSet.has(key);
                return (
                  <button
                    key={`${title}-${key}`}
                    type="button"
                    className={`pick ${active ? "pick--on" : ""}`}
                    onClick={() => onToggle(key)}
                    title={getLabel(it)}
                  >
                    <span className="pick__dot" />
                    <span className="pick__txt">{getLabel(it)}</span>
                    <span className="pick__state">{active ? "ON" : ""}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getResolutionIcon(resolutionName) {
  const r = String(resolutionName || "").trim().toLowerCase();
  if (!r) return null;

  if (r === "4k" || r.includes("4k"))
    return { src: "/4k.svg", alt: "4K", title: "4K" };
  if (
    r === "fullhd" ||
    r === "full hd" ||
    r.includes("fullhd") ||
    r.includes("full hd")
  ) {
    return { src: "/fullhd.svg", alt: "FullHD", title: "FullHD" };
  }
  if (r === "retro" || r.includes("retro"))
    return { src: "/retro.svg", alt: "Retro", title: "Retro" };

  return null;
}

export default function HomePage() {
  const router = useRouter();

  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [viewMode, setViewMode] = useState("actors"); // "actors" | "movies"
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [moviesTitle, setMoviesTitle] = useState("Filme");
  const [moviesSubtitle, setMoviesSubtitle] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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

  const [tagSearch, setTagSearch] = useState("");
  const [mainActorSearch, setMainActorSearch] = useState("");
  const [suppActorSearch, setSuppActorSearch] = useState("");

  const [tagsSelectedOnly, setTagsSelectedOnly] = useState(false);
  const [mainSelectedOnly, setMainSelectedOnly] = useState(false);
  const [suppSelectedOnly, setSuppSelectedOnly] = useState(false);

  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

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
    if (!filtersOpen && !mobileSearchOpen) return;

    const onDown = (e) => {
      if (mobileSearchOpen) {
        const panel = document.querySelector(".mSearch__panel");
        if (panel && panel.contains(e.target)) return;
        setMobileSearchOpen(false);
        setFiltersOpen(false);
        return;
      }

      const root = searchWrapRef.current;
      if (!root) return;
      if (!root.contains(e.target)) setFiltersOpen(false);
    };

    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);

    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [filtersOpen, mobileSearchOpen]);

  useEffect(() => {
    if (!mobileSearchOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setFiltersOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSearchOpen]);

  useEffect(() => {
    if (!loggedIn) {
      setMovies([]);
      setActors([]);
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
        ] = await Promise.all([
          supabase.from("movies").select("*"),
          supabase.from("actors").select("*"),
          supabase.from("actors2").select("*"),
          supabase.from("studios").select("*"),
          supabase.from("tags").select("*"),
          supabase.from("resolutions").select("*"),
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

        const mainActorById = Object.fromEntries(
          mainActors.map((a) => [a.id, a])
        );
        const supportActorById = Object.fromEntries(
          supportActors.map((a) => [a.id, a])
        );
        const studioMap = Object.fromEntries(studios.map((s) => [s.id, s.name]));
        const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.name]));
        const resolutionMap = Object.fromEntries(
          resolutions.map((r) => [r.id, r.name])
        );

        const mappedMovies = (moviesData || []).map((m) => {
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
            ? m.tag_ids.map((id) => tagMap[id]).filter(Boolean)
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
            actors: allActors,
            tags: tagNames,
            mainActorIds: mainIds,
            mainActorNames: mainNames,
            supportingActorNames: supportNames,
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
            name: a.name,
            profileImage: a.profile_image || null,
            movieCount: movieCountByActorId.get(a.id) || 0,
          }))
          .filter((a) => a.movieCount > 0)
          .sort((a, b) =>
            a.name.localeCompare(b.name, "de", { sensitivity: "base" })
          );

        setActors(actorList);

        // Restore view from URL
        let actorParam = null;
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search || "");
          actorParam = sp.get("actor");
        }

        if (actorParam) {
          const actorId = Number(actorParam);
          const actor = actorList.find((a) => a.id === actorId);

          if (actor) {
            const subset = mappedMovies.filter(
              (movie) =>
                Array.isArray(movie.mainActorIds) &&
                movie.mainActorIds.includes(actor.id)
            );

            setMoviesTitle(actor.name);
            setMoviesSubtitle(`${subset.length} Film(e)`);
            setVisibleMovies(subset);
            setViewMode("movies");
          } else {
            setViewMode("actors");
            setVisibleMovies([]);
            setMoviesTitle("Filme");
            setMoviesSubtitle("");
          }
        } else {
          setViewMode("actors");
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
  }, [loggedIn]);

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

  const showMovies = viewMode === "movies";
  const movieList = showMovies ? visibleMovies : [];

  const handleShowMoviesForActor = (actorId, actorName) => {
    router.replace(`/?actor=${encodeURIComponent(actorId)}`, { scroll: false });

    const subset = movies.filter(
      (movie) =>
        Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId)
    );
    const filtered = applyAdvancedFilters(subset);
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
        setViewMode("movies");
      } else {
        router.replace("/", { scroll: false });
        setViewMode("actors");
        setVisibleMovies([]);
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
      }
      return;
    }

    router.replace("/", { scroll: false });

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
    setMoviesTitle(`Suchergebnis für "${trimmed}"`);
    setMoviesSubtitle(`${filtered.length} Treffer`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const handleBackToActors = () => {
    router.replace("/", { scroll: false });
    setViewMode("actors");
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
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
    router.replace("/", { scroll: false });
    setLoggedIn(false);
    setSearch("");
    setViewMode("actors");
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
    setFiltersOpen(false);
    setMobileSearchOpen(false);
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedStudio("");
    setSelectedResolution("");
    setYearFrom("");
    setYearTo("");
    setSelectedMainActors([]);
    setSelectedSupportingActors([]);

    setTagSearch("");
    setMainActorSearch("");
    setSuppActorSearch("");
    setTagsSelectedOnly(false);
    setMainSelectedOnly(false);
    setSuppSelectedOnly(false);
  };

  const applyFiltersNow = () => {
    if (search.trim()) handleSearchChange(search);
    else {
      router.replace("/", { scroll: false });
      const filtered = applyAdvancedFilters(movies);
      setViewMode("movies");
      setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
      setMoviesSubtitle(`${filtered.length} Treffer`);
      setVisibleMovies(filtered);
    }

    setFiltersOpen(false);
    setMobileSearchOpen(false);
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

  const tagItems = useMemo(
    () => allTags.map((t) => ({ key: t, label: t })),
    [allTags]
  );
  const mainItems = useMemo(
    () => mainActorOptions.map((a) => ({ key: String(a.id), label: a.name })),
    [mainActorOptions]
  );
  const suppItems = useMemo(
    () => supportingActorOptions.map((n) => ({ key: n, label: n })),
    [supportingActorOptions]
  );

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setFiltersOpen(true);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setFiltersOpen(false);
  };

  return (
    <div className="nfx">
      <style jsx global>{`
        :root {
          --bg: #0b0b0f;
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.68);
          --muted2: rgba(255, 255, 255, 0.52);
          --accent: #e50914;
          --shadow: rgba(0, 0, 0, 0.55);
          --menuBg: #111218;
        }

        html,
        body {
          background: var(--bg);
          color: var(--text);
        }
        * {
          box-sizing: border-box;
        }
        .mono {
          font-variant-numeric: tabular-nums;
        }

        .nfx {
          min-height: 100vh;
          background: radial-gradient(
              1200px 700px at 15% 15%,
              rgba(229, 9, 20, 0.25),
              transparent 55%
            ),
            radial-gradient(
              900px 600px at 85% 10%,
              rgba(255, 255, 255, 0.08),
              transparent 55%
            ),
            radial-gradient(
              900px 700px at 60% 80%,
              rgba(255, 255, 255, 0.06),
              transparent 60%
            ),
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.65),
              rgba(0, 0, 0, 0.95)
            );
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 10px 18px;
          display: grid;
          grid-template-columns: 1fr minmax(0, 860px) 1fr;
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .topbar__mid {
          justify-self: center;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .topbar__right {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .input {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 10px 14px;
          transition: border-color 0.18s ease, background 0.18s ease;
        }
        .input:focus-within {
          border-color: rgba(229, 9, 20, 0.55);
          background: rgba(255, 255, 255, 0.08);
        }
        .input__icon {
          width: 16px;
          height: 16px;
          opacity: 0.8;
        }
        .input input {
          width: 100%;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 14px;
        }
        .input input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
          white-space: nowrap;
        }
        .btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .btn:active {
          transform: translateY(0px);
        }
        .btn--primary {
          background: linear-gradient(
            180deg,
            rgba(229, 9, 20, 0.95),
            rgba(229, 9, 20, 0.78)
          );
          border-color: rgba(229, 9, 20, 0.6);
          box-shadow: 0 18px 36px rgba(229, 9, 20, 0.22);
        }
        .btn--primary:hover {
          background: linear-gradient(
            180deg,
            rgba(255, 21, 33, 0.95),
            rgba(229, 9, 20, 0.8)
          );
          border-color: rgba(255, 21, 33, 0.65);
        }
        .btn--ghost {
          background: transparent;
        }
        .btn--danger {
          border-color: rgba(229, 9, 20, 0.35);
        }
        .btn--xs {
          padding: 6px 10px;
          border-radius: 10px;
          font-size: 12px;
        }

        .auth__label {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 700;
          font-size: 13px;
        }

        .searchWrap {
          position: relative;
          width: 100%;
          max-width: 860px;
          display: grid;
          gap: 10px;
        }

        .filterPopover {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          z-index: 2000;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.92);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }

        .filterPopover__head {
          padding: 12px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .filterPopover__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .filterPopover__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .filterPopover__body {
          padding: 12px;
          max-height: min(70vh, 640px);
          overflow: auto;
        }

        .wrap {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 18px 70px;
        }

        .logoSolo {
          margin-top: 22px;
          display: flex;
          justify-content: center;
        }
        .logoSolo__img {
          width: min(260px, 65%);
          height: auto;
          display: block;
          opacity: 0.95;
          filter: drop-shadow(0 18px 55px rgba(0, 0, 0, 0.55));
        }

        .sectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin: 22px 2px 12px;
        }
        .sectionTitle {
          font-size: 18px;
          font-weight: 850;
          letter-spacing: -0.01em;
        }
        .sectionMeta {
          color: var(--muted2);
          font-size: 13px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          font-weight: 650;
        }

        .row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .card {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          transition: transform 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .card__img {
          position: relative;
          width: 100%;
          aspect-ratio: 3/4;
          background: rgba(255, 255, 255, 0.06);
          overflow: hidden;
        }
        .card__img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scale(1.02);
        }

        .card__badge {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(0, 0, 0, 0.55);
          color: rgba(255, 255, 255, 0.92);
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          backdrop-filter: blur(10px);
        }

        .card__body {
          padding: 8px 10px 10px;
        }
        .card__title {
          font-weight: 600;
          font-size: 14px; /* Startgröße */
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin: 0;
          text-align: center;

          white-space: nowrap;
          overflow: hidden;
          min-height: 18px;
        }

        .movieGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        /* ... Rest deiner CSS bleibt unverändert ... */

      `}</style>

      <div className="topbar">
        <div className="topbar__left" />

        <div className="topbar__mid">
          {loggedIn ? (
            <div className="searchWrap" ref={searchWrapRef}>
              <div
                className="input"
                title="Suche nach Titel, Studio, Darsteller, Tags"
              >
                <svg
                  className="input__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.5 16.5 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setFiltersOpen(true)}
                  placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                  autoComplete="off"
                />

                {search ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => handleSearchChange("")}
                    title="Suche löschen"
                  >
                    Reset
                  </button>
                ) : null}
              </div>

              {/* ... Rest unverändert ... */}
            </div>
          ) : null}
        </div>

        {/* ... Rest unverändert ... */}
      </div>

      <div className="wrap">
        <div className="logoSolo">
          <img className="logoSolo__img" src="/logo.png" alt="Project1337 Logo" />
        </div>

        {/* ... Rest unverändert ... */}

        {showMovies ? (
          <>
            {/* ... Movie View unverändert ... */}
          </>
        ) : (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">Hauptdarsteller</div>
                <div className="sectionMeta">{actors.length} Darsteller</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    router.replace("/", { scroll: false });
                    const filtered = applyAdvancedFilters(movies);
                    setViewMode("movies");
                    setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
                    setMoviesSubtitle(`${filtered.length} Film(e)`);
                    setVisibleMovies(filtered);
                  }}
                  title="Alle Filme anzeigen"
                >
                  Filme
                </button>
              </div>
            </div>

            {actors.length === 0 ? (
              <EmptyState
                title="Keine Hauptdarsteller verfügbar"
                subtitle="Entweder sind noch keine Filme mit main_actor_ids hinterlegt oder es fehlen Datensätze."
              />
            ) : (
              <div className="row">
                {actors.map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    onClick={() => handleShowMoviesForActor(a.id, a.name)}
                    title={`${a.name} öffnen`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleShowMoviesForActor(a.id, a.name);
                    }}
                  >
                    <div className="card__img">
                      {a.profileImage ? (
                        <img src={a.profileImage} alt={a.name} />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: "rgba(255,255,255,0.55)",
                            fontWeight: 800,
                            letterSpacing: "0.02em",
                          }}
                        >
                          NO IMAGE
                        </div>
                      )}

                      <div className="card__badge">{a.movieCount}</div>
                    </div>

                    <div className="card__body">
                      <AutoFitTitle>{a.name}</AutoFitTitle>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
