"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * page.jsx – Netflix-inspiriert + Advanced Filter (skalierbar)
 *
 * Fix/UX:
 * - Filter-Fenster explodiert nicht mehr: Sections + Search + Scroll + "Nur ausgewählte anzeigen"
 * - Tags / Hauptdarsteller / Nebendarsteller sind jeweils:
 *   - einklappbar
 *   - Suchfeld
 *   - scrollbarer Bereich
 *   - Chips der Auswahl oben
 * - Studio dropdown dark (option background)
 * - Auf der Hauptseite nur EIN Filter-Zugang (Topbar Button). Hero/Sections haben keine extra Filter-Buttons mehr.
 *
 * Logik:
 * - Multi-Auswahl bleibt STRICT UND (alle gewählten müssen matchen)
 * - Textsuche bleibt unverändert, Filter wirken zusätzlich
 */

const CHANGELOG = [
  {
    version: "0.3.3",
    date: "2025-12-26",
    items: [
      "Filter UX refactored: Sections + Search + Scroll + Selected-only Toggle",
      "Nur ein Filter-Button (Topbar)",
      "Studio dropdown dark options",
      "Multi Haupt-/Nebendarsteller Filter bleibt STRICT UND",
    ],
  },
];

function VersionHint() {
  const [open, setOpen] = useState(false);
  const current = CHANGELOG[0];

  return (
    <>
      <button type="button" className="chip" onClick={() => setOpen(true)}>
        <span className="chip__dot" />
        <span className="chip__ver">{current.version}</span>
        <span className="chip__label">Changelog</span>
      </button>

      {open && (
        <div className="modalOverlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="modal__kicker">Version & Changelog</div>
                <div className="modal__title">1337 Library</div>
              </div>
              <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
                Schließen
              </button>
            </div>

            <div className="modal__body">
              {CHANGELOG.map((entry) => (
                <div key={entry.version} className="logCard">
                  <div className="logCard__top">
                    <div className="logCard__ver">{entry.version}</div>
                    <div className="logCard__date">{entry.date}</div>
                  </div>
                  <ul className="logCard__list">
                    {entry.items.map((it, idx) => (
                      <li key={idx}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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

    if (showSelectedOnly) {
      list = list.filter((it) => selectedSet.has(String(getKey(it))));
    }

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
            {subtitle} • <span className="mono">{selectedKeys.length}</span> aktiv
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
              <svg className="fsearch__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" />
              {search ? (
                <button type="button" className="btn btn--ghost btn--xs" onClick={() => setSearch("")}>
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
                    className="selChip"
                    onClick={() => onToggle(k)}
                    title="Entfernen"
                  >
                    <span className="selChip__dot" />
                    <span className="selChip__txt">{label}</span>
                    <span className="selChip__x">×</span>
                  </button>
                );
              })}
              {selectedKeys.length > 14 ? <Pill>+{selectedKeys.length - 14}</Pill> : null}
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

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]); // Hauptdarsteller-Liste
  const [viewMode, setViewMode] = useState("actors"); // "actors" | "movies"
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [moviesTitle, setMoviesTitle] = useState("Filme");
  const [moviesSubtitle, setMoviesSubtitle] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // Login
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Filter modal
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filters: core
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStudio, setSelectedStudio] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  // Actor filters
  const [selectedMainActors, setSelectedMainActors] = useState([]); // actor IDs
  const [selectedSupportingActors, setSelectedSupportingActors] = useState([]); // names

  // Filter UI state
  const [tagSearch, setTagSearch] = useState("");
  const [mainActorSearch, setMainActorSearch] = useState("");
  const [suppActorSearch, setSuppActorSearch] = useState("");

  const [tagsSelectedOnly, setTagsSelectedOnly] = useState(false);
  const [mainSelectedOnly, setMainSelectedOnly] = useState(false);
  const [suppSelectedOnly, setSuppSelectedOnly] = useState(false);

  // Session check
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

  // Load data
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

        const [moviesRes, actorsRes, actors2Res, studiosRes, tagsRes] = await Promise.all([
          supabase.from("movies").select("*"),
          supabase.from("actors").select("*"),
          supabase.from("actors2").select("*"),
          supabase.from("studios").select("*"),
          supabase.from("tags").select("*"),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;

        const moviesData = moviesRes.data || [];
        const mainActors = actorsRes.data || [];
        const supportActors = actors2Res.data || [];
        const studios = studiosRes.data || [];
        const tags = tagsRes.data || [];

        const mainActorById = Object.fromEntries(mainActors.map((a) => [a.id, a]));
        const supportActorById = Object.fromEntries(supportActors.map((a) => [a.id, a]));
        const studioMap = Object.fromEntries(studios.map((s) => [s.id, s.name]));
        const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.name]));

        const mappedMovies = (moviesData || []).map((m) => {
          const mainIds = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          const supportIds = Array.isArray(m.supporting_actor_ids) ? m.supporting_actor_ids : [];

          const mainNames = mainIds.map((id) => mainActorById[id]?.name).filter(Boolean);
          const supportNames = supportIds.map((id) => supportActorById[id]?.name).filter(Boolean);

          const allActors = [...mainNames, ...supportNames];
          const tagNames = Array.isArray(m.tag_ids) ? m.tag_ids.map((id) => tagMap[id]).filter(Boolean) : [];

          return {
            id: m.id,
            title: m.title,
            year: m.year,
            fileUrl: m.file_url,
            studio: m.studio_id ? studioMap[m.studio_id] || null : null,
            actors: allActors, // names
            tags: tagNames,
            mainActorIds: mainIds,
            mainActorNames: mainNames,
            supportingActorNames: supportNames,
          };
        });

        setMovies(mappedMovies);

        // main actor list
        const movieCountByActorId = new Map();
        moviesData.forEach((m) => {
          const arr = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          arr.forEach((id) => {
            movieCountByActorId.set(id, (movieCountByActorId.get(id) || 0) + 1);
          });
        });

        const actorList = mainActors
          .map((a) => ({
            id: a.id,
            name: a.name,
            profileImage: a.profile_image || null,
            movieCount: movieCountByActorId.get(a.id) || 0,
          }))
          .filter((a) => a.movieCount > 0)
          .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

        setActors(actorList);
      } catch (e) {
        console.error(e);
        setErr("Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loggedIn]);

  // Options
  const allTags = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [movies]);

  const allStudios = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      if (m.studio) set.add(m.studio);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [movies]);

  const mainActorOptions = useMemo(() => {
    return (actors || [])
      .map((a) => ({ id: a.id, name: a.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
  }, [actors]);

  const supportingActorOptions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.supportingActorNames || []).forEach((n) => set.add(n)));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
  }, [movies]);

  // Filter engine
  const applyAdvancedFilters = (baseList) => {
    let list = baseList;

    // Studio
    if (selectedStudio) list = list.filter((m) => (m.studio || "") === selectedStudio);

    // Year
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

    // Tags strict AND
    if (selectedTags.length > 0) {
      list = list.filter((m) => {
        const mtags = Array.isArray(m.tags) ? m.tags : [];
        return selectedTags.every((t) => mtags.includes(t));
      });
    }

    // Main actors strict AND (IDs)
    if (selectedMainActors.length > 0) {
      list = list.filter((m) => {
        const ids = Array.isArray(m.mainActorIds) ? m.mainActorIds.map(String) : [];
        return selectedMainActors.map(String).every((id) => ids.includes(id));
      });
    }

    // Supporting actors strict AND (names)
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
        selectedTags.length > 0 ||
        yearFrom ||
        yearTo ||
        selectedMainActors.length > 0 ||
        selectedSupportingActors.length > 0
    );
  }, [selectedStudio, selectedTags.length, yearFrom, yearTo, selectedMainActors.length, selectedSupportingActors.length]);

  // Actions
  const handleShowMoviesForActor = (actorId, actorName) => {
    const m = movies.filter((movie) => Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId));
    const filtered = applyAdvancedFilters(m);
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
      const haystack = [movie.title || "", movie.studio || "", movie.actors.join(" "), movie.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    const m = applyAdvancedFilters(raw);
    setMoviesTitle(`Suchergebnis für "${trimmed}"`);
    setMoviesSubtitle(`${m.length} Treffer`);
    setVisibleMovies(m);
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
        setLoginErr(res.status === 401 ? "User oder Passwort falsch." : "Login fehlgeschlagen.");
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
  };

  const heroCounts = useMemo(() => {
    return { movieCount: movies.length || 0, actorCount: actors.length || 0 };
  }, [movies.length, actors.length]);

  const showMovies = viewMode === "movies";
  const movieList = showMovies ? visibleMovies : [];

  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedStudio("");
    setYearFrom("");
    setYearTo("");
    setSelectedMainActors([]);
    setSelectedSupportingActors([]);

    // also reset UI search/toggles (optional but feels clean)
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
      const filtered = applyAdvancedFilters(movies);
      setMoviesTitle("Gefilterte Filme");
      setMoviesSubtitle(`${filtered.length} Treffer`);
      setVisibleMovies(filtered);
      setViewMode("movies");
    }
    setFiltersOpen(false);
  };

  // Toggle helpers
  const toggleTag = (t) => {
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const toggleMainActor = (id) => {
    const sid = String(id);
    setSelectedMainActors((prev) => {
      const p = prev.map(String);
      return p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid];
    });
  };

  const toggleSupportingActor = (name) => {
    setSelectedSupportingActors((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  // Filter data shaped for section component
  const tagItems = useMemo(() => allTags.map((t) => ({ key: t, label: t })), [allTags]);
  const mainItems = useMemo(() => mainActorOptions.map((a) => ({ key: String(a.id), label: a.name })), [mainActorOptions]);
  const suppItems = useMemo(() => supportingActorOptions.map((n) => ({ key: n, label: n })), [supportingActorOptions]);

  return (
    <div className="nfx">
      <style jsx global>{`
        :root {
          --bg: #0b0b0f;
          --panel: rgba(255, 255, 255, 0.06);
          --panel2: rgba(255, 255, 255, 0.08);
          --stroke: rgba(255, 255, 255, 0.12);
          --stroke2: rgba(255, 255, 255, 0.16);
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.68);
          --muted2: rgba(255, 255, 255, 0.52);
          --accent: #e50914;
          --accent2: rgba(229, 9, 20, 0.18);
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
          background:
            radial-gradient(1200px 700px at 15% 15%, rgba(229, 9, 20, 0.25), transparent 55%),
            radial-gradient(900px 600px at 85% 10%, rgba(255, 255, 255, 0.08), transparent 55%),
            radial-gradient(900px 700px at 60% 80%, rgba(255, 255, 255, 0.06), transparent 60%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.65), rgba(0, 0, 0, 0.95));
        }

        /* Topbar */
        .topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          user-select: none;
        }
        .brand__mark {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(145deg, rgba(229, 9, 20, 0.95), rgba(229, 9, 20, 0.35));
          box-shadow: 0 14px 30px rgba(229, 9, 20, 0.22);
        }
        .brand__name {
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .brand__sub {
          margin-left: 8px;
          font-size: 12px;
          color: var(--muted2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 4px 8px;
          border-radius: 999px;
        }
        .topbar__mid {
          flex: 1;
          display: flex;
          justify-content: center;
          gap: 10px;
          align-items: center;
        }
        .topbar__right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Search */
        .input {
          width: 100%;
          max-width: 720px;
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

        /* Chip */
        .chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          cursor: pointer;
          font-size: 13px;
          font-weight: 650;
        }
        .chip:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .chip__dot {
          width: 8px;
          height: 8px;
          border-radius: 99px;
          background: var(--accent);
          box-shadow: 0 0 0 6px rgba(229, 9, 20, 0.15);
        }
        .chip__ver {
          font-variant-numeric: tabular-nums;
        }
        .chip__label {
          color: var(--muted);
          font-weight: 600;
        }

        /* Layout */
        .wrap {
          width: 100%;
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 18px 70px;
        }

        /* Hero */
        .hero {
          margin-top: 18px;
          border-radius: 22px;
          overflow: hidden;
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(900px 360px at 20% 20%, rgba(229, 9, 20, 0.35), transparent 55%),
            radial-gradient(900px 520px at 70% 50%, rgba(255, 255, 255, 0.10), transparent 60%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
          box-shadow: 0 30px 80px var(--shadow);
        }
        .hero__inner {
          padding: 26px 22px 22px;
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 18px;
          align-items: end;
        }
        .hero__kicker {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 650;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 12px;
        }
        .hero__title {
          font-size: 34px;
          line-height: 1.05;
          font-weight: 900;
          letter-spacing: -0.02em;
          margin: 8px 0 10px;
        }
        .hero__sub {
          color: rgba(255, 255, 255, 0.72);
          font-size: 14px;
          line-height: 1.45;
          max-width: 60ch;
        }
        .hero__stats {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .stat {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.35);
          border-radius: 16px;
          padding: 10px 12px;
          min-width: 150px;
        }
        .stat__num {
          font-weight: 900;
          font-size: 18px;
          letter-spacing: -0.01em;
        }
        .stat__lbl {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
        }

        .sectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin: 26px 2px 12px;
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

        /* Actor grid */
        .row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .hero__inner {
            grid-template-columns: 1fr;
          }
          .hero__stats {
            justify-content: flex-start;
          }
        }
        @media (max-width: 720px) {
          .row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .hero__title {
            font-size: 28px;
          }
          .topbar__mid {
            display: none;
          }
        }
        .card {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .card__img {
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
        .card__body {
          padding: 10px 10px 12px;
        }
        .card__title {
          font-weight: 800;
          font-size: 13px;
          line-height: 1.2;
          letter-spacing: -0.01em;
          margin: 0 0 6px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 32px;
        }
        .card__sub {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }

        /* Movies */
        .movieGrid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .movieGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .movieGrid {
            grid-template-columns: 1fr;
          }
        }
        .movieCard {
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 14px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
        }
        .movieCard:hover {
          transform: translateY(-2px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .movieCard__top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: flex-start;
        }
        .movieCard__title {
          font-weight: 900;
          letter-spacing: -0.01em;
          margin: 0;
          font-size: 16px;
          line-height: 1.2;
        }
        .movieCard__year {
          color: rgba(255, 255, 255, 0.7);
          font-weight: 750;
          font-variant-numeric: tabular-nums;
          margin-top: 2px;
        }
        .movieCard__meta {
          margin-top: 10px;
          display: grid;
          gap: 8px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
        }
        .kv {
          display: flex;
          gap: 10px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .kv__k {
          color: rgba(255, 255, 255, 0.52);
          font-weight: 700;
          min-width: 88px;
        }
        .kv__v {
          color: rgba(255, 255, 255, 0.78);
        }
        .movieCard__actions {
          margin-top: 12px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* Auth */
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
        .authField input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }
        .auth__label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          font-weight: 650;
        }

        .errorBanner {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.10);
          color: rgba(255, 255, 255, 0.88);
        }

        .empty {
          border: 1px solid rgba(255, 255, 255, 0.10);
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
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.05)
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }
        @media (max-width: 1100px) {
          .skRow {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .skRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        /* Modal */
        .modalOverlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 1000;
        }
        .modal {
          width: 100%;
          max-width: 980px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(10, 10, 14, 0.92);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }
        .modal__head {
          padding: 16px 16px 12px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .modal__kicker {
          color: rgba(255, 255, 255, 0.65);
          font-size: 12px;
          font-weight: 650;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .modal__title {
          font-weight: 900;
          font-size: 16px;
          margin-top: 2px;
        }
        .modal__body {
          padding: 16px;
          max-height: 78vh;
          overflow: auto;
          display: grid;
          gap: 12px;
        }

        .logCard {
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 16px;
          padding: 14px;
        }
        .logCard__top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
          margin-bottom: 8px;
        }
        .logCard__ver {
          font-weight: 900;
        }
        .logCard__date {
          color: rgba(255, 255, 255, 0.6);
          font-size: 12px;
          font-variant-numeric: tabular-nums;
        }
        .logCard__list {
          margin: 0;
          padding-left: 18px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 13px;
          line-height: 1.55;
        }

        /* Filter layout */
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

        /* Select dark dropdown */
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

        /* Sections */
        .fsec {
          border: 1px solid rgba(255, 255, 255, 0.10);
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
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          font-weight: 900;
        }
        .fsec__body {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        /* section tools */
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
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.03);
        }
        .toggle input {
          accent-color: var(--accent);
        }

        /* Selected chips row */
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
          background: rgba(229, 9, 20, 0.10);
          color: rgba(255, 255, 255, 0.88);
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
        }
        .selChip:hover {
          border-color: rgba(229, 9, 20, 0.40);
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

        /* Pick list */
        .pickList {
          max-height: 260px;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
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
          background: rgba(229, 9, 20, 0.10);
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
          color: rgba(255, 255, 255, 0.80);
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
      `}</style>

      {/* Topbar */}
      <div className="topbar">
        <div className="brand" title="Project1337">
          <div className="brand__mark" />
          <div className="brand__name">Project1337</div>
          <div className="brand__sub">Library</div>
        </div>

        <div className="topbar__mid">
          {loggedIn ? (
            <>
              <div className="input" title="Suche nach Titel, Studio, Darsteller, Tags">
                <svg className="input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                  autoComplete="off"
                />
                {search ? (
                  <button type="button" className="btn btn--ghost" onClick={() => handleSearchChange("")} title="Suche löschen">
                    Reset
                  </button>
                ) : null}
              </div>

              {/* EIN Filter Button */}
              <button
                type="button"
                className={`btn ${hasAnyFilter ? "btn--primary" : ""}`}
                onClick={() => setFiltersOpen(true)}
                title="Erweiterte Suche / Filter"
              >
                Filter{hasAnyFilter ? " • aktiv" : ""}
              </button>
            </>
          ) : null}
        </div>

        <div className="topbar__right">
          <VersionHint />

          {loggedIn ? (
            <>
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

      <div className="wrap">
        {/* Hero */}
        <div className="hero">
          <div className="hero__inner">
            <div>
              <div className="hero__kicker">Stream. Organize. Flex.</div>
              <div className="hero__title">Deine private 1337-Mediathek.</div>
              <div className="hero__sub">
                Suche über Text oder filtere exakt. Mehrfachauswahl bedeutet immer: ein Film muss alle ausgewählten Einträge enthalten (STRICT UND).
              </div>
            </div>

            <div className="hero__stats">
              <div className="stat">
                <div className="stat__num">{loggedIn ? heroCounts.movieCount : "—"}</div>
                <div className="stat__lbl">Filme</div>
              </div>
              <div className="stat">
                <div className="stat__num">{loggedIn ? heroCounts.actorCount : "—"}</div>
                <div className="stat__lbl">Hauptdarsteller</div>
              </div>
              <div className="stat">
                <div className="stat__num">{loggedIn ? (showMovies ? "Filme" : "Darsteller") : "—"}</div>
                <div className="stat__lbl">Ansicht</div>
              </div>
            </div>
          </div>
        </div>

        {/* Errors */}
        {loginErr ? <div className="errorBanner">{loginErr}</div> : null}
        {err ? <div className="errorBanner">{err}</div> : null}

        {/* Content */}
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
                {movieList.map((m) => (
                  <div key={m.id} className="movieCard">
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
                <div className="sectionMeta">
                  {actors.length} Darsteller • Klicke einen Darsteller, um seine Filme zu öffnen.
                </div>
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
                    </div>
                    <div className="card__body">
                      <div className="card__title">{a.name}</div>
                      <div className="card__sub">
                        <Pill>{a.movieCount} Film(e)</Pill>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Modal */}
      {filtersOpen && loggedIn && (
        <div className="modalOverlay" onClick={() => setFiltersOpen(false)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <div className="modal__kicker">Erweiterte Suche</div>
                <div className="modal__title">Filter</div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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

            <div className="modal__body">
              <div className="logCard">
                <div className="filterGrid">
                  {/* Left: big multi lists */}
                  <div style={{ display: "grid", gap: 12 }}>
                    <FilterSection
                      title="Tags"
                      subtitle="alle müssen passen"
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
                      subtitle="alle müssen passen"
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
                      subtitle="alle müssen passen"
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

                  {/* Right: smaller core filters */}
                  <div style={{ display: "grid", gap: 12 }}>
                    <div className="fsec">
                      <div className="fsec__head" style={{ cursor: "default" }}>
                        <div className="fsec__headL">
                          <div className="fsec__title">Basis</div>
                          <div className="fsec__sub">Studio & Jahr</div>
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

                        <div className="divider" />

                        <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.5 }}>
                          <b>Logik:</b> Mehrfachauswahl ist immer <b>UND</b>. Ein Film muss alle ausgewählten Tags/Darsteller enthalten.
                          Filter wirken zusätzlich zur Textsuche.
                        </div>

                        {hasAnyFilter ? (
                          <>
                            <div className="divider" />
                            <div style={{ display: "grid", gap: 8 }}>
                              <div className="fieldLabel">Aktiv</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {selectedStudio ? <Pill>Studio</Pill> : null}
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

              {/* Optional helper row */}
              <div className="logCard">
                <div className="fieldLabel">Tipp</div>
                <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 1.5 }}>
                  Bei sehr vielen Einträgen: nutze das Suchfeld innerhalb der Section oder aktiviere „Nur Auswahl“, um deine
                  aktuell gesetzten Filter schnell zu sehen und zu bearbeiten.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
