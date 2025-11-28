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
      console.error(
        "Supabase env vars fehlen: NEXT_PUBLIC_SUPABASE_URL oder NEXT_PUBLIC_SUPABASE_ANON_KEY"
      );
    }

    supabase = createClient(url, anonKey);
  }
  return supabase;
}

export default function DashboardPage() {
  const [hauptdarsteller, setHauptdarsteller] = useState([]); // actors
  const [nebendarsteller, setNebendarsteller] = useState([]); // actors2
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [filme, setFilme] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form-States: Stammdaten
  const [newActorName, setNewActorName] = useState("");
  const [newActorImage, setNewActorImage] = useState("");

  const [newSupportName, setNewSupportName] = useState("");
  const [newSupportImage, setNewSupportImage] = useState("");

  const [newStudioName, setNewStudioName] = useState("");
  const [newStudioImage, setNewStudioImage] = useState("");

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2a2a2a");

  // Form-States: neuer Film
  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState("");
  const [selectedMainActorIds, setSelectedMainActorIds] = useState([]);
  const [selectedSupportActorIds, setSelectedSupportActorIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  useEffect(() => {
    const client = getSupabaseClient();

    const loadAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const [actorsRes, actors2Res, studiosRes, tagsRes, moviesRes] =
          await Promise.all([
            client
              .from("actors")
              .select("id, name, profile_image, created_at")
              .order("name", { ascending: true }),
            client
              .from("actors2")
              .select("id, name, profile_image, created_at")
              .order("name", { ascending: true }),
            client
              .from("studios")
              .select("id, name, image_url, created_at")
              .order("name", { ascending: true }),
            client
              .from("tags")
              .select("id, name, color, created_at")
              .order("name", { ascending: true }),
            client
              .from("movies")
              .select(
                "id, created_at, title, year, studio_id, file_url, tag_ids, main_actor_ids, supporting_actor_ids"
              )
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
        setError(err.message || "Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  // Helpers zum Auflösen von IDs -> Namen
  const actorMap = Object.fromEntries(
    hauptdarsteller.map((a) => [a.id, a])
  );
  const supportMap = Object.fromEntries(
    nebendarsteller.map((a) => [a.id, a])
  );
  const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  const handleMultiSelectChange = (event, setter) => {
    const options = Array.from(event.target.selectedOptions);
    const values = options.map((opt) => opt.value);
    setter(values);
  };

  // ---- Stammdaten-Anlage ----

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
      .select("id, name, profile_image, created_at")
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
      .select("id, name, profile_image, created_at")
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
      .select("id, name, image_url, created_at")
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
        color: newTagColor || "#2a2a2a"
      })
      .select("id, name, color, created_at")
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

  // ---- Film anlegen ----

  const handleAddFilm = async (e) => {
    e.preventDefault();
    setError(null);

    const title = filmTitel.trim();
    if (!title) {
      setError("Bitte einen Filmtitel eingeben.");
      return;
    }

    let year = null;
    if (filmJahr.trim()) {
      const y = parseInt(filmJahr.trim(), 10);
      if (!Number.isNaN(y)) {
        year = y;
      } else {
        setError("Erscheinungsjahr ist keine gültige Zahl.");
        return;
      }
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
    const { data, error: insertError } = await client
      .from("movies")
      .insert(payload)
      .select(
        "id, created_at, title, year, studio_id, file_url, tag_ids, main_actor_ids, supporting_actor_ids"
      )
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message || "Fehler beim Speichern des Films.");
      return;
    }

    setFilme((prev) => [data, ...prev]);
    // Formular resetten
    setFilmTitel("");
    setFilmJahr("");
    setFilmStudioId("");
    setFilmFileUrl("");
    setSelectedMainActorIds([]);
    setSelectedSupportActorIds([]);
    setSelectedTagIds([]);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="flex flex-col gap-2 border-b border-slate-800 pb-4 mb-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Film-Dashboard
          </h1>
          <p className="text-sm text-slate-400">
            Filme mit Hauptdarstellern, Nebendarstellern, Studio, Tags und
            NAS-File-URL verwalten.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-500 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            Fehler: {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-300">Lade Daten…</div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[2fr,3fr]">
            {/* Linke Spalte: Stammdaten */}
            <section className="space-y-5">
              {/* Hauptdarsteller */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Hauptdarsteller</h2>
                  <span className="text-xs text-slate-400">
                    {hauptdarsteller.length}
                  </span>
                </div>
                <form
                  onSubmit={handleAddActor}
                  className="space-y-2 border-b border-slate-800 pb-3"
                >
                  <input
                    type="text"
                    value={newActorName}
                    onChange={(e) => setNewActorName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    value={newActorImage}
                    onChange={(e) => setNewActorImage(e.target.value)}
                    placeholder="Bild-URL (optional)"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-sky-600 px-2 py-1 text-[11px] font-medium hover:bg-sky-500 disabled:opacity-50"
                    disabled={!newActorName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {hauptdarsteller.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1"
                    >
                      {a.profile_image ? (
                        <div className="relative h-6 w-6 overflow-hidden rounded-full border border-slate-700">
                          <Image
                            src={a.profile_image}
                            alt={a.name}
                            fill
                            sizes="24px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[9px] text-slate-400">
                          N/A
                        </div>
                      )}
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nebendarsteller */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Nebendarsteller</h2>
                  <span className="text-xs text-slate-400">
                    {nebendarsteller.length}
                  </span>
                </div>
                <form
                  onSubmit={handleAddSupportActor}
                  className="space-y-2 border-b border-slate-800 pb-3"
                >
                  <input
                    type="text"
                    value={newSupportName}
                    onChange={(e) => setNewSupportName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    value={newSupportImage}
                    onChange={(e) => setNewSupportImage(e.target.value)}
                    placeholder="Bild-URL (optional)"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-medium hover:bg-emerald-500 disabled:opacity-50"
                    disabled={!newSupportName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {nebendarsteller.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1"
                    >
                      {a.profile_image ? (
                        <div className="relative h-6 w-6 overflow-hidden rounded-full border border-slate-700">
                          <Image
                            src={a.profile_image}
                            alt={a.name}
                            fill
                            sizes="24px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[9px] text-slate-400">
                          N/A
                        </div>
                      )}
                      <span>{a.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Studios */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Studios</h2>
                  <span className="text-xs text-slate-400">
                    {studios.length}
                  </span>
                </div>
                <form
                  onSubmit={handleAddStudio}
                  className="space-y-2 border-b border-slate-800 pb-3"
                >
                  <input
                    type="text"
                    value={newStudioName}
                    onChange={(e) => setNewStudioName(e.target.value)}
                    placeholder="Studioname"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <input
                    type="text"
                    value={newStudioImage}
                    onChange={(e) => setNewStudioImage(e.target.value)}
                    placeholder="Bild-URL (optional)"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-medium hover:bg-indigo-500 disabled:opacity-50"
                    disabled={!newStudioName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {studios.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1"
                    >
                      {s.image_url ? (
                        <div className="relative h-6 w-6 overflow-hidden rounded-full border border-slate-700">
                          <Image
                            src={s.image_url}
                            alt={s.name}
                            fill
                            sizes="24px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[9px] text-slate-400">
                          N/A
                        </div>
                      )}
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Tags</h2>
                  <span className="text-xs text-slate-400">
                    {tags.length}
                  </span>
                </div>
                <form
                  onSubmit={handleAddTag}
                  className="space-y-2 border-b border-slate-800 pb-3"
                >
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Tag-Name (z. B. Sci-Fi)"
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-sky-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-7 w-12 cursor-pointer rounded-md border border-slate-700 bg-slate-900"
                    />
                    <span className="text-[11px] text-slate-400">
                      Tag-Farbe
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-amber-600 px-2 py-1 text-[11px] font-medium hover:bg-amber-500 disabled:opacity-50"
                    disabled={!newTagName.trim()}
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="max-h-40 overflow-y-auto flex flex-wrap gap-1 text-[11px]">
                  {tags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded-full border border-slate-700 px-2 py-[1px]"
                      style={{ backgroundColor: t.color || "#2a2a2a" }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            </section>

            {/* Rechte Spalte: Film-Form + Liste */}
            <section className="space-y-5">
              {/* Film anlegen */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <h2 className="text-lg font-semibold">Neuen Film anlegen</h2>

                <form onSubmit={handleAddFilm} className="space-y-3">
                  {/* Titel */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Filmname
                    </label>
                    <input
                      type="text"
                      value={filmTitel}
                      onChange={(e) => setFilmTitel(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                      placeholder="z. B. Interstellar"
                      required
                    />
                  </div>

                  {/* Jahr + Studio */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Erscheinungsjahr
                      </label>
                      <input
                        type="number"
                        value={filmJahr}
                        onChange={(e) => setFilmJahr(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                        placeholder="z. B. 2014"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-300">
                        Studio
                      </label>
                      <select
                        value={filmStudioId}
                        onChange={(e) => setFilmStudioId(e.target.value)}
                        className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                      >
                        <option value="">(kein Studio)</option>
                        {studios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* File-URL */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      File-URL / NAS-Pfad
                    </label>
                    <input
                      type="text"
                      value={filmFileUrl}
                      onChange={(e) => setFilmFileUrl(e.target.value)}
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500"
                      placeholder="z. B. smb://nas/Filme/Interstellar.mkv"
                    />
                  </div>

                  {/* Hauptdarsteller */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Hauptdarsteller (Mehrfachauswahl)
                    </label>
                    <select
                      multiple
                      value={selectedMainActorIds}
                      onChange={(e) =>
                        handleMultiSelectChange(e, setSelectedMainActorIds)
                      }
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500 min-h-[90px]"
                    >
                      {hauptdarsteller.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nebendarsteller */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Nebendarsteller (Mehrfachauswahl)
                    </label>
                    <select
                      multiple
                      value={selectedSupportActorIds}
                      onChange={(e) =>
                        handleMultiSelectChange(e, setSelectedSupportActorIds)
                      }
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500 min-h-[90px]"
                    >
                      {nebendarsteller.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">
                      Tags
                    </label>
                    <select
                      multiple
                      value={selectedTagIds}
                      onChange={(e) =>
                        handleMultiSelectChange(e, setSelectedTagIds)
                      }
                      className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm outline-none focus:border-sky-500 min-h-[90px]"
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
                    className="mt-2 inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-xs font-medium hover:bg-sky-500 disabled:opacity-50"
                    disabled={!filmTitel.trim()}
                  >
                    Film speichern
                  </button>
                </form>
              </div>

              {/* Filme-Liste */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">Filme</h2>
                  <span className="text-xs text-slate-400">
                    {filme.length}
                  </span>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 text-xs">
                  {filme.length === 0 ? (
                    <p className="text-slate-500">
                      Noch keine Filme angelegt.
                    </p>
                  ) : (
                    filme.map((f) => (
                      <div
                        key={f.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 space-y-1"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-sm font-medium">
                            {f.title}
                          </span>
                          {f.year && (
                            <span className="text-[11px] text-slate-400">
                              {f.year}
                            </span>
                          )}
                        </div>

                        {f.studio_id && studioMap[f.studio_id] && (
                          <div className="text-[11px] text-slate-400">
                            Studio: {studioMap[f.studio_id].name}
                          </div>
                        )}

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

                        {Array.isArray(f.tag_ids) &&
                          f.tag_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {f.tag_ids.map((id) => {
                                const t = tagMap[id];
                                if (!t) return null;
                                return (
                                  <span
                                    key={id}
                                    className="rounded-full border border-slate-700 px-2 py-[1px] text-[10px]"
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
                          <div className="mt-1 text-[11px] text-sky-300 break-all">
                            File: {f.file_url}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
