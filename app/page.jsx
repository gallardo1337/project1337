"use client";

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ------------------------------ TEIL 1: IMPORTS --------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* --------------------- TEIL 2: HEADER / DOKU KOMMENTAR --------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

/**
 * app/page.jsx
 * - Changelog komplett entfernt
 * - Erweiterte Suche klappt automatisch auf, wenn die Suchleiste fokussiert wird
 * - Fokus-Bug gefixt: In der erweiterten Suche kann man jetzt ganz normal in alle Felder klicken
 *   (kein erzwungener Fokus auf dem Haupt-Suchfeld)
 * - Keine Hint-/Tipptexte in den Filtern
 * - Multi-Select Logik bleibt STRICT UND (intern), aber ohne UI-Hinweise
 * - Restliche Funktionalität unverändert
 *
 * UPDATE (Mobile Fix):
 * - Auf Mobile wird die Topbar-Suche durch eine Lupe ersetzt (damit nichts in die Ecke gedrückt wird)
 * - Klick auf die Lupe öffnet ein Overlay mit Suchfeld + erweiterter Suche
 * - Overlay schließt per Klick außerhalb / Schließen-Button / ESC
 *
 * UPDATE (Resolution Filter):
 * - Resolutions werden aus Supabase Tabelle "resolutions" geladen
 * - Movie Mapping enthält resolution (Name)
 * - Basis-Filter erweitert: Resolution (Alle / 4K / FullHD / Retro .)
 * - Suche berücksichtigt Resolution ebenfalls
 * - Movie Cards zeigen Resolution
 *
 * UPDATE (Movie Thumbnails):
 * - Movie Mapping enthält thumbnailUrl (aus movies.thumbnail_url)
 * - Movie Cards zeigen Thumbnail im 16:9 Container
 * - Kein Crop: object-fit: contain (16:9 bleibt vollständig erhalten)
 */

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ------------------------ TEIL 3: MINI UI HELPERS ------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ----------------------- TEIL 4: UTILS (SAFE / SEARCH) -------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* --------------------- TEIL 5: FILTERSECTION KOMPONENTE ------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

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
  const selectedSet = useMemo(() => new Set(selectedKeys.map(String)), [selectedKeys]);

  const filtered = useMemo(() => {
    const base = items || [];
    let list = base;

    if (showSelectedOnly) list = list.filter((it) => selectedSet.has(String(getKey(it))));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => includesLoose(getLabel(it), q));
    }

    return list;
  }, [items, showSelectedOnly, selectedSet, search, getKey, getLabel]);

  return (
    <div className="fsec">
      <button type="button" className="fsec__head" onClick={() => setOpen((v) => !v)}>
        <div className="fsec__headL">
          <div className="fsec__title">{title}</div>
          <div className="fsec__sub">
            {subtitle ? (
              <>
                {subtitle} • <span className="mono">{selectedKeys.length}</span> aktiv
              </>
            ) : (
              <>
                <span className="mono">{selectedKeys.length}</span> aktiv
              </>
            )}
          </div>
        </div>
        <div className="fsec__headR">
          <span className="fsec__chev">{open ? "▾" : "▸"}</span>
        </div>
      </button>

      {open ? (
        <div className="fsec__body">
          <div className="fsec__tools">
            <div className="fsec__search">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen…"
                className="fsec__searchInput"
              />
            </div>
            <label className="fsec__toggle">
              <input type="checkbox" checked={showSelectedOnly} onChange={(e) => setShowSelectedOnly(e.target.checked)} />
              <span>Nur aktiv</span>
            </label>
          </div>

          <div className="fsec__list">
            {filtered.length === 0 ? (
              <div className="pickEmpty">Keine Treffer</div>
            ) : (
              filtered.map((it) => {
                const key = String(getKey(it));
                const active = selectedSet.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`pick ${active ? "pick--on" : ""}`}
                    onClick={() => onToggle(getKey(it))}
                    title={getLabel(it)}
                  >
                    <span className="pick__dot" />
                    <span className="pick__txt">{getLabel(it)}</span>
                    <span className="pick__state">{active ? "AN" : "AUS"}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* ----------------------------- TEIL 6: PAGE ------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export default function Page() {
  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [resolutions, setResolutions] = useState([]);

  const [viewMode, setViewMode] = useState("actors"); // "actors" | "movies"
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [moviesTitle, setMoviesTitle] = useState("Filme");
  const [moviesSubtitle, setMoviesSubtitle] = useState("");

  // Search
  const [search, setSearch] = useState("");

  // Advanced filters
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedStudio, setSelectedStudio] = useState("");
  const [selectedResolution, setSelectedResolution] = useState("");

  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedMainActors, setSelectedMainActors] = useState([]);
  const [selectedSupportingActors, setSelectedSupportingActors] = useState([]);

  const [tagSearch, setTagSearch] = useState("");
  const [mainActorSearch, setMainActorSearch] = useState("");
  const [suppActorSearch, setSuppActorSearch] = useState("");

  const [tagsSelectedOnly, setTagsSelectedOnly] = useState(false);
  const [mainSelectedOnly, setMainSelectedOnly] = useState(false);
  const [suppSelectedOnly, setSuppSelectedOnly] = useState(false);

  // Mobile search overlay
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [moviesRes, actorsRes, actors2Res, studiosRes, tagsRes, resolutionsRes] = await Promise.all([
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
        const supportActorById = Object.fromEntries(supportActors.map((a) => [a.id, a]));
        const studioMap = Object.fromEntries(studios.map((s) => [s.id, s.name]));
        const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.name]));
        const resolutionMap = Object.fromEntries(resolutions.map((r) => [r.id, r.name]));

        const mappedMovies = (moviesData || []).map((m) => {
          const mainIds = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          const supportIds = Array.isArray(m.supporting_actor_ids) ? m.supporting_actor_ids : [];

          const mainNames = mainIds.map((id) => mainActorById[id]?.name).filter(Boolean);
          const supportNames = supportIds.map((id) => supportActorById[id]?.name).filter(Boolean);

          const allActors = [...mainNames, ...supportNames];
          const tagNames = Array.isArray(m.tag_ids) ? m.tag_ids.map((id) => tagMap[id]).filter(Boolean) : [];

          const resolutionName = m.resolution_id ? resolutionMap[m.resolution_id] || null : null;

          return {
            id: m.id,
            title: m.title,
            year: m.year,
            fileUrl: m.file_url,
            thumbnailUrl: m.thumbnail_url || null,
            studio: m.studio_id ? studioMap[m.studio_id] || null : null,
            resolution: resolutionName,
            actors: allActors,
            tags: tagNames,
            mainActorIds: mainIds,
            mainActorNames: mainNames,
            supportingActorNames: supportNames,
          };
        });

        // Actors view uses only main actors (actors table)
        const mainActorsMapped = (mainActors || []).map((a) => ({
          id: a.id,
          name: a.name,
          image: a.profile_image || null,
        }));

        // Sort stable
        mainActorsMapped.sort((a, b) => (a.name || "").localeCompare(b.name || "", "de", { sensitivity: "base" }));

        setMovies(mappedMovies);
        setActors(mainActorsMapped);
        setStudios(studios.map((s) => s.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })));
        setTags(tags.map((t) => t.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })));
        setResolutions(resolutions.map((r) => r.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" })));

        setVisibleMovies([]);
        setViewMode("actors");
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
      } catch (e) {
        console.error(e);
        setErr(e?.message || "Fehler beim Laden.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [mounted]);

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.1: FILTER DATA -------------------- */
  /* ------------------------------------------------------------------------ */

  const allTags = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [movies]);

  const mainActorOptions = useMemo(() => {
    // main actors are from actors[] (actors table)
    return (actors || []).map((a) => ({ id: a.id, name: a.name }));
  }, [actors]);

  const supportingActorOptions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.supportingActorNames || []).forEach((n) => set.add(n)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [movies]);

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.2: FILTER ENGINE ------------------ */
  /* ------------------------------------------------------------------------ */

  const applyAdvancedFilters = (baseList) => {
    let list = baseList;

    if (selectedStudio) list = list.filter((m) => (m.studio || "") === selectedStudio);

    if (selectedResolution) list = list.filter((m) => (m.resolution || "") === selectedResolution);

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

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.3: ACTIONS (NAV + SEARCH) --------- */
  /* ------------------------------------------------------------------------ */

  const handleShowMoviesForActor = (actorId, actorName) => {
    const subset = movies.filter((movie) => Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId));
    const filtered = applyAdvancedFilters(subset);
    setMoviesTitle(actorName);
    setMoviesSubtitle(`${filtered.length} Film(e)`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const showAllMovies = () => {
    const filtered = applyAdvancedFilters(movies);
    setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
    setMoviesSubtitle(`${filtered.length} Treffer`);
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
        (movie.actors || []).join(" "),
        (movie.tags || []).join(" "),
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

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.4: FILTER ACTIONS ----------------- */
  /* ------------------------------------------------------------------------ */

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
    if (search.trim()) {
      handleSearchChange(search);
    } else {
      showAllMovies();
    }
    setFiltersOpen(false);
    setMobileSearchOpen(false);
  };

  const toggleTag = (t) => setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const toggleMainActor = (id) => {
    const sid = String(id);
    setSelectedMainActors((prev) => {
      const p = prev.map(String);
      return p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid];
    });
  };

  const toggleSupportingActor = (name) =>
    setSelectedSupportingActors((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.5: ITEMS FOR FILTERSECTION -------- */
  /* ------------------------------------------------------------------------ */

  const tagItems = useMemo(() => allTags.map((t) => ({ key: t, label: t })), [allTags]);
  const mainItems = useMemo(
    () => mainActorOptions.map((a) => ({ key: String(a.id), label: a.name })),
    [mainActorOptions]
  );
  const suppItems = useMemo(() => supportingActorOptions.map((n) => ({ key: n, label: n })), [supportingActorOptions]);

  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 6.6: MOBILE SEARCH OPEN ------------- */
  /* ------------------------------------------------------------------------ */

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setFiltersOpen(true);
    setTimeout(() => {
      mobileSearchInputRef.current?.focus();
    }, 0);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setFiltersOpen(false);
  };

  /* ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------ */
  /* ----------------------------- TEIL 7: RENDER --------------------------- */
  /* ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="nfx">
      {/* -------------------------------------------------------------------- */}
      {/* -------------------------- TEIL 7.1: GLOBAL STYLES ------------------ */}
      {/* -------------------------------------------------------------------- */}

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
          background: radial-gradient(1200px 700px at 15% 15%, rgba(229, 9, 20, 0.22), transparent 60%),
            radial-gradient(1200px 700px at 80% 85%, rgba(229, 9, 20, 0.16), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 28%);
          padding: 22px 14px 40px;
        }

        .topbar {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .brand {
          display: flex;
          align-items: baseline;
          gap: 10px;
          user-select: none;
        }
        .brand__logo {
          font-weight: 1000;
          letter-spacing: -0.02em;
          font-size: 20px;
        }
        .brand__tag {
          font-size: 12px;
          font-weight: 900;
          color: rgba(255, 255, 255, 0.62);
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          font-weight: 800;
        }

        /* Input */
        .input {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
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

        /* Buttons */
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
          transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;
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
          background: linear-gradient(180deg, rgba(229, 9, 20, 0.95), rgba(229, 9, 20, 0.78));
          border-color: rgba(229, 9, 20, 0.6);
          box-shadow: 0 18px 36px rgba(229, 9, 20, 0.22);
        }
        .btn--primary:hover {
          background: linear-gradient(180deg, rgba(255, 21, 33, 0.95), rgba(229, 9, 20, 0.8));
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

        /* Popover anchor */
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

        /* Layout */
        .wrap {
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }

        .sectionHead {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 6px;
        }
        .sectionTitle {
          font-size: 24px;
          font-weight: 1000;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .sectionMeta {
          margin-top: 2px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          font-weight: 700;
        }

        /* Empty state */
        .empty {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 18px;
          padding: 18px;
          text-align: center;
          box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
        }
        .empty__title {
          font-weight: 950;
          letter-spacing: -0.01em;
          font-size: 16px;
        }
        .empty__sub {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.65);
          font-size: 13px;
          line-height: 1.4;
        }
        .empty__cta {
          margin-top: 12px;
        }

        /* Skeletons */
        .skRow {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }
        .skCard {
          height: 110px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.04));
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }
        @keyframes shimmer {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: -200% 0%;
          }
        }

        /* Cards grid (Actors) */
        .grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
        }
        .card {
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }
        .card:hover {
          transform: translateY(-2px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.06);
        }
        .card__img {
          width: 100%;
          aspect-ratio: 3 / 4;
          background: rgba(255, 255, 255, 0.04);
          display: grid;
          place-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .card__img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .card__badge {
          position: absolute;
          top: 10px;
          left: 10px;
          border-radius: 999px;
          padding: 6px 10px;
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

        /* Movies */
        .movieGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .movieCard {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 14px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
        }
        .movieCard:hover {
          transform: translateY(-2px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .movieCard__thumb {
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 10px;
        }
        .movieCard__thumb img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain; /* WICHTIG: kein Crop, 16:9 bleibt erhalten */
          background: rgba(0, 0, 0, 0.35);
        }
        .movieCard__top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
        }
        .movieCard__title {
          margin: 0;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.01em;
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

        /* Filter Section */
        .fsec {
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }
        .fsec__head {
          width: 100%;
          padding: 10px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
          border: none;
          color: var(--text);
          cursor: pointer;
        }
        .fsec__title {
          font-weight: 950;
          letter-spacing: -0.01em;
        }
        .fsec__sub {
          margin-top: 2px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-weight: 700;
        }
        .fsec__chev {
          opacity: 0.75;
          font-weight: 900;
        }
        .fsec__body {
          padding: 10px 12px 12px;
          display: grid;
          gap: 10px;
        }
        .fsec__tools {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .fsec__searchInput {
          width: 260px;
          max-width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          padding: 8px 10px;
          color: rgba(255, 255, 255, 0.9);
          outline: none;
        }
        .fsec__searchInput:focus {
          border-color: rgba(229, 9, 20, 0.55);
        }
        .fsec__toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.78);
          font-weight: 800;
          font-size: 12px;
          user-select: none;
        }
        .fsec__toggle input {
          width: 14px;
          height: 14px;
        }

        .fsec__list {
          display: grid;
          gap: 8px;
        }
        .pick {
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 10px 10px;
          display: grid;
          grid-template-columns: 10px 1fr auto;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
        }
        .pick:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.14);
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

        /* ---------------- MOBILE SEARCH (Lupe + Overlay) ---------------- */

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
          transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;
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

        /* FIX: mOnly darf auf Desktop NICHT sichtbar sein (Spezifität > .iconBtn) */
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
          width: 100%;
          max-width: 920px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.92);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }
        .mSearch__head {
          padding: 12px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .mSearch__title {
          font-weight: 950;
          letter-spacing: -0.01em;
        }
        .mSearch__body {
          padding: 12px;
          display: grid;
          gap: 12px;
          max-height: min(78vh, 720px);
          overflow: auto;
        }

        /* Responsive */
        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: 1fr;
          }
          .searchWrap {
            max-width: 100%;
          }

          /* Mobile: Suche ausblenden, Lupe zeigen */
          .searchWrap .input {
            display: none;
          }
          .iconBtn.mOnly {
            display: grid;
          }
        }
      `}</style>

      {/* -------------------------------------------------------------------- */}
      {/* -------------------------- TEIL 7.2: TOPBAR ------------------------- */}
      {/* -------------------------------------------------------------------- */}

      <div className="topbar">
        <div className="brand">
          <div className="brand__logo">1337</div>
          <div className="brand__tag">Library</div>
        </div>

        <div className="searchWrap">
          {/* Desktop Search */}
          <div className="input">
            <svg className="input__icon" viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 3a7.5 7.5 0 105.03 13.06l3.2 3.2a1 1 0 001.42-1.42l-3.2-3.2A7.5 7.5 0 0010.5 3zm0 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11z"
                fill="currentColor"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setFiltersOpen(true)}
              placeholder="Suche…"
              aria-label="Suche"
            />
          </div>

          {/* Mobile: Lupe */}
          <button type="button" className="iconBtn mOnly" onClick={openMobileSearch} aria-label="Suche öffnen">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M10.5 3a7.5 7.5 0 105.03 13.06l3.2 3.2a1 1 0 001.42-1.42l-3.2-3.2A7.5 7.5 0 0010.5 3zm0 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11z"
                fill="currentColor"
              />
            </svg>
          </button>

          {/* Popover (Desktop) */}
          {filtersOpen && !mobileSearchOpen ? (
            <div className="filterPopover" onMouseDown={(e) => e.stopPropagation()}>
              <div className="filterPopover__head">
                <div className="filterPopover__title">Erweiterte Suche</div>
                <div className="filterPopover__actions">
                  <button type="button" className="btn btn--xs" onClick={resetFilters}>
                    Reset
                  </button>
                  <button type="button" className="btn btn--primary btn--xs" onClick={applyFiltersNow}>
                    Anwenden
                  </button>
                  <button type="button" className="btn btn--xs" onClick={() => setFiltersOpen(false)}>
                    Schließen
                  </button>
                </div>
              </div>

              <div className="filterPopover__body">
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="kv__k" style={{ marginBottom: 6 }}>
                        Studio
                      </div>
                      <select
                        value={selectedStudio}
                        onChange={(e) => setSelectedStudio(e.target.value)}
                        className="fsec__searchInput"
                        style={{ width: "100%" }}
                      >
                        <option value="">Alle</option>
                        {studios.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="kv__k" style={{ marginBottom: 6 }}>
                        Resolution
                      </div>
                      <select
                        value={selectedResolution}
                        onChange={(e) => setSelectedResolution(e.target.value)}
                        className="fsec__searchInput"
                        style={{ width: "100%" }}
                      >
                        <option value="">Alle</option>
                        {resolutions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div className="kv__k" style={{ marginBottom: 6 }}>
                        Jahr von
                      </div>
                      <input
                        value={yearFrom}
                        onChange={(e) => setYearFrom(e.target.value)}
                        type="number"
                        placeholder="1990"
                        className="fsec__searchInput"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <div>
                      <div className="kv__k" style={{ marginBottom: 6 }}>
                        Jahr bis
                      </div>
                      <input
                        value={yearTo}
                        onChange={(e) => setYearTo(e.target.value)}
                        type="number"
                        placeholder="2025"
                        className="fsec__searchInput"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  <FilterSection
                    title="Tags"
                    subtitle={`${allTags.length} verfügbar`}
                    items={tagItems}
                    selectedKeys={selectedTags}
                    getKey={(it) => it.key}
                    getLabel={(it) => it.label}
                    onToggle={toggleTag}
                    search={tagSearch}
                    setSearch={setTagSearch}
                    showSelectedOnly={tagsSelectedOnly}
                    setShowSelectedOnly={setTagsSelectedOnly}
                    defaultOpen={true}
                  />

                  <FilterSection
                    title="Hauptdarsteller"
                    subtitle={`${mainItems.length} verfügbar`}
                    items={mainItems}
                    selectedKeys={selectedMainActors}
                    getKey={(it) => it.key}
                    getLabel={(it) => it.label}
                    onToggle={toggleMainActor}
                    search={mainActorSearch}
                    setSearch={setMainActorSearch}
                    showSelectedOnly={mainSelectedOnly}
                    setShowSelectedOnly={setMainSelectedOnly}
                    defaultOpen={false}
                  />

                  <FilterSection
                    title="Nebendarsteller"
                    subtitle={`${suppItems.length} verfügbar`}
                    items={suppItems}
                    selectedKeys={selectedSupportingActors}
                    getKey={(it) => it.key}
                    getLabel={(it) => it.label}
                    onToggle={toggleSupportingActor}
                    search={suppActorSearch}
                    setSearch={setSuppActorSearch}
                    showSelectedOnly={suppSelectedOnly}
                    setShowSelectedOnly={setSuppSelectedOnly}
                    defaultOpen={false}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right side actions */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {showMovies ? (
            <button type="button" className="btn" onClick={handleBackToActors} title="Zurück zur Darsteller-Ansicht">
              Darsteller
            </button>
          ) : null}
          <Pill>
            <span className="mono">{movies.length}</span> Movies
          </Pill>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {mobileSearchOpen ? (
        <div
          className="mSearch"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeMobileSearch();
          }}
        >
          <div className="mSearch__panel">
            <div className="mSearch__head">
              <div className="mSearch__title">Suche</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="btn btn--xs" onClick={resetFilters}>
                  Reset
                </button>
                <button type="button" className="btn btn--primary btn--xs" onClick={applyFiltersNow}>
                  Anwenden
                </button>
                <button type="button" className="btn btn--xs" onClick={closeMobileSearch}>
                  Schließen
                </button>
              </div>
            </div>

            <div className="mSearch__body">
              <div className="input" style={{ display: "flex" }}>
                <svg className="input__icon" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M10.5 3a7.5 7.5 0 105.03 13.06l3.2 3.2a1 1 0 001.42-1.42l-3.2-3.2A7.5 7.5 0 0010.5 3zm0 2a5.5 5.5 0 110 11 5.5 5.5 0 010-11z"
                    fill="currentColor"
                  />
                </svg>
                <input
                  ref={mobileSearchInputRef}
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Suche…"
                  aria-label="Suche"
                />
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div className="kv__k" style={{ marginBottom: 6 }}>
                      Studio
                    </div>
                    <select
                      value={selectedStudio}
                      onChange={(e) => setSelectedStudio(e.target.value)}
                      className="fsec__searchInput"
                      style={{ width: "100%" }}
                    >
                      <option value="">Alle</option>
                      {studios.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="kv__k" style={{ marginBottom: 6 }}>
                      Resolution
                    </div>
                    <select
                      value={selectedResolution}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                      className="fsec__searchInput"
                      style={{ width: "100%" }}
                    >
                      <option value="">Alle</option>
                      {resolutions.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div className="kv__k" style={{ marginBottom: 6 }}>
                      Jahr von
                    </div>
                    <input
                      value={yearFrom}
                      onChange={(e) => setYearFrom(e.target.value)}
                      type="number"
                      placeholder="1990"
                      className="fsec__searchInput"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <div className="kv__k" style={{ marginBottom: 6 }}>
                      Jahr bis
                    </div>
                    <input
                      value={yearTo}
                      onChange={(e) => setYearTo(e.target.value)}
                      type="number"
                      placeholder="2025"
                      className="fsec__searchInput"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <FilterSection
                  title="Tags"
                  subtitle={`${allTags.length} verfügbar`}
                  items={tagItems}
                  selectedKeys={selectedTags}
                  getKey={(it) => it.key}
                  getLabel={(it) => it.label}
                  onToggle={toggleTag}
                  search={tagSearch}
                  setSearch={setTagSearch}
                  showSelectedOnly={tagsSelectedOnly}
                  setShowSelectedOnly={setTagsSelectedOnly}
                  defaultOpen={true}
                />

                <FilterSection
                  title="Hauptdarsteller"
                  subtitle={`${mainItems.length} verfügbar`}
                  items={mainItems}
                  selectedKeys={selectedMainActors}
                  getKey={(it) => it.key}
                  getLabel={(it) => it.label}
                  onToggle={toggleMainActor}
                  search={mainActorSearch}
                  setSearch={setMainActorSearch}
                  showSelectedOnly={mainSelectedOnly}
                  setShowSelectedOnly={setMainSelectedOnly}
                  defaultOpen={false}
                />

                <FilterSection
                  title="Nebendarsteller"
                  subtitle={`${suppItems.length} verfügbar`}
                  items={suppItems}
                  selectedKeys={selectedSupportingActors}
                  getKey={(it) => it.key}
                  getLabel={(it) => it.label}
                  onToggle={toggleSupportingActor}
                  search={suppActorSearch}
                  setSearch={setSuppActorSearch}
                  showSelectedOnly={suppSelectedOnly}
                  setShowSelectedOnly={setSuppSelectedOnly}
                  defaultOpen={false}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------------------------------------------------------- */}
      {/* -------------------------- TEIL 7.3: CONTENT ------------------------ */}
      {/* -------------------------------------------------------------------- */}

      <div className="wrap">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : err ? (
          <EmptyState title="Fehler" subtitle={err} />
        ) : showMovies ? (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">{moviesTitle}</div>
                <div className="sectionMeta">{moviesSubtitle}</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={handleBackToActors} title="Zur Darsteller-Ansicht">
                  Darsteller
                </button>
              </div>
            </div>

            {movieList.length === 0 ? (
              <EmptyState
                title="Keine Filme gefunden"
                subtitle="Passe Suche/Filter an oder gehe zurück zur Darsteller-Ansicht."
              />
            ) : (
              <div className="movieGrid">
                {movieList.map((m) => (
                  <div key={m.id} className="movieCard">
                    {m.thumbnailUrl ? (
                      <div className="movieCard__thumb">
                        <img src={m.thumbnailUrl} alt={m.title || "Thumbnail"} loading="lazy" />
                      </div>
                    ) : null}

                    <div className="movieCard__top">
                      <h3 className="movieCard__title">{m.title || "Unbenannt"}</h3>
                      <div className="movieCard__year">{m.year || ""}</div>
                    </div>

                    <div className="movieCard__meta">
                      <div className="kv">
                        <div className="kv__k">Studio</div>
                        <div className="kv__v">{m.studio || "-"}</div>
                      </div>

                      <div className="kv">
                        <div className="kv__k">Res</div>
                        <div className="kv__v">{m.resolution || "-"}</div>
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
                      <button type="button" className="btn btn--primary" onClick={() => safeOpen(m.fileUrl)} title="Film starten">
                        Play
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          try {
                            navigator.clipboard.writeText(m.fileUrl || "");
                          } catch {
                            // ignore
                          }
                        }}
                        title="Link kopieren"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ))}
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
              <div className="grid">
                {actors.map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    onClick={() => handleShowMoviesForActor(a.id, a.name || "Filme")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleShowMoviesForActor(a.id, a.name || "Filme");
                    }}
                    title={`${a.name} – Filme anzeigen`}
                  >
                    <div className="card__img" style={{ position: "relative" }}>
                      {a.image ? <img src={a.image} alt={a.name || "Actor"} loading="lazy" /> : null}
                      <div className="card__badge">FILME</div>
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
