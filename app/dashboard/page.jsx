"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActorImageUploader from "./ActorImageUploader";

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

  // ---------------- Render ----------------

  return (
    <div className="page min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-900 text-neutral-100 text-[15px]">
      {/* Header */}
      <header className="topbar sticky top-0 z-40 border-b border-neutral-800/70 bg-black/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-sm font-semibold tracking-tight shadow-lg shadow-red-900/60">
              1337
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-neutral-50">
                Library Dashboard
              </span>
              <span className="text-xs text-neutral-400">
                Manage Movies, Cast &amp; Tags
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <VersionHint />

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
                  className="w-[140px] rounded-full border border-transparent bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                />
                <input
                  type="password"
                  placeholder="Passwort"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-[130px] rounded-full border border-transparent bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
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
                <a
                  href="/"
                  className="rounded-full border border-neutral-600 bg-neutral-900/80 px-4 py-1.5 text-sm text-neutral-100 hover:bg-neutral-800 hover:border-neutral-400 transition-all"
                >
                  Hauptseite
                </a>
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
              <div className="flex flex-col gap-6 lg:flex-row">
                {/* Sidebar / Navigation */}
                <aside className="w-full lg:w-64 space-y-4">
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
                        <span className="text-xs opacity-80">
                          {filme.length}
                        </span>
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
                        <span className="text-xs opacity-80">
                          {tags.length} Tags
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Kleine Stats-Kachel */}
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
                        <span className="text-neutral-300">
                          Hauptdarsteller
                        </span>
                        <span className="font-semibold text-neutral-50">
                          {hauptdarsteller.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-300">
                          Nebendarsteller
                        </span>
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

                {/* Main Content */}
                <section className="flex-1 space-y-5">
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
                              onChange={(e) => setFilmTitel(e.target.value)}
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
                              onChange={(e) => setFilmJahr(e.target.value)}
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
                              placeholder="z. B. smb://nas/Filme/Interstellar.mkv"
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

                      {filme.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          Noch keine Filme angelegt.
                        </p>
                      ) : (
                        <div className="max-h-[460px] space-y-3 overflow-y-auto text-sm pr-1">
                          {filme.map((f) => (
                            <div
                              key={f.id}
                              className="group space-y-1.5 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-sm shadow-black/60 transition-all hover:-translate-y-0.5 hover:border-red-500/70 hover:shadow-lg hover:shadow-black/70"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1.5">
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
                                </div>

                                <div className="flex flex-col gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleEditFilm(f)}
                                    className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                  >
                                    Bearbeiten
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFilm(f.id)}
                                    className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
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
                              onUploaded={(url) => setNewActorImage(url)}
                            />

                            <button
                              type="submit"
                              className="mt-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-black shadow shadow-red-900/70 disabled:opacity-60"
                              disabled={!newActorName.trim()}
                            >
                              + Haupt
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
                                    onClick={() => handleEditActor(a)}
                                    className="rounded border border-neutral-600 px-2.5 py-1 text-xs text-neutral-100 hover:bg-neutral-800"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteActor(a.id)}
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
                              + Neben
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
                              + Studio
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
                              + Tag
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
            )}
          </section>
        )}
      </main>
    </div>
  );
}
