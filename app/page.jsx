"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
  {
    version: "0.2.0",
    date: "2025-11-27",
    items: [
      "HTTP-Streaming über NAS-Symlink (/1337) vorbereitet",
      "Play-Button öffnet direkte NAS-Links (fileUrl) im neuen Tab",
      "Version-Hinweis & Changelog auf Startseite integriert"
    ]
  },
  {
    version: "0.1.0",
    date: "2025-11-26",
    items: [
      "Erste Version der 1337 Library mit Darsteller-/Film-Ansicht",
      "Supabase-Anbindung (movies, studios, actors, tags, movie_actors, movie_tags)"
    ]
  }
];

function VersionHint() {
  const [open, setOpen] = useState(false);
  const current = CHANGELOG[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          borderRadius: "999px",
          border: "1px solid #4b5563",
          background: "#020617",
          color: "#e5e7eb",
          fontSize: "0.8rem",
          padding: "4px 10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          cursor: "pointer"
        }}
      >
        <span>{current.version}</span>
        <span style={{ opacity: 0.7 }}>Changelog</span>
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 70
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
              background: "#020617",
              borderRadius: 16,
              border: "1px solid #4b5563",
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#9ca3af"
                  }}
                >
                  Version & Changelog
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  1337 Library
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  borderRadius: "999px",
                  border: "1px solid #4b5563",
                  background: "#111827",
                  color: "#e5e7eb",
                  fontSize: "0.8rem",
                  padding: "4px 10px",
                  cursor: "pointer"
                }}
              >
                Schließen
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {CHANGELOG.map((entry) => (
                <div
                  key={entry.version}
                  style={{
                    borderRadius: 12,
                    border: "1px solid #374151",
                    padding: 12,
                    background: "#030712"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "#e5e7eb"
                      }}
                    >
                      {entry.version}
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#9ca3af"
                      }}
                    >
                      {entry.date}
                    </div>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: "0.85rem",
                      color: "#d1d5db"
                    }}
                  >
                    {entry.items.map((it, idx) => (
                      <li key={idx} style={{ marginBottom: 3 }}>
                        {it}
                      </li>
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
// Startseite
// -------------------------------

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

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const { data, error } = await supabase
          .from("movies")
          .select(`
            id,
            title,
            file_url,
            year,
            studios ( name ),
            movie_actors (
              actors ( name )
            ),
            movie_tags (
              tags ( name )
            )
          `);

        if (error) {
          console.error(error);
          setErr("Fehler beim Laden der Daten.");
          return;
        }

        const mapped =
          data?.map((m) => ({
            id: m.id,
            title: m.title,
            fileUrl: m.file_url,
            year: m.year,
            studio: m.studios ? m.studios.name : null,
            actors:
              m.movie_actors?.map((a) => a.actors?.name).filter(Boolean) || [],
            tags:
              m.movie_tags?.map((t) => t.tags?.name).filter(Boolean) || []
          })) || [];

        setMovies(mapped);
        setActors(buildActorList(mapped));
      } catch (e) {
        console.error(e);
        setErr("Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const buildActorList = (allMovies) => {
    const map = new Map();
    allMovies.forEach((m) => {
      m.actors.forEach((name) => {
        if (!name) return;
        if (!map.has(name)) map.set(name, 0);
        map.set(name, map.get(name) + 1);
      });
    });

    return Array.from(map.entries())
      .map(([name, movieCount]) => ({ name, movieCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleShowMoviesForActor = (actorName) => {
    const m = movies.filter((movie) => movie.actors.includes(actorName));
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
      const haystack = [
        movie.title || "",
        movie.studio || "",
        movie.actors.join(" "),
        movie.tags.join(" ")
      ]
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

  return (
    <div className="page">
      <header className="topbar">
        <div className="logo-text">1337 Library</div>
        <div style={{ marginLeft: "auto" }}>
          <VersionHint />
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="logo-container">
            <img src="/logo.svg" alt="1337 Logo" className="logo-svg" />
          </div>
          <div className="search-wrapper">
            <input
              id="globalSearch"
              type="search"
              placeholder="Titel, Darsteller, Studio, Tags …"
              autoComplete="off"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </section>

        {loading && (
          <section className="actor-section">
            <p>Lade Filme …</p>
          </section>
        )}

        {err && !loading && (
          <section className="actor-section">
            <p>{err}</p>
          </section>
        )}

        {!loading && !err && (
          <>
            {viewMode === "actors" && (
              <section id="actorSection" className="actor-section">
                <h2>Darsteller</h2>
                <div id="actorGrid" className="actor-grid">
                  {actors.length === 0 && (
                    <p>Noch keine Filme in der Datenbank.</p>
                  )}
                  {actors.map((actor) => (
                    <article
                      key={actor.name}
                      className="actor-card"
                      onClick={() => handleShowMoviesForActor(actor.name)}
                    >
                      <div className="actor-name">{actor.name}</div>
                      <div className="actor-count">
                        {actor.movieCount} Film
                        {actor.movieCount !== 1 ? "e" : ""}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {viewMode === "movies" && (
              <section id="moviesSection" className="movies-section">
                <div className="movies-header">
                  <div>
                    <h2 id="moviesTitle">{moviesTitle}</h2>
                    <p id="moviesSubtitle" className="movies-subtitle">
                      {moviesSubtitle}
                    </p>
                  </div>
                  <button
                    id="backToActors"
                    className="back-btn"
                    onClick={handleBackToActors}
                  >
                    Zurück zur Darsteller-Übersicht
                  </button>
                </div>
                <div id="movieList" className="movie-grid">
                  {visibleMovies.length === 0 && (
                    <p>Keine Filme für diese Auswahl gefunden.</p>
                  )}
                  {visibleMovies.map((m) => (
                    <article key={m.id} className="movie-card">
                      <div className="movie-title">{m.title}</div>
                      <div className="movie-meta">
                        {m.year && <span>{m.year}</span>}
                        {m.studio && (
                          <span>
                            {m.year ? " • " : ""}
                            {m.studio}
                          </span>
                        )}
                        {m.actors.length > 0 && (
                          <span>
                            {(m.year || m.studio) ? " • " : ""}
                            {m.actors.join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="tag-list">
                        {m.tags.map((t) => (
                          <span key={t} className="tag-pill">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="movie-actions">
                        <a
                          href={m.fileUrl}
                          className="play-btn"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            textDecoration: "none",
                            display: "inline-block",
                            textAlign: "center"
                          }}
                        >
                          Abspielen
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
