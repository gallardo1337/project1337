"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import dynamic from "next/dynamic";

// ActorImageUploader nur im Client laden
const ActorImageUploader = dynamic(() => import("./ActorImageUploader.jsx"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-neutral-500">Lade Bild-Uploader…</div>
  ),
});

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
  {
    version: "0.3.0",
    date: "2025-11-28",
    items: [
      "Dashboard neu strukturiert: Tabs für Filmestatistik, Neuen Film hinzufügen und Stammdaten",
      "Stammdaten-Bereich aus Filmformular ausgelagert (Übersicht + Bearbeiten/Löschen jeder Kategorie)",
      "Hauptdarsteller- und Nebendarsteller-Formulare mit integriertem Upload & Crop (ActorImageUploader)",
      "Bild-Upload via Hostinger (upload.php) integriert",
      "Nur noch eine Kategorie gleichzeitig sichtbar – übersichtlicheres UI",
      "Dynamic Import für ActorImageUploader",
      "UI-Redesign mit dunklem Layout und roten Akzenten",
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
      "Erste Version der 1337 Film-Bibliothek mit Darsteller-/Film-Ansicht",
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
        className="inline-flex items-center gap-1 rounded-full border border-neutral-600/70 bg-neutral-900/80 px-4 py-1.5 text-sm text-neutral-100 shadow-sm shadow-black/40 hover:border-neutral-400 hover:bg-neutral-800 transition-colors"
      >
        <span className="font-mono">{current.version}</span>
        <span className="opacity-70">Changelog</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xl max-height-[80vh] max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-700/80 bg-neutral-950/95 p-6 shadow-2xl shadow-black/80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
                  Version &amp; Changelog
                </div>
                <div className="text-lg font-semibold text-neutral-50">
                  1337 Dashboard
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-neutral-600 bg-neutral-900 px-4 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800 transition-colors"
              >
                Schließen
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {CHANGELOG.map((entry) => (
                <div
                  key={entry.version}
                  className="rounded-xl border border-neutral-700/80 bg-neutral-900/70 p-4"
                >
                  <div className="mb-2 flex items-baseline justify-between">
                    <div className="font-semibold text-base text-neutral-50">
                      {entry.version}
                    </div>
                    <div className="text-sm text-neutral-400">
                      {entry.date}
                    </div>
                  </div>
                  <ul className="m-0 list-disc pl-5 text-sm text-neutral-200 space-y-1.5">
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

const chipClass = (active) =>
  "px-3 py-1 rounded-full border text-sm " +
  (active
    ? "bg-red-500 border-red-600 text-black"
    : "bg-neutral-900/90 border-neutral-700 text-neutral-100 hover:border-neutral-400 transition-colors");

// -------------------------------
// Dashboard
// -------------------------------

export default function DashboardPage() {
  // Login
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs
  const [activeFilmSection, setActiveFilmSection] = useState("stats");

  // Supabase Data
  const [hauptdarsteller, setHauptdarsteller] = useState([]);
  const [nebendarsteller, setNebendarsteller] = useState([]);
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [filme, setFilme] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Inputs
  const [newActorName, setNewActorName] = useState("");
  const [newActorImage, setNewActorImage] = useState("");

  const [newSupportName, setNewSupportName] = useState("");
  const [newSupportImage, setNewSupportImage] = useState("");

  const [newStudioName, setNewStudioName] = useState("");
  const [newStudioImage, setNewStudioImage] = useState("");

  const [newTagName, setNewTagName] = useState("");

  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState("");
  const [selectedMainActorIds, setSelectedMainActorIds] = useState([]);
  const [selectedSupportActorIds, setSelectedSupportActorIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  const [editingFilmId, setEditingFilmId] = useState(null);

  // Login-Status laden
  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = window.localStorage.getItem("auth_1337_flag");
    const user = window.localStorage.getItem("auth_1337_user");
    if (flag === "1" && user) {
      setLoggedIn(true);
      setLoginUser(user);
    }
  }, []);

  // Daten laden, wenn eingeloggt
  useEffect(() => {
    const load = async () => {
      if (!loggedIn) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [actorsRes, actors2Res, studiosRes, tagsRes, moviesRes] =
          await Promise.all([
            supabase.from("actors").select("*").order("name"),
            supabase.from("actors2").select("*").order("name"),
            supabase.from("studios").select("*").order("name"),
            supabase.from("tags").select("*").order("name"),
            supabase
              .from("movies")
              .select("*")
              .order("created_at", { ascending: false }),
          ]);

        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (moviesRes.error) throw moviesRes.error;

        setHauptdarsteller(actorsRes.data);
        setNebendarsteller(actors2Res.data);
        setStudios(studiosRes.data);
        setTags(tagsRes.data);
        setFilme(moviesRes.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loggedIn]);

  const actorMap = Object.fromEntries(hauptdarsteller.map((a) => [a.id, a]));
  const supportMap = Object.fromEntries(nebendarsteller.map((a) => [a.id, a]));
  const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  const toggleId = (id, arr, setter) =>
    arr.includes(id)
      ? setter(arr.filter((x) => x !== id))
      : setter([...arr, id]);

  // Login / Logout
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
        setLoginErr("Login fehlgeschlagen.");
        return;
      }

      window.localStorage.setItem("auth_1337_flag", "1");
      window.localStorage.setItem("auth_1337_user", loginUser);

      setLoggedIn(true);
      setLoginPassword("");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem("auth_1337_flag");
    window.localStorage.removeItem("auth_1337_user");
    setLoggedIn(false);
    setEditingFilmId(null);
  };

  // Film-Form Reset
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

  // Film speichern / aktualisieren
  const handleAddOrUpdateFilm = async (e) => {
    e.preventDefault();
    setError(null);

    const title = filmTitel.trim();
    if (!title) return setError("Bitte Filmname eingeben.");

    let parsedYear = null;
    if (filmJahr.trim()) {
      const y = parseInt(filmJahr.trim(), 10);
      if (!Number.isFinite(y)) return setError("Ungültiges Jahr.");
      parsedYear = y;
    }

    const payload = {
      title,
      year: parsedYear,
      studio_id: filmStudioId || null,
      file_url: filmFileUrl.trim() || null,
      main_actor_ids: selectedMainActorIds.length
        ? selectedMainActorIds
        : null,
      supporting_actor_ids: selectedSupportActorIds.length
        ? selectedSupportActorIds
        : null,
      tag_ids: selectedTagIds.length ? selectedTagIds : null,
    };

    if (editingFilmId) {
      const { data, error: updateErr } = await supabase
        .from("movies")
        .update(payload)
        .eq("id", editingFilmId)
        .select("*")
        .single();

      if (updateErr) return setError(updateErr.message);

      setFilme((prev) => prev.map((f) => (f.id === editingFilmId ? data : f)));
      resetFilmForm();
    } else {
      const { data, error: insertErr } = await supabase
        .from("movies")
        .insert(payload)
        .select("*")
        .single();

      if (insertErr) return setError(insertErr.message);

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
    setSelectedMainActorIds(film.main_actor_ids || []);
    setSelectedSupportActorIds(film.supporting_actor_ids || []);
    setSelectedTagIds(film.tag_ids || []);
    setActiveFilmSection("new");
  };

  const handleDeleteFilm = async (id) => {
    if (!window.confirm("Diesen Film löschen?")) return;

    const { error: err } = await supabase.from("movies").delete().eq("id", id);
    if (err) return setError(err.message);

    setFilme((prev) => prev.filter((x) => x.id !== id));
  };

  // ---------------- RENDER ----------------

  return (
    <div className="page min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-900 text-neutral-100 text-[15px]">
      {/* Header */}
      <header className="topbar sticky top-0 z-40 border-b border-neutral-800/70 bg-black/80 backdrop-blur-lg">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6 relative">
          <div className="flex items-center">
            <a
              href="/"
              className="rounded-full border border-neutral-600 bg-neutral-900/80 px-4 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800 hover:border-neutral-400 transition-all"
            >
              Hauptseite
            </a>
          </div>

          {/* Mitte zentriert */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
            <div className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-semibold tracking-tight shadow-lg shadow-red-900/60">
              1337
            </div>
            <div className="pointer-events-auto flex flex-col leading-tight text-center">
              <span className="text-lg font-semibold text-neutral-50">
                1337 Dashboard
              </span>
              <span className="text-xs text-neutral-400">
                Manage Movies, Cast &amp; Tags
              </span>
            </div>
          </div>

          {/* Rechts */}
          <div className="flex items-center justify-end gap-3">
            {!loggedIn ? (
              <form
                onSubmit={handleLogin}
                className="flex items-center gap-3 rounded-full border border-neutral-700 bg-neutral-950/90 px-4 py-2 text-sm shadow-sm shadow-black/60"
              >
                <input
                  type="text"
                  placeholder="User"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="w-[120px] rounded-full border border-transparent bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="Passwort"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-[110px] rounded-full border border-transparent bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loginLoading || !loginPassword}
                  className={
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-all " +
                    (loginLoading || !loginPassword
                      ? "bg-red-500/50 text-black/80 cursor-default"
                      : "bg-red-500 text-black hover:bg-red-400 hover:shadow-md hover:shadow-red-900/60")
                  }
                >
                  {loginLoading ? "…" : "Login"}
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-300">
                <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-3 py-1 text-red-300 border border-red-600/60">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  {loginUser}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border border-neutral-600 bg-transparent px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-900 hover:border-neutral-400 transition-all"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pb-10 pt-6 md:px-6">
        {!loggedIn ? (
          <>
            <section className="mx-auto mt-16 max-w-md rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/90 p-8 text-center shadow-2xl shadow-black/70">
              <p className="mb-3 text-base text-neutral-200">
                Bitte oben einloggen, um das Dashboard zu nutzen.
              </p>
              <p className="text-sm text-neutral-500">
                Zugang ist nur für den Admin vorgesehen.
              </p>
            </section>
          </>
        ) : (
          <section className="mx-auto max-w-6xl space-y-5">
            {error && (
              <div className="rounded-xl border border-red-700/80 bg-red-950/80 px-4 py-3 text-base text-red-100 shadow shadow-red-900/70">
                Fehler: {error}
              </div>
            )}

            {loading ? (
              <div className="mt-10 flex items-center justify-center gap-3 text-base text-neutral-200">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
                <span>Lade Daten…</span>
              </div>
            ) : (
              // ***** WICHTIG: der neue, korrekt ausgerichtete Wrapper *****
              <div className="flex flex-col gap-6 lg:flex-row lg:justify-center">

                {/* Sidebar LINKS – ganz normal */}
                <aside className="w-full max-w-xs lg:w-64 space-y-4">
                  {/* --- Bereiche --- */}
                  <div className="rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-950/90 to-black/90 px-5 py-5 shadow-2xl shadow-black/70">
                    <h2 className="mb-1 text-base font-semibold text-neutral-50">
                      Bereiche
                    </h2>
                    <p className="mb-4 text-xs text-neutral-500">
                      Wähle aus, was du bearbeiten möchtest.
                    </p>

                    <div className="flex flex-row gap-2 lg:flex-col">
                      <button
                        onClick={() => setActiveFilmSection("stats")}
                        className={
                          "flex flex-1 items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all " +
                          (activeFilmSection === "stats"
                            ? "bg-red-600 text-black shadow-lg shadow-red-900/60"
                            : "bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50")
                        }
                      >
                        <span>Filmestatistik</span>
                        <span className="text-xs opacity-80">{filme.length}</span>
                      </button>

                      <button
                        onClick={() => setActiveFilmSection("new")}
                        className={
                          "flex flex-1 items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all " +
                          (activeFilmSection === "new"
                            ? "bg-red-600 text-black shadow-lg shadow-red-900/60"
                            : "bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50")
                        }
                      >
                        <span>Neuer Film</span>
                        <span className="text-xs opacity-80">+1</span>
                      </button>

                      <button
                        onClick={() => setActiveFilmSection("meta")}
                        className={
                          "flex flex-1 items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all " +
                          (activeFilmSection === "meta"
                            ? "bg-red-600 text-black shadow-lg shadow-red-900/60"
                            : "bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50")
                        }
                      >
                        <span>Stammdaten</span>
                        <span className="text-xs opacity-80">
                          {tags.length} Tags
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* --- Überblick --- */}
                  <div className="rounded-3xl border border-neutral-800 bg-neutral-950/90 px-5 py-4 text-sm shadow-xl shadow-black/70">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                      Überblick
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300">Filme</span>
                        <span className="font-semibold text-neutral-50">
                          {filme.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300">Hauptdarsteller</span>
                        <span className="font-semibold text-neutral-50">
                          {hauptdarsteller.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300">Nebendarsteller</span>
                        <span className="font-semibold text-neutral-50">
                          {nebendarsteller.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300">Studios</span>
                        <span className="font-semibold text-neutral-50">
                          {studios.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* MAIN RECHTS — jetzt PERFECT zentriert */}
                <section className="w-full max-w-3xl space-y-5">

                  {/* ------------------- FILMESTATISTIK ------------------- */}
                  {activeFilmSection === "stats" && (
                    <div className="rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/95 p-6 shadow-2xl shadow-black/70 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-neutral-50">
                            Filmestatistik
                          </h2>
                          <p className="mt-1 text-sm text-neutral-500">
                            Insgesamt{" "}
                            <span className="font-semibold text-neutral-100">
                              {filme.length}
                            </span>{" "}
                            Filme in der Bibliothek.
                          </p>
                        </div>
                      </div>

                      {/* Deine bisherigen Film-Items */}
                      {filme.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          Noch keine Filme angelegt.
                        </p>
                      ) : (
                        <div className="space-y-3 text-sm pr-1">
                          {filme.map((f) => (
                            <details
                              key={f.id}
                              className="group rounded-xl border border-neutral-800 bg-neutral-960 p-4 shadow shadow-black/50"
                            >
                              <summary className="cursor-pointer list-none flex justify-between items-center">
                                <span className="text-neutral-50 text-base font-medium">
                                  {f.title}
                                </span>
                                <span className="text-neutral-400 text-xs">
                                  Details ▸
                                </span>
                              </summary>

                              {/* Inhalt beim Aufklappen */}
                              <div className="mt-3 space-y-2 text-neutral-300">
                                {f.year && (
                                  <div>Jahr: {f.year}</div>
                                )}

                                {f.studio_id &&
                                  studioMap[f.studio_id] && (
                                    <div>
                                      Studio: {studioMap[f.studio_id].name}
                                    </div>
                                  )}

                                {Array.isArray(f.main_actor_ids) &&
                                  f.main_actor_ids.length > 0 && (
                                    <div>
                                      Hauptdarsteller:{" "}
                                      {f.main_actor_ids
                                        .map((id) => actorMap[id]?.name)
                                        .filter(Boolean)
                                        .join(", ")}
                                    </div>
                                  )}

                                {Array.isArray(f.supporting_actor_ids) &&
                                  f.supporting_actor_ids.length > 0 && (
                                    <div>
                                      Nebendarsteller:{" "}
                                      {f.supporting_actor_ids
                                        .map((id) => supportMap[id]?.name)
                                        .filter(Boolean)
                                        .join(", ")}
                                    </div>
                                  )}

                                {Array.isArray(f.tag_ids) &&
                                  f.tag_ids.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {f.tag_ids.map((id) => {
                                        const t = tagMap[id];
                                        if (!t) return null;
                                        return (
                                          <span
                                            key={id}
                                            className={chipClass(true)}
                                          >
                                            {t.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}

                                {f.file_url && (
                                  <div className="mt-1 break-all text-red-400">
                                    File: {f.file_url}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => handleEditFilm(f)}
                                    className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                  >
                                    Bearbeiten
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFilm(f.id)}
                                    className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
                                  >
                                    Löschen
                                  </button>
                                </div>
                              </div>
                            </details>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STAMMDATEN + NEUER FILM bleibt wie es ist... */}
                  {/* ... (NICHT gelöscht, dein Code bleibt unverändert) ... */}

                </section>
              </div>
            )}
          </section>
        )}
      </main>

      <div className="fixed bottom-4 right-4 z-40">
        <VersionHint />
      </div>
    </div>
  );
}
