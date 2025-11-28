"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
  {
    version: "0.3.0",
    date: "2025-11-28",
    items: [
      "Darsteller-Grid zeigt jetzt Bilder (profile_image) mit sauberem Cropping",
      "Actor-Übersicht sortiert nach Namen, inkl. Filmanzahl"
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
      "Supabase-Anbindung (movies, studios, actors, tags, movie_actors, movie_tags)",
    ],
  },
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
          cursor: "pointer",
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
            zIndex: 70,
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
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#9ca3af",
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
                  cursor: "pointer",
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
                    background: "#030712",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "0.95rem",
                        color: "#e5e7eb",
                      }}
                    >
                      {entry.version}
                    </div>
                    <div
                      style={{ fontSize: "0.8rem", color: "#9ca3af" }}
                    >
                      {entry.date}
                    </div>
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: "0.85rem",
                      color: "#d1d5db",
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

  // Login-Status
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Beim Laden prüfen, ob Session existiert
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

  // Filme + Darsteller nur laden, wenn eingeloggt
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

        // movies + movie_actors + actors (inkl. profile_image)
        const { data, error } = await supabase
          .from("movies")
          .select(`
            id,
            title,
            file_url,
            year,
            studios ( name ),
            movie_actors (
              actor_id,
              actors (
                id,
                name,
                profile_image
              )
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

        const actorMap = new Map();

        const mapped =
          data?.map((m) => {
            const actorObjs =
              m.movie_actors
                ?.map((ma) => ma.actors)
                .filter(Boolean) || [];

            // Actor-Map für die Übersicht füllen
            actorObjs.forEach((a) => {
              if (!a) return;
              const key = a.id;
              if (!actorMap.has(key)) {
                actorMap.set(key, {
                  id: a.id,
                  name: a.name,
                  profileImage: a.profile_image || null,
                  movieCount: 0,
                });
              }
              const entry = actorMap.get(key);
              entry.movieCount += 1;
            });

            return {
              id: m.id,
              title: m.title,
              fileUrl: m.file_url,
              year: m.year,
              studio: m.studios ? m.studios.name : null,
              actors: actorObjs.map((a) => a.name),
              tags:
                m.movie_tags?.map((t) => t.tags?.name).filter(Boolean) || [],
            };
          }) || [];

        // Actor-Liste sortieren (alphabetisch)
        const actorList = Array.from(actorMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name, "de", { sensitivity: "base" })
        );

        setMovies(mapped);
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
        movie.tags.join(" "),
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
      // ignorieren, localStorage reicht
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

  return (
    <div className="page">
      <header className="topbar">
        <div className="logo-text">1337 Library</div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <VersionHint />

          {!loggedIn ? (
            <form
              onSubmit={handleLogin}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <input
                type="text"
                placeholder="User"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                style={{
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.8rem",
                  padding: "4px 8px",
                  width: 130,
                }}
              />
              <input
                type="password"
                placeholder="Passwort"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  borderRadius: 999,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.8rem",
                  padding: "4px 8px",
                  width: 120,
                }}
              />
              <button
                type="submit"
                disabled={loginLoading || !loginPassword}
                style={{
                  borderRadius: 999,
                  border: "none",
                  background: "#f97316",
                  color: "#111827",
                  fontSize: "0.8rem",
                  padding: "4px 10px",
                  fontWeight: 600,
                  cursor:
                    loginLoading || !loginPassword ? "default" : "pointer",
                  opacity: loginLoading || !loginPassword ? 0.7 : 1,
                }}
              >
                {loginLoading ? "…" : "Login"}
              </button>
            </form>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              <span style={{ color: "#4ade80" }}>
                Willkommen, {loginUser}
              </span>
              <a
                href="/dashboard"
                style={{
                  textDecoration: "none",
                  borderRadius: 999,
                  border: "1px solid #4b5563",
                  padding: "3px 8px",
                  color: "#e5e7eb",
                }}
              >
                Dashboard
              </a>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  borderRadius: 999,
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "#e5e7eb",
                  fontSize: "0.8rem",
                  padding: "3px 8px",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        {!loggedIn ? (
          <section className="actor-section">
            <p>Bitte oben einloggen, um die Bibliothek zu sehen.</p>
            {loginErr && (
              <p style={{ color: "#f97373", fontSize: "0.85rem" }}>
                {loginErr}
              </p>
            )}
          </section>
        ) : (
          <>
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
                          key={actor.id}
                          className="actor-card"
                          onClick={() => handleShowMoviesForActor(actor.name)}
                        >
                          <div className="actor-avatar-wrapper">
                            {actor.profileImage ? (
                              <img
                                src={actor.profileImage}
                                alt={actor.name}
                                className="actor-avatar"
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.8rem",
                                  color: "#6b7280",
                                }}
                              >
                                Kein Bild
                              </div>
                            )}
                          </div>
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
                                textAlign: "center",
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
          </>
        )}
      </main>
    </div>
  );
}
