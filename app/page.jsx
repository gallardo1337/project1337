"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // FIX: app/page.jsx -> ../lib/supabaseClient

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

/**
 * AutoFitTitle
 * - immer 1 Zeile
 * - keine Ellipsis / kein Cut
 * - Schrift wird verkleinert, bis es passt (minSize)
 * - reagiert auch auf Resizes (ResizeObserver)
 */
function AutoFitTitle({
  text,
  maxSize = 16,
  minSize = 11,
  step = 0.5,
  className = "",
}) {
  const elRef = useRef(null);

  const fit = () => {
    const el = elRef.current;
    if (!el) return;

    let size = maxSize;
    el.style.fontSize = `${size}px`;

    // verkleinern bis es in die Breite passt (1 Zeile)
    // Achtung: scrollWidth > clientWidth bedeutet "überläuft"
    while (size > minSize && el.scrollWidth > el.clientWidth) {
      size -= step;
      el.style.fontSize = `${size}px`;
    }
  };

  useLayoutEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxSize, minSize, step]);

  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => fit());
    ro.observe(el);

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxSize, minSize, step]);

  return (
    <div
      ref={elRef}
      className={className}
      title={text}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        maxWidth: "100%",
      }}
    >
      {text}
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

        const mainActorById = Object.fromEntries(mainActors.map((a) => [a.id, a]));
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

        setViewMode("actors");
        setVisibleMovies([]);
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
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
    movies.forEach((m) => (m.supportingActorNames || []).forEach((n) => set.add(n)));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const applyAdvancedFilters = (baseList) => {
    let list = baseList;

    if (selectedStudio) list = list.filter((m) => (m.studio || "") === selectedStudio);
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
        const ids = Array.isArray(m.mainActorIds) ? m.mainActorIds.map(String) : [];
        return selectedMainActors.map(String).every((id) => ids.includes(id));
      });
    }

    if (selectedSupportingActors.length > 0) {
      list = list.filter((m) => {
        const names = Array.isArray(m.supportingActorNames) ? m.supportingActorNames : [];
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
        setViewMode("actors");
        setVisibleMovies([]);
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
      }
      return;
    }

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
          res.status === 401 ? "User oder Passwort falsch." : "Login fehlgeschlagen."
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
          font-size: 14px;
          line-height: 1.4;
          letter-spacing: -0.01em;
          margin: 0;
          text-align: center;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 18px;
        }

        .movieGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .movieCard {
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          transition: transform 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;
        }
        .movieCard:hover {
          transform: translateY(-2px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }

        /* ICON unten rechts FREI (ohne eigene Box) */
        .movieCard__resIcon {
          position: absolute;
          right: 14px;
          bottom: 14px;
          width: 52px;
          height: 52px;
          z-index: 6;
          pointer-events: none;
          filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.55));
          opacity: 0.95;
        }
        .movieCard__resIcon img {
          width: 100%;
          height: 100%;
          display: block;
        }

        /* THUMBNAIL: 16:9 OHNE CROPPING */
        .movieCard__thumb {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
          display: grid;
          place-items: center;
        }
        .movieCard__thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain; /* WICHTIG: kein Schnitt */
          display: block;
          transform: none;
        }

        .movieCard__top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }

        /* WICHTIG: kein font-size hier, AutoFitTitle steuert das */
        .movieCard__title {
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.15;
          max-width: 100%;
        }

        .movieCard__year {
          color: rgba(255, 255, 255, 0.62);
          font-weight: 800;
          font-size: 13px;
          white-space: nowrap;
        }
        .movieCard__meta {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }
        .kv {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 10px;
          align-items: start;
        }
        .kv__k {
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .kv__v {
          color: rgba(255, 255, 255, 0.84);
          font-size: 13px;
          line-height: 1.35;
        }
        .movieCard__actions {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .authForm {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .authField {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 8px 10px;
        }
        .authField input {
          width: 130px;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 13px;
        }

        .errorBanner {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.1);
          color: rgba(255, 255, 255, 0.88);
        }

        .empty {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        }
        .empty__title {
          font-weight: 900;
          font-size: 16px;
          margin-bottom: 6px;
        }
        .empty__sub {
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          line-height: 1.45;
        }
        .empty__cta {
          margin-top: 12px;
        }

        .skRow {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .skCard {
          border-radius: 16px;
          aspect-ratio: 3/4;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.05)
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }

        .filterGrid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .filterGrid {
            grid-template-columns: 1fr;
          }
        }
        .fieldLabel {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .select {
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.92);
          border-radius: 12px;
          padding: 10px 12px;
          outline: none;
        }
        .select option {
          background: var(--menuBg);
          color: rgba(255, 255, 255, 0.92);
        }

        .yearRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .fsec {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          overflow: hidden;
        }
        .fsec__head {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px;
          background: rgba(0, 0, 0, 0.25);
          border: none;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .fsec__head:hover {
          background: rgba(0, 0, 0, 0.32);
        }
        .fsec__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .fsec__sub {
          margin-top: 2px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
        }
        .fsec__chev {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          font-weight: 900;
        }
        .fsec__body {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .fsec__tools {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .fsearch {
          flex: 1;
          min-width: 220px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 8px 10px;
        }
        .fsearch__icon {
          width: 16px;
          height: 16px;
          opacity: 0.75;
        }
        .fsearch input {
          width: 100%;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 13px;
        }
        .fsearch input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 700;
          user-select: none;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }
        .toggle input {
          accent-color: var(--accent);
        }

        .chipsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .selChip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(229, 9, 20, 0.28);
          background: rgba(229, 9, 20, 0.1);
          color: rgba(255, 255, 255, 0.88);
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
        }
        .selChip:hover {
          border-color: rgba(229, 9, 20, 0.4);
          background: rgba(229, 9, 20, 0.14);
        }
        .selChip__dot {
          width: 7px;
          height: 7px;
          border-radius: 99px;
          background: var(--accent);
        }
        .selChip__txt {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .selChip__x {
          opacity: 0.9;
          font-size: 14px;
          line-height: 1;
        }

        .pickList {
          max-height: 260px;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.22);
          padding: 6px;
        }
        .pickList::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .pickList::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }
        .pick {
          width: 100%;
          display: grid;
          grid-template-columns: 14px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .pick:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .pick--on {
          background: rgba(229, 9, 20, 0.1);
          border-color: rgba(229, 9, 20, 0.22);
        }
        .pick__dot {
          width: 10px;
          height: 10px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.25);
        }
        .pick--on .pick__dot {
          background: var(--accent);
          box-shadow: 0 0 0 6px rgba(229, 9, 20, 0.12);
        }
        .pick__txt {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.88);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pick__state {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.55);
        }
        .pick--on .pick__state {
          color: rgba(255, 255, 255, 0.8);
        }
        .pickEmpty {
          padding: 14px 10px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 10px 0;
        }

        .iconBtn {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
        }
        .iconBtn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .iconBtn svg {
          width: 18px;
          height: 18px;
          opacity: 0.9;
        }
        .iconBtn.mOnly {
          display: none;
        }

        .mSearch {
          position: fixed;
          inset: 0;
          z-index: 5000;
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(10px);
          display: grid;
          align-items: start;
          justify-items: center;
          padding: 14px 12px;
        }
        .mSearch__panel {
          width: min(860px, 100%);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.94);
          box-shadow: 0 50px 140px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }
        .mSearch__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .mSearch__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .mSearch__body {
          padding: 12px;
        }
        .mSearch .filterPopover {
          position: static;
          margin-top: 10px;
        }

        @media (max-width: 1200px) {
          .row {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 700px) {
          .row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: 1fr;
          }

          .topbar {
            grid-template-columns: 1fr auto;
          }
          .topbar__mid {
            display: none;
          }
          .iconBtn.mOnly {
            display: inline-grid;
          }
        }
        @media (max-width: 420px) {
          .row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <div className="topbar">
        <div className="topbar__left" />

        <div className="topbar__mid">
          {loggedIn ? (
            <div className="searchWrap" ref={searchWrapRef}>
              <div className="input" title="Suche nach Titel, Studio, Darsteller, Tags">
                <svg className="input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
                  <button type="button" className="btn btn--ghost" onClick={() => handleSearchChange("")} title="Suche löschen">
                    Reset
                  </button>
                ) : null}
              </div>

              {filtersOpen && (
                <div
                  className="filterPopover"
                  role="dialog"
                  aria-modal="false"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div className="filterPopover__head">
                    <div className="filterPopover__title">Filter</div>
                    <div className="filterPopover__actions">
                      <button type="button" className="btn" onClick={resetFilters}>
                        Reset
                      </button>
                      <button type="button" className="btn btn--primary" onClick={applyFiltersNow}>
                        Anwenden
                      </button>
                      <button type="button" className="btn btn--ghost" onClick={() => setFiltersOpen(false)}>
                        Schließen
                      </button>
                    </div>
                  </div>

                  <div className="filterPopover__body">
                    <div className="filterGrid">
                      <div style={{ display: "grid", gap: 12 }}>
                        <FilterSection
                          title="Tags"
                          subtitle=""
                          items={tagItems}
                          selectedKeys={selectedTags}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleTag(String(k))}
                          search={tagSearch}
                          setSearch={setTagSearch}
                          showSelectedOnly={tagsSelectedOnly}
                          setShowSelectedOnly={setTagsSelectedOnly}
                          defaultOpen={true}
                        />

                        <FilterSection
                          title="Hauptdarsteller"
                          subtitle=""
                          items={mainItems}
                          selectedKeys={selectedMainActors}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleMainActor(String(k))}
                          search={mainActorSearch}
                          setSearch={setMainActorSearch}
                          showSelectedOnly={mainSelectedOnly}
                          setShowSelectedOnly={setMainSelectedOnly}
                          defaultOpen={false}
                        />

                        <FilterSection
                          title="Nebendarsteller"
                          subtitle=""
                          items={suppItems}
                          selectedKeys={selectedSupportingActors}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleSupportingActor(String(k))}
                          search={suppActorSearch}
                          setSearch={setSuppActorSearch}
                          showSelectedOnly={suppSelectedOnly}
                          setShowSelectedOnly={setSuppSelectedOnly}
                          defaultOpen={false}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        <div className="fsec">
                          <div className="fsec__head" style={{ cursor: "default" }}>
                            <div className="fsec__headL">
                              <div className="fsec__title">Basis</div>
                              <div className="fsec__sub">Studio, Resolution & Jahr</div>
                            </div>
                            <div className="fsec__headR">
                              <span className="fsec__chev" style={{ opacity: 0.35 }}>
                                ✓
                              </span>
                            </div>
                          </div>

                          <div className="fsec__body">
                            <div>
                              <div className="fieldLabel">Studio</div>
                              <select className="select" value={selectedStudio} onChange={(e) => setSelectedStudio(e.target.value)}>
                                <option value="">Alle Studios</option>
                                {allStudios.map((s) => (
                                  <option key={`st-${s}`} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="fieldLabel">Resolution</div>
                              <select className="select" value={selectedResolution} onChange={(e) => setSelectedResolution(e.target.value)}>
                                <option value="">Alle Resolutions</option>
                                {allResolutions.map((r) => (
                                  <option key={`rs-${r}`} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="fieldLabel">Jahr</div>
                              <div className="yearRow">
                                <input
                                  className="select"
                                  value={yearFrom}
                                  onChange={(e) => setYearFrom(e.target.value)}
                                  placeholder="von (z.B. 1999)"
                                  inputMode="numeric"
                                />
                                <input
                                  className="select"
                                  value={yearTo}
                                  onChange={(e) => setYearTo(e.target.value)}
                                  placeholder="bis (z.B. 2025)"
                                  inputMode="numeric"
                                />
                              </div>
                            </div>

                            {hasAnyFilter ? (
                              <>
                                <div className="divider" />
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div className="fieldLabel">Aktiv</div>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {selectedStudio ? <Pill>Studio</Pill> : null}
                                    {selectedResolution ? <Pill>{selectedResolution}</Pill> : null}
                                    {yearFrom ? <Pill>ab {yearFrom}</Pill> : null}
                                    {yearTo ? <Pill>bis {yearTo}</Pill> : null}
                                    {selectedTags.length ? <Pill>{selectedTags.length} Tags</Pill> : null}
                                    {selectedMainActors.length ? <Pill>{selectedMainActors.length} Haupt</Pill> : null}
                                    {selectedSupportingActors.length ? <Pill>{selectedSupportingActors.length} Neben</Pill> : null}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="topbar__right">
          {loggedIn ? (
            <>
              <button type="button" className="iconBtn mOnly" onClick={openMobileSearch} title="Suche">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              <div className="auth__label">Willkommen, {loginUser}</div>

              <button type="button" className="btn" onClick={() => safeOpen("/dashboard")} title="Zum Dashboard">
                Dashboard
              </button>

              <button type="button" className="btn btn--danger" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <form className="authForm" onSubmit={handleLogin}>
              <div className="authField">
                <input value={loginUser} onChange={(e) => setLoginUser(e.target.value)} placeholder="User" autoComplete="username" />
              </div>
              <div className="authField">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Passwort"
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn--primary" disabled={loginLoading}>
                {loginLoading ? "Login…" : "Login"}
              </button>
            </form>
          )}
        </div>
      </div>

      {loggedIn && mobileSearchOpen ? (
        <div className="mSearch" role="dialog" aria-modal="true" onMouseDown={closeMobileSearch} onTouchStart={closeMobileSearch}>
          <div className="mSearch__panel" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <div className="mSearch__head">
              <div className="mSearch__title">Suche</div>
              <button type="button" className="btn btn--ghost" onClick={closeMobileSearch}>
                Schließen
              </button>
            </div>

            <div className="mSearch__body">
              <div className="searchWrap">
                <div className="input" title="Suche nach Titel, Studio, Darsteller, Tags">
                  <svg className="input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>

                  <input
                    ref={mobileSearchInputRef}
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => setFiltersOpen(true)}
                    placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                    autoComplete="off"
                  />

                  {search ? (
                    <button type="button" className="btn btn--ghost" onClick={() => handleSearchChange("")} title="Suche löschen">
                      Reset
                    </button>
                  ) : null}
                </div>

                {filtersOpen && (
                  <div
                    className="filterPopover"
                    role="dialog"
                    aria-modal="false"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <div className="filterPopover__head">
                      <div className="filterPopover__title">Filter</div>
                      <div className="filterPopover__actions">
                        <button type="button" className="btn" onClick={resetFilters}>
                          Reset
                        </button>
                        <button type="button" className="btn btn--primary" onClick={applyFiltersNow}>
                          Anwenden
                        </button>
                        <button type="button" className="btn btn--ghost" onClick={() => setFiltersOpen(false)}>
                          Schließen
                        </button>
                      </div>
                    </div>

                    <div className="filterPopover__body">
                      <div className="filterGrid">
                        <div style={{ display: "grid", gap: 12 }}>
                          <FilterSection
                            title="Tags"
                            subtitle=""
                            items={tagItems}
                            selectedKeys={selectedTags}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleTag(String(k))}
                            search={tagSearch}
                            setSearch={setTagSearch}
                            showSelectedOnly={tagsSelectedOnly}
                            setShowSelectedOnly={setTagsSelectedOnly}
                            defaultOpen={true}
                          />

                          <FilterSection
                            title="Hauptdarsteller"
                            subtitle=""
                            items={mainItems}
                            selectedKeys={selectedMainActors}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleMainActor(String(k))}
                            search={mainActorSearch}
                            setSearch={setMainActorSearch}
                            showSelectedOnly={mainSelectedOnly}
                            setShowSelectedOnly={setMainSelectedOnly}
                            defaultOpen={false}
                          />

                          <FilterSection
                            title="Nebendarsteller"
                            subtitle=""
                            items={suppItems}
                            selectedKeys={selectedSupportingActors}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleSupportingActor(String(k))}
                            search={suppActorSearch}
                            setSearch={setSuppActorSearch}
                            showSelectedOnly={suppSelectedOnly}
                            setShowSelectedOnly={setSuppSelectedOnly}
                            defaultOpen={false}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 12 }}>
                          <div className="fsec">
                            <div className="fsec__head" style={{ cursor: "default" }}>
                              <div className="fsec__headL">
                                <div className="fsec__title">Basis</div>
                                <div className="fsec__sub">Studio, Resolution & Jahr</div>
                              </div>
                              <div className="fsec__headR">
                                <span className="fsec__chev" style={{ opacity: 0.35 }}>
                                  ✓
                                </span>
                              </div>
                            </div>

                            <div className="fsec__body">
                              <div>
                                <div className="fieldLabel">Studio</div>
                                <select className="select" value={selectedStudio} onChange={(e) => setSelectedStudio(e.target.value)}>
                                  <option value="">Alle Studios</option>
                                  {allStudios.map((s) => (
                                    <option key={`st-${s}`} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="fieldLabel">Resolution</div>
                                <select className="select" value={selectedResolution} onChange={(e) => setSelectedResolution(e.target.value)}>
                                  <option value="">Alle Resolutions</option>
                                  {allResolutions.map((r) => (
                                    <option key={`rs-${r}`} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="fieldLabel">Jahr</div>
                                <div className="yearRow">
                                  <input
                                    className="select"
                                    value={yearFrom}
                                    onChange={(e) => setYearFrom(e.target.value)}
                                    placeholder="von (z.B. 1999)"
                                    inputMode="numeric"
                                  />
                                  <input
                                    className="select"
                                    value={yearTo}
                                    onChange={(e) => setYearTo(e.target.value)}
                                    placeholder="bis (z.B. 2025)"
                                    inputMode="numeric"
                                  />
                                </div>
                              </div>

                              {hasAnyFilter ? (
                                <>
                                  <div className="divider" />
                                  <div style={{ display: "grid", gap: 8 }}>
                                    <div className="fieldLabel">Aktiv</div>
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                      {selectedStudio ? <Pill>Studio</Pill> : null}
                                      {selectedResolution ? <Pill>{selectedResolution}</Pill> : null}
                                      {yearFrom ? <Pill>ab {yearFrom}</Pill> : null}
                                      {yearTo ? <Pill>bis {yearTo}</Pill> : null}
                                      {selectedTags.length ? <Pill>{selectedTags.length} Tags</Pill> : null}
                                      {selectedMainActors.length ? <Pill>{selectedMainActors.length} Haupt</Pill> : null}
                                      {selectedSupportingActors.length ? <Pill>{selectedSupportingActors.length} Neben</Pill> : null}
                                    </div>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="wrap">
        <div className="logoSolo">
          <img className="logoSolo__img" src="/logo.png" alt="Project1337 Logo" />
        </div>

        {loginErr ? <div className="errorBanner">{loginErr}</div> : null}
        {err ? <div className="errorBanner">{err}</div> : null}

        {!loggedIn ? (
          <EmptyState
            title="Bitte einloggen"
            subtitle="Ohne Login werden keine Inhalte geladen. Logge dich oben rechts ein, um Darsteller und Filme zu sehen."
            action={<Pill>Project1337 • Private Library</Pill>}
          />
        ) : loading ? (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">Lade Inhalte…</div>
                <div className="sectionMeta">Supabase-Abfragen werden ausgeführt.</div>
              </div>
              <Pill>Bitte warten</Pill>
            </div>
            <SkeletonRow />
            <div style={{ height: 16 }} />
            <SkeletonRow />
          </>
        ) : showMovies ? (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">{moviesTitle}</div>
                <div className="sectionMeta">{moviesSubtitle || `${movieList.length} Film(e)`}</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={handleBackToActors}>
                  Darsteller
                </button>
              </div>
            </div>

            {movieList.length === 0 ? (
              <EmptyState title="Keine Filme gefunden" subtitle="Passe Suche/Filter an oder gehe zurück zur Darsteller-Ansicht." />
            ) : (
              <div className="movieGrid">
                {movieList.map((m) => {
                  const icon = getResolutionIcon(m.resolution);
                  return (
                    <div key={m.id} className="movieCard">
                      {icon ? (
                        <div className="movieCard__resIcon" title={icon.title} aria-label={icon.title}>
                          <img src={icon.src} alt={icon.alt} />
                        </div>
                      ) : null}

                      {m.thumbnailUrl ? (
                        <div className="movieCard__thumb" title="Thumbnail">
                          <img src={m.thumbnailUrl} alt={m.title || "Thumbnail"} loading="lazy" />
                        </div>
                      ) : null}

                      <div className="movieCard__top">
                        <AutoFitTitle text={m.title || "Unbenannt"} className="movieCard__title" maxSize={16} minSize={11} step={0.5} />
                        <div className="movieCard__year">{m.year || ""}</div>
                      </div>

                      <div className="movieCard__meta">
                        <div className="kv">
                          <div className="kv__k">Studio</div>
                          <div className="kv__v">{m.studio || "-"}</div>
                        </div>

                        <div className="kv">
                          <div className="kv__k">Darsteller</div>
                          <div className="kv__v">{m.actors && m.actors.length ? m.actors.join(", ") : "-"}</div>
                        </div>

                        <div className="kv">
                          <div className="kv__k">Tags</div>
                          <div className="kv__v">{m.tags && m.tags.length ? m.tags.join(", ") : "-"}</div>
                        </div>
                      </div>

                      <div className="movieCard__actions">
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => safeOpen(m.fileUrl)}
                          title="Film starten"
                          disabled={!m.fileUrl}
                          style={!m.fileUrl ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                        >
                          Play
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                      if (e.key === "Enter" || e.key === " ") handleShowMoviesForActor(a.id, a.name);
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
                      <div className="card__title">{a.name}</div>
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
