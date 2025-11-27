"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
  {
    version: "0.2.0",
    date: "2025-11-27",
    items: [
      "HTTP-Streaming über NAS-Symlink (/1337) vorbereitet",
      "Play-URLs im Frontend auf direkte NAS-Links umgestellt",
      "Version-Hinweis mit Changelog auf Haupt- und Admin-Seite integriert"
    ]
  },
  {
    version: "0.1.0",
    date: "2025-11-26",
    items: [
      "Erstes Admin-Panel für Filme, inkl. Studio, Darsteller & Tags",
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
            zIndex: 80
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
                  Admin – Version & Changelog
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                  1337 Library Admin
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
// Admin-Page
// -------------------------------

export default function AdminPage() {
  const [movies, setMovies] = useState([]);
  const [studios, setStudios] = useState([]);
  const [actors, setActors] = useState([]);
  const [tags, setTags] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const [form, setForm] = useState({
    id: null,
    title: "",
    year: "",
    fileUrl: "",
    studioId: "",
    actorIds: [],
    tagIds: []
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        // Filme inkl. Relationen laden
        const { data: moviesData, error: moviesErr } = await supabase
          .from("movies")
          .select(
            `
            id,
            title,
            file_url,
            year,
            studio_id,
            studios ( id, name ),
            movie_actors (
              actor_id,
              actors ( id, name )
            ),
            movie_tags (
              tag_id,
              tags ( id, name )
            )
          `
          )
          .order("title", { ascending: true });

        if (moviesErr) throw moviesErr;

        const mappedMovies =
          moviesData?.map((m) => ({
            id: m.id,
            title: m.title,
            year: m.year || "",
            fileUrl: m.file_url || "",
            studioId: m.studio_id || "",
            studioName: m.studios?.name || "",
            actorIds:
              m.movie_actors
                ?.map((ma) => ma.actors?.id)
                .filter(Boolean) || [],
            actorNames:
              m.movie_actors
                ?.map((ma) => ma.actors?.name)
                .filter(Boolean) || [],
            tagIds:
              m.movie_tags?.map((mt) => mt.tags?.id).filter(Boolean) || [],
            tagNames:
              m.movie_tags?.map((mt) => mt.tags?.name).filter(Boolean) || []
          })) || [];

        setMovies(mappedMovies);

        // Stammdaten
        const [{ data: studiosData }, { data: actorsData }, { data: tagsData }] =
          await Promise.all([
            supabase.from("studios").select("id, name").order("name"),
            supabase.from("actors").select("id, name").order("name"),
            supabase.from("tags").select("id, name").order("name")
          ]);

        setStudios(studiosData || []);
        setActors(actorsData || []);
        setTags(tagsData || []);
      } catch (e) {
        console.error(e);
        setErr("Fehler beim Laden der Admin-Daten.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const resetForm = () => {
    setForm({
      id: null,
      title: "",
      year: "",
      fileUrl: "",
      studioId: "",
      actorIds: [],
      tagIds: []
    });
    setInfo(null);
    setErr(null);
  };

  const selectMovie = (m) => {
    setForm({
      id: m.id,
      title: m.title || "",
      year: m.year || "",
      fileUrl: m.fileUrl || "",
      studioId: m.studioId || "",
      actorIds: m.actorIds || [],
      tagIds: m.tagIds || []
    });
    setInfo(null);
    setErr(null);
  };

  const toggleIdInArray = (list, id) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleToggleActor = (id) => {
    setForm((prev) => ({
      ...prev,
      actorIds: toggleIdInArray(prev.actorIds, id)
    }));
  };

  const handleToggleTag = (id) => {
    setForm((prev) => ({
      ...prev,
      tagIds: toggleIdInArray(prev.tagIds, id)
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setErr("Titel darf nicht leer sein.");
      return;
    }
    if (!form.fileUrl.trim()) {
      setErr("fileUrl (NAS-Link) darf nicht leer sein.");
      return;
    }

    try {
      setSaving(true);
      setErr(null);
      setInfo(null);

      const payload = {
        title: form.title.trim(),
        file_url: form.fileUrl.trim(),
        year: form.year ? Number(form.year) : null,
        studio_id: form.studioId || null
      };

      let movieId = form.id;

      if (movieId) {
        // Update
        const { data, error } = await supabase
          .from("movies")
          .update(payload)
          .eq("id", movieId)
          .select()
          .single();

        if (error) throw error;
        movieId = data.id;
      } else {
        // Insert
        const { data, error } = await supabase
          .from("movies")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        movieId = data.id;
      }

      // Relationen updaten
      await supabase.from("movie_actors").delete().eq("movie_id", movieId);
      await supabase.from("movie_tags").delete().eq("movie_id", movieId);

      if (form.actorIds.length > 0) {
        await supabase
          .from("movie_actors")
          .insert(
            form.actorIds.map((actorId) => ({
              movie_id: movieId,
              actor_id: actorId
            }))
          );
      }

      if (form.tagIds.length > 0) {
        await supabase
          .from("movie_tags")
          .insert(
            form.tagIds.map((tagId) => ({
              movie_id: movieId,
              tag_id: tagId
            }))
          );
      }

      setInfo("Film gespeichert.");

      // Liste neu laden
      const { data: moviesData, error: moviesErr } = await supabase
        .from("movies")
        .select(
          `
          id,
          title,
          file_url,
          year,
          studio_id,
          studios ( id, name ),
          movie_actors (
            actor_id,
            actors ( id, name )
          ),
          movie_tags (
            tag_id,
            tags ( id, name )
          )
        `
        )
        .order("title", { ascending: true });

      if (moviesErr) throw moviesErr;

      const mappedMovies =
        moviesData?.map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year || "",
          fileUrl: m.file_url || "",
          studioId: m.studio_id || "",
          studioName: m.studios?.name || "",
          actorIds:
            m.movie_actors?.map((ma) => ma.actors?.id).filter(Boolean) || [],
          actorNames:
            m.movie_actors?.map((ma) => ma.actors?.name).filter(Boolean) || [],
          tagIds:
            m.movie_tags?.map((mt) => mt.tags?.id).filter(Boolean) || [],
          tagNames:
            m.movie_tags?.map((mt) => mt.tags?.name).filter(Boolean) || []
        })) || [];

      setMovies(mappedMovies);

      // Form auf aktuellen Datensatz setzen
      const updated = mappedMovies.find((x) => x.id === movieId);
      if (updated) selectMovie(updated);
    } catch (e) {
      console.error(e);
      setErr("Fehler beim Speichern des Films.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    const confirm = window.confirm(
      `Film "${form.title}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
    );
    if (!confirm) return;

    try {
      setSaving(true);
      setErr(null);
      setInfo(null);

      await supabase.from("movie_actors").delete().eq("movie_id", form.id);
      await supabase.from("movie_tags").delete().eq("movie_id", form.id);
      await supabase.from("movies").delete().eq("id", form.id);

      setMovies((prev) => prev.filter((m) => m.id !== form.id));
      resetForm();
      setInfo("Film gelöscht.");
    } catch (e) {
      console.error(e);
      setErr("Fehler beim Löschen des Films.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page admin-page">
      <header className="topbar">
        <div className="logo-text">1337 Library – Admin</div>
        <div style={{ marginLeft: "auto" }}>
          <VersionHint />
        </div>
      </header>

      <main
        className="admin-main"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 2fr)",
          gap: "1.5rem",
          padding: "1.5rem",
          maxWidth: 1400,
          margin: "0 auto"
        }}
      >
        {/* Linke Seite: Liste */}
        <section
          className="admin-panel"
          style={{
            background: "#020617",
            borderRadius: 16,
            border: "1px solid #1f2937",
            padding: "1rem",
            minHeight: 0,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div
            className="admin-panel-header"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem"
            }}
          >
            <h2
              style={{
                fontSize: "1rem",
                margin: 0,
                color: "#e5e7eb"
              }}
            >
              Filme
            </h2>
            <button
              type="button"
              onClick={resetForm}
              style={{
                borderRadius: 999,
                border: "1px solid #4b5563",
                background: "transparent",
                color: "#e5e7eb",
                fontSize: "0.8rem",
                padding: "4px 10px",
                cursor: "pointer"
              }}
            >
              + Neuer Film
            </button>
          </div>

          {loading && <p style={{ fontSize: "0.85rem" }}>Lade Filme …</p>}
          {err && (
            <p
              style={{
                fontSize: "0.85rem",
                color: "#f97373",
                marginBottom: "0.5rem"
              }}
            >
              {err}
            </p>
          )}
          {!loading && movies.length === 0 && (
            <p style={{ fontSize: "0.85rem" }}>Noch keine Filme angelegt.</p>
          )}

          {!loading && movies.length > 0 && (
            <div
              className="admin-movie-list"
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                overflowY: "auto"
              }}
            >
              {movies.map((m) => {
                const active = form.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMovie(m)}
                    style={{
                      textAlign: "left",
                      borderRadius: 12,
                      border: active
                        ? "1px solid #f97316"
                        : "1px solid #111827",
                      background: active ? "#111827" : "#020617",
                      padding: "6px 10px",
                      cursor: "pointer"
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#e5e7eb",
                        fontWeight: 500
                      }}
                    >
                      {m.title}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#9ca3af"
                      }}
                    >
                      {m.year && <span>{m.year}</span>}
                      {m.studioName && (
                        <span>
                          {m.year ? " • " : ""}
                          {m.studioName}
                        </span>
                      )}
                      {m.actorNames?.length > 0 && (
                        <span>
                          {(m.year || m.studioName) ? " • " : ""}
                          {m.actorNames.join(", ")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Rechte Seite: Formular */}
        <section
          className="admin-panel"
          style={{
            background: "#020617",
            borderRadius: 16,
            border: "1px solid #1f2937",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}
        >
          <h2
            style={{
              fontSize: "1rem",
              margin: 0,
              color: "#e5e7eb"
            }}
          >
            {form.id ? "Film bearbeiten" : "Neuen Film anlegen"}
          </h2>

          {info && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#4ade80",
                margin: 0
              }}
            >
              {info}
            </p>
          )}
          {err && (
            <p
              style={{
                fontSize: "0.8rem",
                color: "#f97373",
                margin: 0
              }}
            >
              {err}
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "0.5rem",
              marginTop: "0.5rem"
            }}
          >
            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                Titel
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  padding: "6px 8px",
                  marginTop: 2
                }}
              />
            </div>

            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                Jahr
              </label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => handleInputChange("year", e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  padding: "6px 8px",
                  marginTop: 2
                }}
              />
            </div>

            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                fileUrl (NAS-Link)
              </label>
              <input
                type="text"
                placeholder="z. B. http://192.168.178.72/1337/Ordner/Film.mkv"
                value={form.fileUrl}
                onChange={(e) => handleInputChange("fileUrl", e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  padding: "6px 8px",
                  marginTop: 2
                }}
              />
            </div>

            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                Studio
              </label>
              <select
                value={form.studioId || ""}
                onChange={(e) => handleInputChange("studioId", e.target.value)}
                style={{
                  width: "100%",
                  borderRadius: 8,
                  border: "1px solid #374151",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  padding: "6px 8px",
                  marginTop: 2
                }}
              >
                <option value="">– kein Studio –</option>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                Darsteller
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 4,
                  maxHeight: 140,
                  overflowY: "auto"
                }}
              >
                {actors.map((a) => {
                  const active = form.actorIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleToggleActor(a.id)}
                      style={{
                        borderRadius: 999,
                        border: active
                          ? "1px solid #f97316"
                          : "1px solid #374151",
                        background: active ? "#111827" : "#020617",
                        color: "#e5e7eb",
                        fontSize: "0.75rem",
                        padding: "3px 8px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                style={{ fontSize: "0.8rem", color: "#9ca3af", display: "block" }}
              >
                Tags
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 4,
                  maxHeight: 140,
                  overflowY: "auto"
                }}
              >
                {tags.map((t) => {
                  const active = form.tagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.id)}
                      style={{
                        borderRadius: 999,
                        border: active
                          ? "1px solid #22c55e"
                          : "1px solid #374151",
                        background: active ? "#064e3b" : "#020617",
                        color: "#e5e7eb",
                        fontSize: "0.75rem",
                        padding: "3px 8px",
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: "0.75rem",
              justifyContent: "flex-end"
            }}
          >
            {form.id && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                style={{
                  borderRadius: 999,
                  border: "1px solid #b91c1c",
                  background: "#7f1d1d",
                  color: "#fee2e2",
                  fontSize: "0.85rem",
                  padding: "6px 12px",
                  cursor: "pointer"
                }}
              >
                Löschen
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                borderRadius: 999,
                border: "none",
                background: "#f97316",
                color: "#111827",
                fontSize: "0.85rem",
                padding: "6px 14px",
                fontWeight: 600,
                cursor: "pointer",
                opacity: saving ? 0.7 : 1
              }}
            >
              {saving ? "Speichere …" : "Speichern"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
