"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

let supabase = null;

function getSupabaseClient() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.error("Supabase env vars fehlen!");
    }

    supabase = createClient(url, anonKey);
  }
  return supabase;
}

export default function DashboardPage() {
  const [hauptdarsteller, setHauptdarsteller] = useState([]);
  const [nebendarsteller, setNebendarsteller] = useState([]);
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [filme, setFilme] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stammdaten Inputs
  const [newActorName, setNewActorName] = useState("");
  const [newActorImage, setNewActorImage] = useState("");

  const [newSupportName, setNewSupportName] = useState("");
  const [newSupportImage, setNewSupportImage] = useState("");

  const [newStudioName, setNewStudioName] = useState("");
  const [newStudioImage, setNewStudioImage] = useState("");

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2a2a2a");

  // Film Inputs
  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState("");
  const [selectedMainActorIds, setSelectedMainActorIds] = useState([]);
  const [selectedSupportActorIds, setSelectedSupportActorIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  // Bearbeitungsmodus
  const [editingFilmId, setEditingFilmId] = useState(null);

  useEffect(() => {
    const client = getSupabaseClient();

    const loadAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const [actorsRes, actors2Res, studiosRes, tagsRes, moviesRes] =
          await Promise.all([
            client.from("actors").select("*").order("name"),
            client.from("actors2").select("*").order("name"),
            client.from("studios").select("*").order("name"),
            client.from("tags").select("*").order("name"),
            client
              .from("movies")
              .select("*")
              .order("created_at", { ascending: false })
          ]);

        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (moviesRes.error) throw moviesRes.error;

        setHauptdarsteller(actorsRes.data || []);
        setNebendarsteller(actors2Res.data || []);
        setStudios(studiosRes.data || []);
        setTags(tagsRes.data || []);
        setFilme(moviesRes.data || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const actorMap = Object.fromEntries(hauptdarsteller.map((a) => [a.id, a]));
  const supportMap = Object.fromEntries(nebendarsteller.map((a) => [a.id, a]));
  const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  const handleMultiSelectChange = (event, setter) => {
    const values = Array.from(event.target.selectedOptions).map((o) => o.value);
    setter(values);
  };

  // ---------------- Stammdaten anlegen ----------------

  const handleAddActor = async (e) => {
    e.preventDefault();
    const name = newActorName.trim();
    if (!name) return;

    const client = getSupabaseClient();
    const { data, error: insertError } = await client
      .from("actors")
      .insert({
        name,
        profile_image: newActorImage.trim() || null
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setHauptdarsteller((prev) => [...prev, data]);
    setNewActorName("");
    setNewActorImage("");
  };

  const handleAddSupportActor = async (e) => {
    e.preventDefault();
    const name = newSupportName.trim();
    if (!name) return;

    const client = getSupabaseClient();
    const { data, error: insertError } = await client
      .from("actors2")
      .insert({
        name,
        profile_image: newSupportImage.trim() || null
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setNebendarsteller((prev) => [...prev, data]);
    setNewSupportName("");
    setNewSupportImage("");
  };

  const handleAddStudio = async (e) => {
    e.preventDefault();
    const name = newStudioName.trim();
    if (!name) return;

    const client = getSupabaseClient();
    const { data, error: insertError } = await client
      .from("studios")
      .insert({
        name,
        image_url: newStudioImage.trim() || null
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setStudios((prev) => [...prev, data]);
    setNewStudioName("");
    setNewStudioImage("");
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    const client = getSupabaseClient();
    const { data, error: insertError } = await client
      .from("tags")
      .insert({
        name,
        color: newTagColor
      })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setTags((prev) => [...prev, data]);
    setNewTagName("");
    setNewTagColor("#2a2a2a");
  };

  // ---------------- Film anlegen / bearbeiten ----------------

  const resetFilmForm = () => {
    setFilmTitel("");
    setFilmJahr("");
    setFilmStudioId("");
    setFilmFileUrl("");
    setSelectedMainActorIds([]);
    setSelectedSupportActorIds([]);
    setSelectedTagIds([]);
    setEditingFilmId(null);
  };

  const handleAddOrUpdateFilm = async (e) => {
    e.preventDefault();
    setError(null);

    const title = filmTitel.trim();
    if (!title) {
      setError("Bitte Filmname eingeben.");
      return;
    }

    let year = null;
    if (filmJahr.trim()) {
      const parsed = parseInt(filmJahr.trim(), 10);
      if (Number.isNaN(parsed)) {
        setError("Erscheinungsjahr ist keine gültige Zahl.");
        return;
      }
      year = parsed;
    }

    const payload = {
      title,
      year,
      studio_id: filmStudioId || null,
      file_url: filmFileUrl.trim() || null,
      main_actor_ids:
        selectedMainActorIds.length > 0 ? selectedMainActorIds : null,
      supporting_actor_ids:
        selectedSupportActorIds.length > 0 ? selectedSupportActorIds : null,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : null
    };

    const client = getSupabaseClient();

    if (editingFilmId) {
      // UPDATE
      const { data, error: updateError } = await client
        .from("movies")
        .update(payload)
        .eq("id", editingFilmId)
        .select("*")
        .single();

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
        return;
      }

      setFilme((prev) =>
        prev.map((f) => (f.id === editingFilmId ? data : f))
      );
      resetFilmForm();
    } else {
      // INSERT
      const { data, error: insertError } = await client
        .from("movies")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        console.error(insertError);
        setError(insertError.message);
        return;
      }

      setFilme((prev) => [data, ...prev]);
      resetFilmForm();
    }
  };

  const handleEditFilm = (film) => {
    setEditingFilmId(film.id);
    setFilmTitel(film.title || "");
    setFilmJahr(film.year ? String(film.year) : "");
    setFilmStudioId(film.studio_id || "");
    setFilmFileUrl(film.file_url || "");
    setSelectedMainActorIds(
      Array.isArray(film.main_actor_ids) ? film.main_actor_ids : []
    );
    setSelectedSupportActorIds(
      Array.isArray(film.supporting_actor_ids) ? film.supporting_actor_ids : []
    );
    setSelectedTagIds(Array.isArray(film.tag_ids) ? film.tag_ids : []);
  };

  const handleCancelEdit = () => {
    resetFilmForm();
  };

  const handleDeleteFilm = async (filmId) => {
    const ok = window.confirm("Diesen Film wirklich löschen?");
    if (!ok) return;

    const client = getSupabaseClient();
    const { error: deleteError } = await client
      .from("movies")
      .delete()
      .eq("id", filmId);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setFilme((prev) => prev.filter((f) => f.id !== filmId));
    if (editingFilmId === filmId) {
      resetFilmForm();
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="border-b border-slate-800 pb-4 mb-4 flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">Film-Dashboard</h1>
          <p className="text-sm text-slate-400">
            Filme mit Hauptdarstellern, Nebendarstellern, Studio, Tags und
            NAS-File-URL verwalten.
          </p>
        </header>

        {error && (
          <div className="text-red-400 text-sm rounded border border-red-600 bg-red-950/40 px-3 py-2">
            Fehler: {error}
          </div>
        )}

        {loading ? (
          <p className="text-slate-300 text-sm">Lade Daten…</p>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[2fr,3fr]">
            {/* ============================
                STAMMDATEN (links)
            ============================ */}
            <section className="space-y-6">
              {/* Hauptdarsteller */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Hauptdarsteller ({hauptdarsteller.length})
                  </h2>
                </div>

                <form onSubmit={handleAddActor} className="space-y-2">
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Name"
                    value={newActorName}
                    onChange={(e) => setNewActorName(e.target.value)}
                  />

                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Bild-URL"
                    value={newActorImage}
                    onChange={(e) => setNewActorImage(e.target.value)}
                  />

                  <button
                    type="submit"
                    className="bg-sky-600 rounded px-2 py-1 text-[11px]"
                    disabled={!newActorName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {hauptdarsteller.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1 bg-slate-950/50"
                    >
                      {a.profile_image ? (
                        <Image
                          src={a.profile_image}
                          alt={a.name}
                          width={24}
                          height={24}
                          className="rounded-full border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700 text-[9px] flex items-center justify-center text-slate-400">
                          N/A
                        </div>
                      )}
                      {a.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nebendarsteller */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Nebendarsteller ({nebendarsteller.length})
                  </h2>
                </div>

                <form onSubmit={handleAddSupportActor} className="space-y-2">
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Name"
                    value={newSupportName}
                    onChange={(e) => setNewSupportName(e.target.value)}
                  />

                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Bild-URL"
                    value={newSupportImage}
                    onChange={(e) => setNewSupportImage(e.target.value)}
                  />

                  <button
                    type="submit"
                    className="bg-emerald-600 rounded px-2 py-1 text-[11px]"
                    disabled={!newSupportName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {nebendarsteller.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 border border-slate-700 rounded px-2 py-1 bg-slate-950/50"
                    >
                      {a.profile_image ? (
                        <Image
                          src={a.profile_image}
                          alt={a.name}
                          width={24}
                          height={24}
                          className="rounded-full border border-slate-700 object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-700 text-[9px] flex items-center justify-center text-slate-400">
                          N/A
                        </div>
                      )}
                      {a.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Studios */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Studios ({studios.length})
                  </h2>
                </div>

                <form onSubmit={handleAddStudio} className="space-y-2">
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Studio"
                    value={newStudioName}
                    onChange={(e) => setNewStudioName(e.target.value)}
                  />

                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Bild-URL"
                    value={newStudioImage}
                    onChange={(e) => setNewStudioImage(e.target.value)}
                  />

                  <button
                    type="submit"
                    className="bg-indigo-600 rounded px-2 py-1 text-[11px]"
                    disabled={!newStudioName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>
              </div>

              {/* Tags */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Tags ({tags.length})</h2>
                </div>

                <form onSubmit={handleAddTag} className="space-y-2">
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs"
                    placeholder="Tag"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                  />

                  <input
                    type="color"
                    className="w-10 h-10 border border-slate-700 rounded"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />

                  <button
                    type="submit"
                    className="bg-amber-600 rounded px-2 py-1 text-[11px]"
                    disabled={!newTagName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="flex flex-wrap gap-1 text-[11px] max-h-32 overflow-y-auto">
                  {tags.map((t) => (
                    <span
                      key={t.id}
                      className="px-2 py-[1px] rounded-full border border-slate-700"
                      style={{ backgroundColor: t.color || "#2a2a2a" }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* ============================
                FILM ANLEGEN / BEARBEITEN (rechts)
            ============================ */}
            <section className="space-y-6">
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {editingFilmId ? "Film bearbeiten" : "Neuen Film anlegen"}
                  </h2>
                  {editingFilmId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="text-xs text-slate-300 underline underline-offset-4"
                    >
                      Bearbeitung abbrechen
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddOrUpdateFilm} className="space-y-3">
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm"
                    placeholder="Filmname"
                    value={filmTitel}
                    onChange={(e) => setFilmTitel(e.target.value)}
                  />

                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm"
                    placeholder="Erscheinungsjahr"
                    type="number"
                    value={filmJahr}
                    onChange={(e) => setFilmJahr(e.target.value)}
                  />

                  {/* Studio */}
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm"
                    value={filmStudioId}
                    onChange={(e) => setFilmStudioId(e.target.value)}
                  >
                    <option value="">(kein Studio)</option>
                    {studios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  {/* File URL */}
                  <input
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm"
                    placeholder="File / NAS Pfad"
                    value={filmFileUrl}
                    onChange={(e) => setFilmFileUrl(e.target.value)}
                  />

                  {/* Hauptdarsteller */}
                  <div>
                    <label className="text-[11px] text-slate-300">
                      Hauptdarsteller
                    </label>
                    <select
                      multiple
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm min-h-[80px]"
                      value={selectedMainActorIds}
                      onChange={(e) =>
                        handleMultiSelectChange(e, setSelectedMainActorIds)
                      }
                    >
                      {hauptdarsteller.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nebendarsteller */}
                  <div>
                    <label className="text-[11px] text-slate-300">
                      Nebendarsteller
                    </label>
                    <select
                      multiple
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm min-h-[80px]"
                      value={selectedSupportActorIds}
                      onChange={(e) =>
                        handleMultiSelectChange(e, setSelectedSupportActorIds)
                      }
                    >
                      {nebendarsteller.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="text-[11px] text-slate-300">
                      Tags
                    </label>
                    <select
                      multiple
                      className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-sm min-h-[80px]"
                      value={selectedTagIds}
                      onChange={(e) => handleMultiSelectChange(e, setSelectedTagIds)}
                    >
                      {tags.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="bg-sky-600 mt-2 px-4 py-2 rounded text-xs font-medium"
                    disabled={!filmTitel.trim()}
                  >
                    {editingFilmId ? "Film aktualisieren" : "Film speichern"}
                  </button>
                </form>
              </div>

              {/* Liste aller Filme */}
              <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800 space-y-3">
                <h2 className="text-sm font-semibold">
                  Filme ({filme.length})
                </h2>

                {filme.length === 0 ? (
                  <p className="text-slate-500 text-xs">
                    Noch keine Filme angelegt.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto text-xs">
                    {filme.map((f) => (
                      <div
                        key={f.id}
                        className="p-3 border border-slate-800 rounded bg-slate-950/50 space-y-1"
                      >
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {f.title}
                              </span>
                              {f.year && (
                                <span className="text-slate-400 text-[10px]">
                                  {f.year}
                                </span>
                              )}
                            </div>
                            {f.studio_id && studioMap[f.studio_id] && (
                              <div className="text-slate-400 text-[11px]">
                                Studio: {studioMap[f.studio_id].name}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditFilm(f)}
                              className="text-[10px] px-2 py-1 rounded border border-slate-600 text-slate-100 hover:bg-slate-700"
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFilm(f.id)}
                              className="text-[10px] px-2 py-1 rounded border border-red-600 text-red-200 hover:bg-red-700/70"
                            >
                              Löschen
                            </button>
                          </div>
                        </div>

                        {Array.isArray(f.main_actor_ids) &&
                          f.main_actor_ids.length > 0 && (
                            <div className="text-[11px] text-slate-300">
                              Hauptdarsteller:{" "}
                              {f.main_actor_ids
                                .map((id) => actorMap[id]?.name)
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}

                        {Array.isArray(f.supporting_actor_ids) &&
                          f.supporting_actor_ids.length > 0 && (
                            <div className="text-[11px] text-slate-300">
                              Nebendarsteller:{" "}
                              {f.supporting_actor_ids
                                .map((id) => supportMap[id]?.name)
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          )}

                        {Array.isArray(f.tag_ids) && f.tag_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {f.tag_ids.map((id) => {
                              const t = tagMap[id];
                              if (!t) return null;
                              return (
                                <span
                                  key={id}
                                  className="text-[10px] px-2 py-[1px] rounded-full border border-slate-700"
                                  style={{
                                    backgroundColor: t.color || "#2a2a2a"
                                  }}
                                >
                                  {t.name}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {f.file_url && (
                          <div className="text-sky-300 text-[11px] break-all mt-1">
                            File: {f.file_url}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
