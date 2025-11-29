"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import dynamic from "next/dynamic";

// ActorImageUploader nur im Client laden (wegen react-easy-crop / Canvas)
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
      "Hauptdarsteller- und Nebendarsteller-Formulare mit integriertem Upload & Crop (ActorImageUploader) statt manueller Bild-URL",
      "Bild-Upload via Hostinger (upload.php) integriert",
      "Nur noch eine Kategorie gleichzeitig sichtbar – übersichtlicheres UI",
      "Dynamic Import für ActorImageUploader (kein SSR-Fehler mehr)",
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

// Helper für Chips – Rot als Akzent
const chipClass = (active) =>
  "px-3 py-1 rounded-full border text-sm " +
  (active
    ? "bg-red-500 border-red-600 text-black"
    : "bg-neutral-900/90 border-neutral-700 text-neutral-100 hover:border-neutral-400 transition-colors");

// -------------------------------
// Dashboard
// -------------------------------

export default function DashboardPage() {
  // Login-Status
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs: Filmestatistik / Neuer Film / Stammdaten
  const [activeFilmSection, setActiveFilmSection] = useState("stats"); // "stats" | "new" | "meta"

  // Daten
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

  // Film Inputs
  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState(
    "http://192.168.178.72/1337/"
  );
  const [selectedMainActorIds, setSelectedMainActorIds] = useState([]);
  const [selectedSupportActorIds, setSelectedSupportActorIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  const [editingFilmId, setEditingFilmId] = useState(null);

  // Login-Status aus localStorage laden
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

  // Daten laden, wenn eingeloggt
  useEffect(() => {
    const loadAll = async () => {
      if (!loggedIn) {
        setHauptdarsteller([]);
        setNebendarsteller([]);
        setStudios([]);
        setTags([]);
        setFilme([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

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
  }, [loggedIn]);

  const actorMap = Object.fromEntries(hauptdarsteller.map((a) => [a.id, a]));
  const supportMap = Object.fromEntries(nebendarsteller.map((a) => [a.id, a]));
  const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));
  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

  const toggleId = (id, arr, setter) => {
    if (arr.includes(id)) {
      setter(arr.filter((x) => x !== id));
    } else {
      setter([...arr, id]);
    }
  };

  // ---------------- Login / Logout ----------------

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
    setLoginPassword("");
    setEditingFilmId(null);
  };

  // ---------------- Stammdaten anlegen ----------------

  const handleAddActor = async (e) => {
    e.preventDefault();
    const name = newActorName.trim();
    if (!name) return;

    const { data, error: insertError } = await supabase
      .from("actors")
      .insert({
        name,
        profile_image: newActorImage.trim() || null,
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

    const { data, error: insertError } = await supabase
      .from("actors2")
      .insert({
        name,
        profile_image: newSupportImage.trim() || null,
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

    const { data, error: insertError } = await supabase
      .from("studios")
      .insert({
        name,
        image_url: newStudioImage.trim() || null,
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

    const { data, error: insertError } = await supabase
      .from("tags")
      .insert({ name })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setTags((prev) => [...prev, data]);
    setNewTagName("");
  };

  // --------- Darsteller & Tag bearbeiten/löschen ---------

  const handleEditActor = async (actor) => {
    const newName = window.prompt(
      "Neuer Name für Hauptdarsteller:",
      actor.name || ""
    );
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const newImg = window.prompt(
      "Neue Bild-URL (leer lassen für unverändert, nur ein Leerzeichen für löschen):",
      actor.profile_image || ""
    );
    let profile_image = actor.profile_image;
    if (newImg !== null) {
      const t = newImg.trim();
      profile_image = t === "" ? null : t;
    }

    const { data, error: updateError } = await supabase
      .from("actors")
      .update({ name: trimmedName, profile_image })
      .eq("id", actor.id)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setHauptdarsteller((prev) =>
      prev.map((a) => (a.id === actor.id ? data : a))
    );
  };

  const handleDeleteActor = async (actorId) => {
    const ok = window.confirm("Diesen Hauptdarsteller wirklich löschen?");
    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("actors")
      .delete()
      .eq("id", actorId);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setHauptdarsteller((prev) => prev.filter((a) => a.id !== actorId));
    setSelectedMainActorIds((prev) => prev.filter((id) => id !== actorId));
  };

  const handleEditSupportActor = async (actor) => {
    const newName = window.prompt(
      "Neuer Name für Nebendarsteller:",
      actor.name || ""
    );
    if (newName === null) return;
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const newImg = window.prompt(
      "Neue Bild-URL (leer lassen für unverändert, nur ein Leerzeichen für löschen):",
      actor.profile_image || ""
    );
    let profile_image = actor.profile_image;
    if (newImg !== null) {
      const t = newImg.trim();
      profile_image = t === "" ? null : t;
    }

    const { data, error: updateError } = await supabase
      .from("actors2")
      .update({ name: trimmedName, profile_image })
      .eq("id", actor.id)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setNebendarsteller((prev) =>
      prev.map((a) => (a.id === actor.id ? data : a))
    );
  };

  const handleDeleteSupportActor = async (actorId) => {
    const ok = window.confirm("Diesen Nebendarsteller wirklich löschen?");
    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("actors2")
      .delete()
      .eq("id", actorId);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setNebendarsteller((prev) => prev.filter((a) => a.id !== actorId));
    setSelectedSupportActorIds((prev) => prev.filter((id) => id !== actorId));
  };

  const handleDeleteTagGlobal = async (tagId) => {
    const ok = window.confirm("Diesen Tag wirklich komplett löschen?");
    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
  };

  // ---------------- Filme anlegen / bearbeiten / löschen ----------------

  const resetFilmForm = () => {
    setFilmTitel("");
    setFilmJahr("");
    setFilmStudioId("");
    setFilmFileUrl("http://192.168.178.72/1337/");
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
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : null,
    };

    if (editingFilmId) {
      const { data, error: updateError } = await supabase
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
      const { data, error: insertError } = await supabase
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
    setFilmFileUrl(film.file_url || "http://192.168.178.72/1337/");
    setSelectedMainActorIds(
      Array.isArray(film.main_actor_ids) ? film.main_actor_ids : []
    );
    setSelectedSupportActorIds(
      Array.isArray(film.supporting_actor_ids)
        ? film.supporting_actor_ids
        : []
    );
    setSelectedTagIds(Array.isArray(film.tag_ids) ? film.tag_ids : []);

    setActiveFilmSection("new");
  };

  const handleCancelEdit = () => {
    resetFilmForm();
  };

  const handleDeleteFilm = async (filmId) => {
    const ok = window.confirm("Diesen Film wirklich löschen?");
    if (!ok) return;

    const { error: deleteError } = await supabase
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

  // ---------------- Render ----------------

  // Hilfs-Component: Sidebar-Inhalt (damit wir ihn für Desktop & Mobile nutzen können)
  const SidebarContent = () => (
    <>
      <div className="rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-950/90 to-black/90 px-5 py-5 shadow-2xl shadow-black/70">
        <h2 className="mb-1 text-base font-semibold text-neutral-50">
          Bereiche
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Wähle aus, was du bearbeiten möchtest.
        </p>

        <div className="flex flex-row gap-2 lg:flex-col">
          <button
            type="button"
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
            type="button"
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
            type="button"
            onClick={() => setActiveFilmSection("meta")}
            className={
              "flex flex-1 items-center justify-between gap-2 rounded-2xl px-4 py-2.5 text-sm transition-all " +
              (activeFilmSection === "meta"
                ? "bg-red-600 text-black shadow-lg shadow-red-900/60"
                : "bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-50")
            }
          >
            <span>Stammdaten</span>
            <span className="text-xs opacity-80">{tags.length} Tags</span>
          </button>
        </div>
      </div>

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
    </>
  );

  return (
    <div className="page min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-900 text-neutral-100 text-[15px]">
      {/* Header */}
      <header className="topbar sticky top-0 z-40 border-b border-neutral-800/70 bg-black/80 backdrop-blur-lg">
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6 relative">
          {/* Links: Hauptseite GANZ LINKS */}
          <div className="flex items-center">
            <a
              href="/"
              className="rounded-full border border-neutral-600 bg-neutral-900/80 px-4 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800 hover:border-neutral-400 transition-all"
            >
              Hauptseite
            </a>
          </div>

          {/* Mitte: 1337 Dashboard absolut zentriert */}
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

          {/* Rechts: Login oder User + Logout GANZ RECHTS */}
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
          <section className="mx-auto mt-16 max-w-md rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/90 p-8 text-center shadow-2xl shadow-black/70">
            <p className="mb-3 text-base text-neutral-200">
              Bitte oben einloggen, um das Dashboard zu nutzen.
            </p>
            <p className="text-sm text-neutral-500">
              Zugang ist nur für den Admin vorgesehen.
            </p>
            {loginErr && (
              <p className="mt-4 text-sm text-red-400">{loginErr}</p>
            )}
          </section>
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
              <>
                {/* Desktop-Layout: Film-Box exakt mittig, Sidebar absolut links daneben */}
                <div className="hidden lg:flex justify-center w-full">
                  <div className="relative w-full max-w-4xl">
                    {/* Sidebar links, beeinflusst das Zentrieren nicht */}
                    <aside className="absolute -left-72 top-0 w-64 space-y-4">
                      <SidebarContent />
                    </aside>

                    {/* Haupt-Content (Filmestatistik / Neuer Film / Stammdaten) */}
                    <section className="w-full space-y-5">
                      {/* Tab: Neuer Film */}
                      {activeFilmSection === "new" && (
                        <div className="group rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950/95 to-black/95 p-6 shadow-2xl shadow-black/70 transition-transform duration-200">
                          <div className="mb-4 flex items-center justify-between gap-2">
                            <div>
                              <h2 className="text-xl font-semibold text-neutral-50">
                                {editingFilmId
                                  ? "Film bearbeiten"
                                  : "Neuen Film hinzufügen"}
                              </h2>
                              <p className="text-sm text-neutral-500">
                                Titel, Jahr, Studio, Cast und Tags festlegen.
                              </p>
                            </div>
                            {editingFilmId && (
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-sm text-neutral-300 underline underline-offset-4 hover:text-neutral-50"
                              >
                                Bearbeitung abbrechen
                              </button>
                            )}
                          </div>

                          <form
                            onSubmit={handleAddOrUpdateFilm}
                            className="space-y-5 text-base"
                          >
                            {/* Titel + Jahr */}
                            <div className="grid grid-cols-[2fr,1fr] gap-4 max-sm:grid-cols-1">
                              <div>
                                <label className="text-sm text-neutral-300">
                                  Filmname
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  value={filmTitel}
                                  onChange={(e) =>
                                    setFilmTitel(e.target.value)
                                  }
                                  placeholder="z. B. Interstellar"
                                />
                              </div>
                              <div>
                                <label className="text-sm text-neutral-300">
                                  Erscheinungsjahr
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  value={filmJahr}
                                  onChange={(e) =>
                                    setFilmJahr(e.target.value)
                                  }
                                  placeholder="2014"
                                  type="number"
                                />
                              </div>
                            </div>

                            {/* Studio + File URL */}
                            <div className="grid grid-cols-1 gap-4">
                              <div>
                                <label className="text-sm text-neutral-300">
                                  Studio
                                </label>
                                <select
                                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 focus:border-red-500 focus:outline-none"
                                  value={filmStudioId}
                                  onChange={(e) =>
                                    setFilmStudioId(e.target.value)
                                  }
                                >
                                  <option value="">(kein Studio)</option>
                                  {studios.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-sm text-neutral-300">
                                  File-URL / NAS-Pfad
                                </label>
                                <input
                                  className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  value={filmFileUrl}
                                  onChange={(e) =>
                                    setFilmFileUrl(e.target.value)
                                  }
                                  placeholder="http://192.168.178.72/1337/"
                                />
                              </div>
                            </div>

                            {/* Hauptdarsteller Chips */}
                            <div>
                              <label className="text-sm text-neutral-300">
                                Hauptdarsteller (klick zum Auswählen / Entfernen)
                              </label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {hauptdarsteller.length === 0 ? (
                                  <span className="text-sm text-neutral-500">
                                    Noch keine Hauptdarsteller angelegt.
                                  </span>
                                ) : (
                                  hauptdarsteller.map((a) => {
                                    const active =
                                      selectedMainActorIds.includes(a.id);
                                    return (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() =>
                                          toggleId(
                                            a.id,
                                            selectedMainActorIds,
                                            setSelectedMainActorIds
                                          )
                                        }
                                        className={chipClass(active)}
                                      >
                                        {a.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Nebendarsteller Chips */}
                            <div>
                              <label className="text-sm text-neutral-300">
                                Nebendarsteller (klick zum Auswählen / Entfernen)
                              </label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {nebendarsteller.length === 0 ? (
                                  <span className="text-sm text-neutral-500">
                                    Noch keine Nebendarsteller angelegt.
                                  </span>
                                ) : (
                                  nebendarsteller.map((a) => {
                                    const active =
                                      selectedSupportActorIds.includes(a.id);
                                    return (
                                      <button
                                        key={a.id}
                                        type="button"
                                        onClick={() =>
                                          toggleId(
                                            a.id,
                                            selectedSupportActorIds,
                                            setSelectedSupportActorIds
                                          )
                                        }
                                        className={chipClass(active)}
                                      >
                                        {a.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Tags Chips */}
                            <div>
                              <label className="text-sm text-neutral-300">
                                Tags (klick zum Auswählen / Entfernen)
                              </label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {tags.length === 0 ? (
                                  <span className="text-sm text-neutral-500">
                                    Noch keine Tags angelegt.
                                  </span>
                                ) : (
                                  tags.map((t) => {
                                    const active =
                                      selectedTagIds.includes(t.id);
                                    return (
                                      <button
                                        key={t.id}
                                        type="button"
                                        onClick={() =>
                                          toggleId(
                                            t.id,
                                            selectedTagIds,
                                            setSelectedTagIds
                                          )
                                        }
                                        className={chipClass(active)}
                                      >
                                        {t.name}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div className="flex gap-3 pt-1">
                              <button
                                type="submit"
                                className="rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-black shadow shadow-red-900/70 hover:bg-red-400 hover:shadow-lg hover:shadow-red-900/70 disabled:opacity-60"
                                disabled={!filmTitel.trim()}
                              >
                                {editingFilmId
                                  ? "Film aktualisieren"
                                  : "Film speichern"}
                              </button>
                              {editingFilmId && (
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="rounded-xl border border-neutral-600 px-4 py-2.5 text-sm text-neutral-200 hover:bg-neutral-800"
                                >
                                  Abbrechen
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      )}

                      {/* Tab: Filmestatistik */}
                      {activeFilmSection === "stats" && (
                        <div className="rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/95 p-6 shadow-2xl shadow-black/70 space-y-4 w-full">
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

                          {filme.length === 0 ? (
                            <p className="text-sm text-neutral-500">
                              Noch keine Filme angelegt.
                            </p>
                          ) : (
                            <div className="space-y-3 text-sm">
                              {filme.map((f) => (
                                <details
                                  key={f.id}
                                  className="group rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-sm shadow-black/60 transition-all hover:border-red-500/70"
                                >
                                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="text-base font-medium text-neutral-50">
                                        {f.title}
                                      </span>
                                      {f.year && (
                                        <span className="text-xs text-neutral-400">
                                          {f.year}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-neutral-500 group-open:text-red-400">
                                      <span>Details</span>
                                      <svg
                                        className="h-3 w-3 transform transition-transform group-open:rotate-90"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                      >
                                        <path
                                          d="M7 5L12 10L7 15"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </div>
                                  </summary>

                                  <div className="mt-3 border-t border-neutral-800 pt-3 space-y-1.5">
                                    {f.studio_id &&
                                      studioMap[f.studio_id] && (
                                        <div className="text-sm text-neutral-400">
                                          Studio:{" "}
                                          {studioMap[f.studio_id].name}
                                        </div>
                                      )}

                                    {Array.isArray(f.main_actor_ids) &&
                                      f.main_actor_ids.length > 0 && (
                                        <div className="text-sm text-neutral-300">
                                          Hauptdarsteller:{" "}
                                          {f.main_actor_ids
                                            .map(
                                              (id) => actorMap[id]?.name
                                            )
                                            .filter(Boolean)
                                            .join(", ")}
                                        </div>
                                      )}

                                    {Array.isArray(f.supporting_actor_ids) &&
                                      f.supporting_actor_ids.length > 0 && (
                                        <div className="text-sm text-neutral-300">
                                          Nebendarsteller:{" "}
                                          {f.supporting_actor_ids
                                            .map(
                                              (id) => supportMap[id]?.name
                                            )
                                            .filter(Boolean)
                                            .join(", ")}
                                        </div>
                                      )}

                                    {Array.isArray(f.tag_ids) &&
                                      f.tag_ids.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-2">
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
                                      <div className="mt-1 break-all text-sm text-red-400">
                                        File: {f.file_url}
                                      </div>
                                    )}

                                    <div className="mt-3 flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEditFilm(f)}
                                        className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                      >
                                        Bearbeiten
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteFilm(f.id)
                                        }
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

                      {/* Tab: Stammdaten */}
                      {activeFilmSection === "meta" && (
                        <section className="rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/95 p-6 text-sm text-neutral-100 shadow-2xl shadow-black/70 space-y-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="text-xl font-semibold text-neutral-50">
                                Stammdaten
                              </h2>
                              <p className="mt-1 text-sm text-neutral-500">
                                Darsteller, Studios und Tags verwalten.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-5 md:grid-cols-2">
                            {/* Hauptdarsteller */}
                            <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4">
                              <form
                                onSubmit={handleAddActor}
                                className="space-y-2"
                              >
                                <div className="font-medium text-neutral-50 text-base">
                                  Hauptdarsteller
                                </div>
                                <input
                                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  placeholder="Name"
                                  value={newActorName}
                                  onChange={(e) =>
                                    setNewActorName(e.target.value)
                                  }
                                />

                                <ActorImageUploader
                                  onUploaded={(url) =>
                                    setNewActorImage(url)
                                  }
                                />

                                <button
                                  type="submit"
                                  className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black shadow shadow-red-900/70 disabled:opacity-60"
                                  disabled={!newActorName.trim()}
                                >
                                  Speichern
                                </button>
                              </form>

                              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                                {hauptdarsteller.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2"
                                  >
                                    <span className="text-sm">{a.name}</span>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEditActor(a)
                                        }
                                        className="rounded border border-neutral-600 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-800"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteActor(a.id)
                                        }
                                        className="rounded border border-red-600 px-2.5 py-1 text-xs text-red-200 hover:bg-red-700/80"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Nebendarsteller */}
                            <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4">
                              <form
                                onSubmit={handleAddSupportActor}
                                className="space-y-2"
                              >
                                <div className="font-medium text-neutral-50 text-base">
                                  Nebendarsteller
                                </div>
                                <input
                                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  placeholder="Name"
                                  value={newSupportName}
                                  onChange={(e) =>
                                    setNewSupportName(e.target.value)
                                  }
                                />

                                <ActorImageUploader
                                  onUploaded={(url) =>
                                    setNewSupportImage(url)
                                  }
                                />

                                <button
                                  type="submit"
                                  className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black shadow shadow-red-900/70 disabled:opacity-60"
                                  disabled={!newSupportName.trim()}
                                >
                                  Speichern
                                </button>
                              </form>

                              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                                {nebendarsteller.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2"
                                  >
                                    <span className="text-sm">{a.name}</span>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleEditSupportActor(a)
                                        }
                                        className="rounded border border-neutral-600 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-800"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteSupportActor(a.id)
                                        }
                                        className="rounded border border-red-600 px-2.5 py-1 text-xs text-red-200 hover:bg-red-700/80"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Studios */}
                            <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4">
                              <form
                                onSubmit={handleAddStudio}
                                className="space-y-2"
                              >
                                <div className="font-medium text-neutral-50 text-base">
                                  Studios
                                </div>
                                <input
                                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  placeholder="Studio"
                                  value={newStudioName}
                                  onChange={(e) =>
                                    setNewStudioName(e.target.value)
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  placeholder="Bild-URL (optional)"
                                  value={newStudioImage}
                                  onChange={(e) =>
                                    setNewStudioImage(e.target.value)
                                  }
                                />
                                <button
                                  type="submit"
                                  className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black shadow shadow-red-900/70 disabled:opacity-60"
                                  disabled={!newStudioName.trim()}
                                >
                                  Speichern
                                </button>
                              </form>

                              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                                {studios.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2"
                                  >
                                    <span className="text-sm">{s.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tags */}
                            <div className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4">
                              <form
                                onSubmit={handleAddTag}
                                className="space-y-2"
                              >
                                <div className="font-medium text-neutral-50 text-base">
                                  Tags
                                </div>
                                <input
                                  className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                                  placeholder="Tag-Name"
                                  value={newTagName}
                                  onChange={(e) =>
                                    setNewTagName(e.target.value)
                                  }
                                />
                                <button
                                  type="submit"
                                  className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black shadow shadow-red-900/70 disabled:opacity-60"
                                  disabled={!newTagName.trim()}
                                >
                                  Speichern
                                </button>
                                <div className="mt-1 text-xs text-neutral-500">
                                  Vorhanden: {tags.length}
                                </div>
                              </form>

                              <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
                                {tags.map((t) => (
                                  <div
                                    key={t.id}
                                    className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2"
                                  >
                                    <span className="text-sm">{t.name}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteTagGlobal(t.id)
                                      }
                                      className="rounded border border-red-600 px-2.5 py-1 text-xs text-red-200 hover:bg-red-700/80"
                                    >
                                      X
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>
                      )}
                    </section>
                  </div>
                </div>

                {/* Mobile-Layout: Sidebar unter der Hauptbox, damit nichts abgeschnitten wird */}
                <div className="mt-8 flex flex-col items-center gap-4 lg:hidden">
                  <div className="w-full max-w-md space-y-4">
                    <SidebarContent />
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* Changelog-Button unten rechts */}
      <div className="fixed bottom-4 right-4 z-40">
        <VersionHint />
      </div>
    </div>
  );
}
