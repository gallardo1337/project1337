"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActorImageUploader from "./ActorImageUploader";

// -------------------------------
// Version / Changelog (wie Startseite)
// -------------------------------

const CHANGELOG = [
  {
    version: "0.3.0",
    date: "2025-11-28",
    items: [
      "Dashboard neu strukturiert: Tabs für Filmestatistik, Neuen Film hinzufügen und Stammdaten",
      "Stammdaten-Bereich aus Filmformular ausgelagert (Übersicht + Bearbeiten/Löschen jeder Kategorie)",
      "Hauptdarsteller- und Nebendarsteller-Formulare mit integriertem Upload & Crop (ActorImageUploader) statt manueller Bild-URL",
      "Bild-Upload via Hostinger (upload.php) final integriert",
      "Nur noch eine Kategorie gleichzeitig sichtbar – deutlich übersichtlicheres UI",
      "Automatische Umschaltung auf 'Neuen Film hinzufügen' beim Bearbeiten eines Films",
      "Pflege von Hauptdarstellern/Nebendarstellern/Studios/Tags komplett überarbeitet und vereinfacht",
      "Backend-Aufräumung und Code-Optimierung im Dashboard"
    ]
  },
  {
    version: "0.2.0",
    date: "2025-11-27",
    items: [
      "HTTP-Streaming über NAS-Symlink (/1337) vorbereitet",
      "Play-Button öffnet direkte NAS-Links (fileUrl) im neuen Tab",
      "Version-Hinweis & Login-Leiste integriert"
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

// Helper für einheitliche Chip-Farben
const chipClass = (active) =>
  "px-2 py-[3px] rounded-full border text-[11px] " +
  (active
    ? "bg-orange-500 border-orange-600 text-black"
    : "bg-slate-900 border-slate-600 text-slate-200");

// -------------------------------
// Dashboard
// -------------------------------

export default function DashboardPage() {
  // Login-Status (wie Startseite)
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
  const [filmFileUrl, setFilmFileUrl] = useState("");
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
          password: loginPassword
        })
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

    const { data, error: insertError } = await supabase
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

    const { data, error: insertError } = await supabase
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
    setFilmFileUrl(film.file_url || "");
    setSelectedMainActorIds(
      Array.isArray(film.main_actor_ids) ? film.main_actor_ids : []
    );
    setSelectedSupportActorIds(
      Array.isArray(film.supporting_actor_ids)
        ? film.supporting_actor_ids
        : []
    );
    setSelectedTagIds(Array.isArray(film.tag_ids) ? film.tag_ids : []);

    // Beim Bearbeiten automatisch auf "Neuen Film hinzufügen" umschalten
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

  return (
    <div className="page">
      {/* Header wie auf Hauptseite, aber mit Link zurück zur Hauptseite */}
      <header className="topbar">
        <div className="logo-text">1337 Library</div>

        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 12
          }}
        >
          <VersionHint />

          {!loggedIn ? (
            <form
              onSubmit={handleLogin}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6
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
                  width: 130
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
                  width: 120
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
                  opacity: loginLoading || !loginPassword ? 0.7 : 1
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
                color: "#9ca3af"
              }}
            >
              <span style={{ color: "#4ade80" }}>
                Willkommen, {loginUser}
              </span>
              <a
                href="/"
                style={{
                  textDecoration: "none",
                  borderRadius: 999,
                  border: "1px solid #4b5563",
                  padding: "3px 8px",
                  color: "#e5e7eb"
                }}
              >
                Hauptseite
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
                  cursor: "pointer"
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
            <p>Bitte oben einloggen, um das Dashboard zu nutzen.</p>
            {loginErr && (
              <p style={{ color: "#f97373", fontSize: "0.85rem" }}>
                {loginErr}
              </p>
            )}
          </section>
        ) : (
          <section style={{ padding: "20px" }}>
            <div className="mx-auto max-w-5xl space-y-6">
              {error && (
                <div
                  className="text-red-400 text-sm rounded border border-red-600 bg-red-950/40 px-3 py-2"
                  style={{ marginBottom: "8px" }}
                >
                  Fehler: {error}
                </div>
              )}

              {loading ? (
                <p className="text-slate-300 text-sm">Lade Daten…</p>
              ) : (
                <>
                  {/* Tabs: Filmestatistik / Neuer Film / Stammdaten */}
                  <section className="space-y-4">
                    <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/60 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setActiveFilmSection("stats")}
                        className={
                          "px-3 py-1 rounded-full transition-colors " +
                          (activeFilmSection === "stats"
                            ? "bg-orange-500 text-black"
                            : "text-slate-200")
                        }
                      >
                        Filmestatistik
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilmSection("new")}
                        className={
                          "px-3 py-1 rounded-full transition-colors " +
                          (activeFilmSection === "new"
                            ? "bg-orange-500 text-black"
                            : "text-slate-200")
                        }
                      >
                        Neuen Film hinzufügen
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFilmSection("meta")}
                        className={
                          "px-3 py-1 rounded-full transition-colors " +
                          (activeFilmSection === "meta"
                            ? "bg-orange-500 text-black"
                            : "text-slate-200")
                        }
                      >
                        Stammdaten
                      </button>
                    </div>

                    {/* Tab: Neuer Film */}
                    {activeFilmSection === "new" && (
                      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="text-lg font-semibold">
                            {editingFilmId
                              ? "Film bearbeiten"
                              : "Neuen Film hinzufügen"}
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

                        <form
                          onSubmit={handleAddOrUpdateFilm}
                          className="space-y-3 text-sm"
                        >
                          {/* Titel + Jahr */}
                          <div className="grid grid-cols-[2fr,1fr] gap-3 max-sm:grid-cols-1">
                            <div>
                              <label className="text-[11px] text-slate-300">
                                Filmname
                              </label>
                              <input
                                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                                value={filmTitel}
                                onChange={(e) => setFilmTitel(e.target.value)}
                                placeholder="z. B. Interstellar"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-slate-300">
                                Erscheinungsjahr
                              </label>
                              <input
                                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                                value={filmJahr}
                                onChange={(e) => setFilmJahr(e.target.value)}
                                placeholder="2014"
                                type="number"
                              />
                            </div>
                          </div>

                          {/* Studio + File URL */}
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <label className="text-[11px] text-slate-300">
                                Studio
                              </label>
                              <select
                                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
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
                              <label className="text-[11px] text-slate-300">
                                File-URL / NAS-Pfad
                              </label>
                              <input
                                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm"
                                value={filmFileUrl}
                                onChange={(e) =>
                                  setFilmFileUrl(e.target.value)
                                }
                                placeholder="z. B. smb://nas/Filme/Interstellar.mkv"
                              />
                            </div>
                          </div>

                          {/* Hauptdarsteller Chips */}
                          <div>
                            <label className="text-[11px] text-slate-300">
                              Hauptdarsteller (klick zum Auswählen / Entfernen)
                            </label>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {hauptdarsteller.length === 0 ? (
                                <span className="text-[11px] text-slate-500">
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
                            <label className="text-[11px] text-slate-300">
                              Nebendarsteller (klick zum Auswählen / Entfernen)
                            </label>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {nebendarsteller.length === 0 ? (
                                <span className="text-[11px] text-slate-500">
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
                            <label className="text-[11px] text-slate-300">
                              Tags (klick zum Auswählen / Entfernen)
                            </label>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tags.length === 0 ? (
                                <span className="text-[11px] text-slate-500">
                                  Noch keine Tags angelegt.
                                </span>
                              ) : (
                                tags.map((t) => {
                                  const active = selectedTagIds.includes(t.id);
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

                          <div className="flex gap-2 pt-2">
                            <button
                              type="submit"
                              className="bg-orange-500 px-4 py-2 rounded text-xs font-medium disabled:opacity-60 text-black"
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
                                className="border border-slate-600 px-3 py-2 rounded text-xs text-slate-200"
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
                      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-sm font-semibold">
                              Filmestatistik
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-1">
                              Insgesamt <strong>{filme.length}</strong> Filme
                              in der Bibliothek.
                            </p>
                          </div>
                        </div>

                        {filme.length === 0 ? (
                          <p className="text-slate-500 text-xs">
                            Noch keine Filme angelegt.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-[360px] overflow-y-auto text-xs">
                            {filme.map((f) => (
                              <div
                                key={f.id}
                                className="p-3 border border-slate-800 rounded bg-slate-950/60 space-y-1"
                              >
                                <div className="flex justify-between gap-2 items-start">
                                  <div className="space-y-1">
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
                                    {f.studio_id &&
                                      studioMap[f.studio_id] && (
                                        <div className="text-slate-400 text-[11px]">
                                          Studio:{" "}
                                          {studioMap[f.studio_id].name}
                                        </div>
                                      )}

                                    {Array.isArray(f.main_actor_ids) &&
                                      f.main_actor_ids.length > 0 && (
                                        <div className="text-[11px] text-slate-300">
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
                                        <div className="text-[11px] text-slate-300">
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
                                        <div className="flex flex-wrap gap-1 mt-1">
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
                                      <div className="text-orange-400 text-[11px] break-all mt-1">
                                        File: {f.file_url}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1">
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: Stammdaten */}
                    {activeFilmSection === "meta" && (
                      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4 text-xs">
                        <h2 className="text-sm font-semibold">Stammdaten</h2>

                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Hauptdarsteller */}
                          <div className="space-y-2">
                            <form
                              onSubmit={handleAddActor}
                              className="space-y-1"
                            >
                              <div className="font-medium">
                                Hauptdarsteller
                              </div>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"
                                placeholder="Name"
                                value={newActorName}
                                onChange={(e) =>
                                  setNewActorName(e.target.value)
                                }
                              />

                              {/* Upload + Crop für Hauptdarsteller */}
                              <ActorImageUploader
                                onUploaded={(url) => setNewActorImage(url)}
                              />

                              <button
                                type="submit"
                                className="mt-1 bg-orange-500 px-2 py-1 rounded text-[10px] text-black disabled:opacity-60"
                                disabled={!newActorName.trim()}
                              >
                                + Haupt
                              </button>
                            </form>

                            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                              {hauptdarsteller.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between gap-2 border border-slate-800 rounded px-2 py-1 bg-slate-950"
                                >
                                  <span>{a.name}</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditActor(a)}
                                      className="text-[10px] px-2 py-[2px] rounded border border-slate-600 text-slate-100 hover:bg-slate-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteActor(a.id)
                                      }
                                      className="text-[10px] px-2 py-[2px] rounded border border-red-600 text-red-200 hover:bg-red-700/70"
                                    >
                                      X
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Nebendarsteller */}
                          <div className="space-y-2">
                            <form
                              onSubmit={handleAddSupportActor}
                              className="space-y-1"
                            >
                              <div className="font-medium">
                                Nebendarsteller
                              </div>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"
                                placeholder="Name"
                                value={newSupportName}
                                onChange={(e) =>
                                  setNewSupportName(e.target.value)
                                }
                              />

                              {/* Upload + Crop für Nebendarsteller */}
                              <ActorImageUploader
                                onUploaded={(url) =>
                                  setNewSupportImage(url)
                                }
                              />

                              <button
                                type="submit"
                                className="mt-1 bg-orange-500 px-2 py-1 rounded text-[10px] text-black disabled:opacity-60"
                                disabled={!newSupportName.trim()}
                              >
                                + Neben
                              </button>
                            </form>

                            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                              {nebendarsteller.map((a) => (
                                <div
                                  key={a.id}
                                  className="flex items-center justify-between gap-2 border border-slate-800 rounded px-2 py-1 bg-slate-950"
                                >
                                  <span>{a.name}</span>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleEditSupportActor(a)
                                      }
                                      className="text-[10px] px-2 py-[2px] rounded border border-slate-600 text-slate-100 hover:bg-slate-700"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteSupportActor(a.id)
                                      }
                                      className="text-[10px] px-2 py-[2px] rounded border border-red-600 text-red-200 hover:bg-red-700/70"
                                    >
                                      X
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Studios */}
                          <div className="space-y-2">
                            <form
                              onSubmit={handleAddStudio}
                              className="space-y-1"
                            >
                              <div className="font-medium">Studios</div>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"
                                placeholder="Studio"
                                value={newStudioName}
                                onChange={(e) =>
                                  setNewStudioName(e.target.value)
                                }
                              />
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"
                                placeholder="Bild-URL (optional)"
                                value={newStudioImage}
                                onChange={(e) =>
                                  setNewStudioImage(e.target.value)
                                }
                              />
                              <button
                                type="submit"
                                className="mt-1 bg-orange-500 px-2 py-1 rounded text-[10px] text-black disabled:opacity-60"
                                disabled={!newStudioName.trim()}
                              >
                                + Studio
                              </button>
                            </form>

                            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                              {studios.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between gap-2 border border-slate-800 rounded px-2 py-1 bg-slate-950"
                                >
                                  <span>{s.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tags */}
                          <div className="space-y-2">
                            <form
                              onSubmit={handleAddTag}
                              className="space-y-1"
                            >
                              <div className="font-medium">Tags</div>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1"
                                placeholder="Tag-Name"
                                value={newTagName}
                                onChange={(e) =>
                                  setNewTagName(e.target.value)
                                }
                              />
                              <button
                                type="submit"
                                className="mt-1 bg-orange-500 px-2 py-1 rounded text-[10px] text-black disabled:opacity-60"
                                disabled={!newTagName.trim()}
                              >
                                + Tag
                              </button>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Vorhanden: {tags.length}
                              </div>
                            </form>

                            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                              {tags.map((t) => (
                                <div
                                  key={t.id}
                                  className="flex items-center justify-between gap-2 border border-slate-800 rounded px-2 py-1 bg-slate-950"
                                >
                                  <span>{t.name}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteTagGlobal(t.id)
                                    }
                                    className="text-[10px] px-2 py-[2px] rounded border border-red-600 text-red-200 hover:bg-red-700/70"
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
                </>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
