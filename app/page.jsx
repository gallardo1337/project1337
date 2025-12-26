"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * page.jsx – UI modernisiert (Netflix-inspiriert), Logik/Funktionen unverändert gehalten:
 * - Login via /api/login + localStorage flag
 * - Logout via /api/logout + localStorage cleanup
 * - Laden: movies + actors + actors2 + studios + tags (Supabase)
 * - Mapping: main_actor_ids / supporting_actor_ids / tag_ids / studio_id
 * - ViewModes: "actors" | "movies"
 * - Actor-Klick zeigt Filme dieses Actors
 * - Suche filtert Filme (title/studio/actors/tags)
 */

// -------------------------------
// Version / Changelog (UI only)
// -------------------------------

const CHANGELOG = [
  {
    version: "0.3.0",
    date: "2025-11-28",
    items: [
      "Startseite nutzt jetzt die neue Struktur (movies mit main_actor_ids/supporting_actor_ids, actors/actors2/tags/studios)",
      "Darsteller-Grid mit Profilbildern (profile_image) und Cropping via object-fit: cover",
      "Hauptdarsteller-Übersicht sortiert, Klick zeigt alle Filme dieses Darstellers",
    ],
  },
  {
    version: "0.2.0",
    date: "2025-11-27",
    items: [
      "HTTP-Streaming über NAS-Symlink (/1337) vorbereitet",
      "Play-Button öffnet direkte NAS-Links (fileUrl) im neuen Tab",
      "Version-Hinweis & Login-Leiste integriert",
    ],
  },
  {
    version: "0.1.0",
    date: "2025-11-26",
    items: [
      "Erste Version der 1337 Library mit Darsteller-/Film-Ansicht",
      "Supabase-Anbindung (erste Tabellen-Version)",
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

// -------------------------------
// Kleine UI-Helpers (UI only)
// -------------------------------

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

// -------------------------------
// Startseite
// -------------------------------

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

  // Login-Status
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  // Daten laden: movies + actors + actors2 + studios + tags
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

        // Filme mappen
        const mappedMovies =
          moviesData.map((m) => {
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
              actors: allActors,
              tags: tagNames,
              mainActorIds: mainIds,
            };
          }) || [];

        setMovies(mappedMovies);

        // Hauptdarsteller-Liste mit movieCount + profilbild
        const movieCountByActorId = new Map();
        moviesData.forEach((m) => {
          const arr = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          arr.forEach((id) => {
            if (!movieCountByActorId.has(id)) movieCountByActorId.set(id, 0);
            movieCountByActorId.set(id, movieCountByActorId.get(id) + 1);
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

  const handleShowMoviesForActor = (actorId, actorName) => {
    const m = movies.filter((movie) => Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId));
    setMoviesTitle(actorName);
    setMoviesSubtitle(`${m.length} Film(e)`);
    setVisibleMovies(m);
    setViewMode("movies");
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setViewMode("actors");
      setVisibleMovies([]);
      setMoviesTitle("Filme");
      setMoviesSubtitle("");
      return;
    }

    const q = trimmed.toLowerCase();
    const m = movies.filter((movie) => {
      const haystack = [movie.title || "", movie.studio || "", movie.actors.join(" "), movie.tags.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

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
        body: JSON.stringify({
          username: loginUser,
          password: loginPassword,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setLoginErr("User oder Passwort falsch.");
        } else {
          setLoginErr("Login fehlgeschlagen.");
        }
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
      // ignorieren
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

  // UI-only: kleine Kennzahl für hero
  const heroCounts = useMemo(() => {
    const movieCount = movies.length || 0;
    const actorCount = actors.length || 0;
    return { movieCount, actorCount };
  }, [movies.length, actors.length]);

  const showMovies = viewMode === "movies";
  const movieList = showMovies ? visibleMovies : [];

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
          --accent2: rgba(229, 9, 20, 0.22);
          --shadow: rgba(0, 0, 0, 0.55);
        }

        html,
        body {
          background: var(--bg);
          color: var(--text);
        }

        * {
          box-sizing: border-box;
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
        }

        .topbar__right {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* Inputs & Buttons */
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
          transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease;
        }
        .chip:hover {
          transform: translateY(-1px);
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
          max-width: 56ch;
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
          backdrop-filter: blur(10px);
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

        .hero__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .grid2 {
          margin-top: 18px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }

        /* Cards / Sections */
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
        .card:active {
          transform: translateY(-1px);
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

        /* Movie list */
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

        /* Auth area */
        .auth {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .auth__label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          font-weight: 650;
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
        .authField input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .errorBanner {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.10);
          color: rgba(255, 255, 255, 0.88);
        }

        /* Empty / Loading */
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
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
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
          max-width: 760px;
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
          max-height: 70vh;
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
            <div className="input" title="Suche nach Titel, Studio, Darsteller, Tags">
              <svg className="input__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
                onChange={(e) => handleSearchChange(e.target.value)}
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
          ) : null}
        </div>

        <div className="topbar__right">
          <VersionHint />

          {loggedIn ? (
            <>
              <div className="auth">
                <div className="auth__label">Willkommen, {loginUser}</div>
              </div>

              {/* Optional: Dashboard Link (nur UI; ändert keine Logik) */}
              <button
                type="button"
                className="btn"
                onClick={() => safeOpen("/dashboard")}
                title="Zum Dashboard"
              >
                Dashboard
              </button>

              <button type="button" className="btn btn--danger" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <form className="authForm" onSubmit={handleLogin}>
              <div className="authField">
                <input
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="User"
                  autoComplete="username"
                />
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
                Netflix-inspiriertes UI – aber deine Daten. Suche Filme, browse Darsteller und starte direkt den Stream
                über deine hinterlegten Links. (Nur Styling geändert – Logik bleibt wie gehabt.)
              </div>

              <div className="hero__actions">
                {loggedIn ? (
                  <>
                    {showMovies ? (
                      <button type="button" className="btn" onClick={handleBackToActors}>
                        Zurück zu Darstellern
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setViewMode("movies");
                          setMoviesTitle("Filme");
                          setMoviesSubtitle(`${movies.length} Film(e)`);
                          setVisibleMovies(movies);
                        }}
                        title="Alle Filme anzeigen"
                      >
                        Alle Filme
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => safeOpen("/dashboard")}
                      title="Admin / Dashboard"
                    >
                      Zum Dashboard
                    </button>
                  </>
                ) : (
                  <Pill>Login erforderlich</Pill>
                )}
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
          <div className="grid2">
            <EmptyState
              title="Bitte einloggen"
              subtitle="Ohne Login werden keine Inhalte geladen. Logge dich oben rechts ein, um Darsteller und Filme zu sehen."
              action={<Pill>Project1337 • Private Library</Pill>}
            />
          </div>
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
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => safeOpen("/dashboard")}
                  title="Dashboard öffnen"
                >
                  Dashboard
                </button>
              </div>
            </div>

            {movieList.length === 0 ? (
              <EmptyState title="Keine Filme gefunden" subtitle="Passe die Suche an oder gehe zurück zur Darsteller-Ansicht." />
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
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => safeOpen(m.fileUrl)}
                        title="Film starten"
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          // UI only: Copy
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
                    setViewMode("movies");
                    setMoviesTitle("Filme");
                    setMoviesSubtitle(`${movies.length} Film(e)`);
                    setVisibleMovies(movies);
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
    </div>
  );
}
