"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  id: null,
  title: "",
  year: "",
  fileUrl: "",
  studioId: "",
  actorIds: [],
  tagIds: []
};

export default function AdminPage() {
  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [tags, setTags] = useState([]);
  const [studios, setStudios] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Felder für "neuen Actor / Tag / Studio" direkt im Panel
  const [newActorName, setNewActorName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newStudioName, setNewStudioName] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setErr("");
      setMsg("");

      const [moviesRes, actorsRes, tagsRes, studiosRes] = await Promise.all([
        supabase
          .from("movies")
          .select(
            `
          id,
          title,
          file_url,
          year,
          studio_id,
          studios ( name ),
          movie_actors ( actor_id ),
          movie_tags ( tag_id )
        `
          )
          .order("title", { ascending: true }),
        supabase.from("actors").select("id,name").order("name", { ascending: true }),
        supabase.from("tags").select("id,name").order("name", { ascending: true }),
        supabase.from("studios").select("id,name").order("name", { ascending: true })
      ]);

      if (moviesRes.error || actorsRes.error || tagsRes.error || studiosRes.error) {
        console.error(moviesRes.error || actorsRes.error || tagsRes.error || studiosRes.error);
        setErr("Fehler beim Laden der Daten aus Supabase.");
        return;
      }

      const mappedMovies =
        moviesRes.data?.map((m) => ({
          id: m.id,
          title: m.title,
          fileUrl: m.file_url,
          year: m.year ?? "",
          studioId: m.studio_id ?? "",
          studioName: m.studios?.name ?? "",
          actorIds: m.movie_actors?.map((ma) => ma.actor_id) || [],
          tagIds: m.movie_tags?.map((mt) => mt.tag_id) || []
        })) || [];

      setMovies(mappedMovies);
      setActors(actorsRes.data || []);
      setTags(tagsRes.data || []);
      setStudios(studiosRes.data || []);
    } finally {
      setLoading(false);
    }
  }

  function startNewMovie() {
    setForm(emptyForm);
    setMsg("");
    setErr("");
  }

  function startEditMovie(m) {
    setForm({
      id: m.id,
      title: m.title || "",
      year: m.year || "",
      fileUrl: m.fileUrl || "",
      studioId: m.studioId || "",
      actorIds: m.actorIds || [],
      tagIds: m.tagIds || []
    });
    setMsg("");
    setErr("");
  }

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleIdInArray(field, id) {
    setForm((prev) => {
      const arr = new Set(prev[field] || []);
      if (arr.has(id)) arr.delete(id);
      else arr.add(id);
      return { ...prev, [field]: Array.from(arr) };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");

    try {
      if (!form.title.trim() || !form.fileUrl.trim()) {
        setErr("Titel und Dateipfad (fileUrl) sind Pflicht.");
        return;
      }

      // Jahr in Zahl wandeln oder null
      const yearValue = form.year ? Number(form.year) : null;

      let movieId = form.id;

      if (!movieId) {
        // INSERT
        const { data, error } = await supabase
          .from("movies")
          .insert([
            {
              title: form.title.trim(),
              file_url: form.fileUrl.trim(),
              year: yearValue,
              studio_id: form.studioId || null
            }
          ])
          .select()
          .single();

        if (error) {
          console.error(error);
          setErr("Fehler beim Anlegen des Films.");
          return;
        }
        movieId = data.id;
      } else {
        // UPDATE
        const { error } = await supabase
          .from("movies")
          .update({
            title: form.title.trim(),
            file_url: form.fileUrl.trim(),
            year: yearValue,
            studio_id: form.studioId || null
          })
          .eq("id", movieId);

        if (error) {
          console.error(error);
          setErr("Fehler beim Aktualisieren des Films.");
          return;
        }
      }

      // Verknüpfungen neu setzen (Actors/Tags)
      // Erst alte Einträge löschen
      await supabase.from("movie_actors").delete().eq("movie_id", movieId);
      await supabase.from("movie_tags").delete().eq("movie_id", movieId);

      if (form.actorIds?.length) {
        const rows = form.actorIds.map((actorId) => ({
          movie_id: movieId,
          actor_id: actorId
        }));
        const { error } = await supabase.from("movie_actors").insert(rows);
        if (error) {
          console.error(error);
          setErr("Film gespeichert, aber Fehler beim Speichern der Darsteller.");
          return;
        }
      }

      if (form.tagIds?.length) {
        const rows = form.tagIds.map((tagId) => ({
          movie_id: movieId,
          tag_id: tagId
        }));
        const { error } = await supabase.from("movie_tags").insert(rows);
        if (error) {
          console.error(error);
          setErr("Film gespeichert, aber Fehler beim Speichern der Tags.");
          return;
        }
      }

      setMsg("Film gespeichert.");
      setForm((prev) => ({ ...prev, id: movieId }));
      await loadAll(); // Liste neu laden
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMovie(id) {
    if (!id) return;
    if (!window.confirm("Diesen Film wirklich löschen?")) return;

    setSaving(true);
    setMsg("");
    setErr("");

    try {
      // durch foreign keys mit on delete cascade werden movie_actors/movie_tags mit gelöscht
      const { error } = await supabase.from("movies").delete().eq("id", id);
      if (error) {
        console.error(error);
        setErr("Fehler beim Löschen.");
        return;
      }
      setMsg("Film gelöscht.");
      if (form.id === id) setForm(emptyForm);
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateActor(e) {
    e.preventDefault();
    const name = newActorName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("actors")
      .insert([{ name }])
      .select()
      .single();
    if (error) {
      console.error(error);
      setErr("Fehler beim Anlegen des Darstellers.");
      return;
    }
    setActors((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewActorName("");
  }

  async function handleCreateTag(e) {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("tags")
      .insert([{ name }])
      .select()
      .single();
    if (error) {
      console.error(error);
      setErr("Fehler beim Anlegen des Tags.");
      return;
    }
    setTags((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewTagName("");
  }

  async function handleCreateStudio(e) {
    e.preventDefault();
    const name = newStudioName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("studios")
      .insert([{ name }])
      .select()
      .single();
    if (error) {
      console.error(error);
      setErr("Fehler beim Anlegen des Studios.");
      return;
    }
    setStudios((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewStudioName("");
  }

  return (
    <div className="page admin-page">
      <header className="topbar">
        <div className="logo-text">1337 Library · Admin</div>
      </header>

      <main className="admin-main">
        <section className="admin-left">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2>{form.id ? "Film bearbeiten" : "Neuer Film"}</h2>
              {form.id && (
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={startNewMovie}
                >
                  Neu anlegen
                </button>
              )}
            </div>

            <form className="admin-form" onSubmit={handleSave}>
              <label className="admin-field">
                <span>Titel</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => updateFormField("title", e.target.value)}
                  required
                />
              </label>

              <label className="admin-field">
                <span>Jahr</span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => updateFormField("year", e.target.value)}
                />
              </label>

              <label className="admin-field">
                <span>Dateipfad / URL (NAS)</span>
                <input
                  type="text"
                  value={form.fileUrl}
                  onChange={(e) => updateFormField("fileUrl", e.target.value)}
                  placeholder="z. B. http://nas/Filme/Darsteller/Film.mkv"
                  required
                />
              </label>

              <label className="admin-field">
                <span>Studio</span>
                <select
                  value={form.studioId || ""}
                  onChange={(e) => updateFormField("studioId", e.target.value)}
                >
                  <option value="">– kein Studio –</option>
                  {studios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="admin-inline-group">
                <label className="admin-field">
                  <span>Neues Studio</span>
                  <input
                    type="text"
                    value={newStudioName}
                    onChange={(e) => setNewStudioName(e.target.value)}
                  />
                </label>
                <button
                  className="admin-mini-btn"
                  type="button"
                  onClick={handleCreateStudio}
                >
                  +
                </button>
              </div>

              <div className="admin-multiselect">
                <div className="admin-multiselect-header">
                  <span>Darsteller</span>
                  <span className="admin-count">
                    {form.actorIds.length} ausgewählt
                  </span>
                </div>
                <div className="admin-multiselect-grid">
                  {actors.map((a) => {
                    const active = form.actorIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={
                          "admin-pill-btn" + (active ? " admin-pill-btn-active" : "")
                        }
                        onClick={() => toggleIdInArray("actorIds", a.id)}
                      >
                        {a.name}
                      </button>
                    );
                  })}
                </div>
                <div className="admin-inline-group">
                  <label className="admin-field">
                    <span>Neuer Darsteller</span>
                    <input
                      type="text"
                      value={newActorName}
                      onChange={(e) => setNewActorName(e.target.value)}
                    />
                  </label>
                  <button
                    className="admin-mini-btn"
                    type="button"
                    onClick={handleCreateActor}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="admin-multiselect">
                <div className="admin-multiselect-header">
                  <span>Tags</span>
                  <span className="admin-count">
                    {form.tagIds.length} ausgewählt
                  </span>
                </div>
                <div className="admin-multiselect-grid">
                  {tags.map((t) => {
                    const active = form.tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={
                          "admin-pill-btn" + (active ? " admin-pill-btn-active" : "")
                        }
                        onClick={() => toggleIdInArray("tagIds", t.id)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                <div className="admin-inline-group">
                  <label className="admin-field">
                    <span>Neuer Tag</span>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                  </label>
                  <button
                    className="admin-mini-btn"
                    type="button"
                    onClick={handleCreateTag}
                  >
                    +
                  </button>
                </div>
              </div>

              {err && <p className="admin-message admin-error">{err}</p>}
              {msg && <p className="admin-message admin-success">{msg}</p>}

              <div className="admin-actions">
                {form.id && (
                  <button
                    type="button"
                    className="admin-danger-btn"
                    onClick={() => handleDeleteMovie(form.id)}
                    disabled={saving}
                  >
                    Löschen
                  </button>
                )}
                <button type="submit" className="admin-primary-btn" disabled={saving}>
                  {saving ? "Speichere …" : "Speichern"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="admin-right">
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2>Filme ({movies.length})</h2>
              <button
                type="button"
                className="admin-secondary-btn"
                onClick={startNewMovie}
              >
                Neuer Film
              </button>
            </div>

            {loading ? (
              <p>Lade Filme …</p>
            ) : movies.length === 0 ? (
              <p>Noch keine Filme angelegt.</p>
            ) : (
              <div className="admin-movie-list">
                {movies.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={
                      "admin-movie-row" + (form.id === m.id ? " admin-movie-row-active" : "")
                    }
                    onClick={() => startEditMovie(m)}
                  >
                    <div className="admin-movie-main">
                      <span className="admin-movie-title">{m.title}</span>
                      <span className="admin-movie-meta">
                        {m.year && <span>{m.year}</span>}
                        {m.studioName && (
                          <span>{m.year ? " • " : ""}{m.studioName}</span>
                        )}
                      </span>
                    </div>
                    <div className="admin-movie-tags">
                      {m.tags?.length > 0 && (
                        <span className="admin-movie-tagline">
                          {m.tags.join(", ")}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
