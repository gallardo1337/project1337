"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// ActorImageUploader nur im Client laden (wegen react-easy-crop / Canvas)
const ActorImageUploader = dynamic(() => import("./ActorImageUploader.jsx"), {
  ssr: false,
  loading: () => (
    <div className="text-xs text-neutral-500">Lade Bild-Uploader…</div>
  ),
});

// MovieThumbnailUploader nur im Client laden (ohne Crop)
const MovieThumbnailUploader = dynamic(
  () => import("./MovieThumbnailUploader.jsx"),
  {
    ssr: false,
    loading: () => (
      <div className="text-xs text-neutral-500">
        Lade Thumbnail-Uploader…
      </div>
    ),
  }
);

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
    {
    version: "0.5.1",
    date: "2026-06-07",
    items: [
      "Dashboard-Header an die Hauptseite angepasst",
      "Suche im Dashboard-Header hinzugefügt",
      "Dashboard-Filmliste kann jetzt nach Titel, Studio, Darsteller, Tags, Resolution, Jahr und URLs durchsucht werden",
      "Doppelten Hauptseite-Button links im Dashboard-Header entfernt",
      "Changelog-Fenster optisch bereinigt",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-05",
    items: [
      "File-URL wird beim Auswählen eines Hauptdarstellers automatisch auf den passenden Darsteller-Ordner gesetzt",
      "Bei Resolution 4K wird automatisch der Unterordner /4K/ in die File-URL eingefügt",
      "Bei FullHD oder Retro bleibt die File-URL direkt im Darsteller-Ordner",
    ],
  },
  {
    version: "0.4.1",
    date: "2025-12-27",
    items: [
      "Movies: optionales Thumbnail-Feld (thumbnail_url) im Filmformular hinzugefügt",
      "Thumbnail Upload wie bei Actor/Studio über ActorImageUploader integriert",
      "Thumbnail wird in Filmestatistik-Details als Preview + URL angezeigt",
    ],
  },
  {
    version: "0.4.0",
    date: "2025-12-27",
    items: [
      "Neue Pflicht-Auswahl 'Resolution' (4K / FullHD / Retro) beim Film hinzugefügt",
      "Resolutions aus Supabase-Tabelle 'resolutions' geladen und im Filmformular integriert",
      "Resolution wird in Filmestatistik-Details angezeigt",
      "Studio-Bild-Upload wie bei Actor: Studio-Form nutzt jetzt ActorImageUploader (statt manueller URL)",
    ],
  },
  {
    version: "0.3.0",
    date: "2025-11-28",
    items: [
      "Dashboard neu strukturiert: Tabs für Filme, Neuen Film hinzufügen und Stammdaten",
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
            className="changelogPanel w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl border border-neutral-700/80 bg-neutral-950/95 p-6 shadow-2xl shadow-black/80"
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
  const router = useRouter();

  // Header / Suche
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const userMenuRef = useRef(null);

  // Login-Status
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tabs: Filme / Neuer Film / Stammdaten
  const [activeFilmSection, setActiveFilmSection] = useState("stats"); // "stats" | "new" | "meta"

  // Daten
  const [hauptdarsteller, setHauptdarsteller] = useState([]);
  const [nebendarsteller, setNebendarsteller] = useState([]);
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [filme, setFilme] = useState([]);
  const [resolutions, setResolutions] = useState([]);

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
  const DEFAULT_FILE_BASE = "http://192.168.178.58:8080/";

  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState(DEFAULT_FILE_BASE);
  const [filmResolutionId, setFilmResolutionId] = useState("");
  const [filmThumbnailUrl, setFilmThumbnailUrl] = useState("");
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

  // Header: Klick außerhalb / Mobile Search / User Menu schließen
  useEffect(() => {
    if (!mobileSearchOpen && !userMenuOpen) return;

    const onDown = (e) => {
      if (mobileSearchOpen) {
        const panel = document.querySelector(".dashMSearch__panel");
        if (panel && panel.contains(e.target)) return;
        setMobileSearchOpen(false);
        setUserMenuOpen(false);
        return;
      }

      const sw = searchWrapRef.current;
      if (sw && sw.contains(e.target)) return;

      const um = userMenuRef.current;
      if (um && !um.contains(e.target)) setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);

    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [mobileSearchOpen, userMenuOpen]);

  useEffect(() => {
    if (!mobileSearchOpen && !userMenuOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setUserMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSearchOpen, userMenuOpen]);

  // Daten laden, wenn eingeloggt
  useEffect(() => {
    const loadAll = async () => {
      if (!loggedIn) {
        setHauptdarsteller([]);
        setNebendarsteller([]);
        setStudios([]);
        setTags([]);
        setFilme([]);
        setResolutions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const [
          actorsRes,
          actors2Res,
          studiosRes,
          tagsRes,
          moviesRes,
          resolutionsRes,
        ] = await Promise.all([
          supabase.from("actors").select("*").order("name"),
          supabase.from("actors2").select("*").order("name"),
          supabase.from("studios").select("*").order("name"),
          supabase.from("tags").select("*").order("name"),
          supabase
            .from("movies")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase.from("resolutions").select("*").order("name"),
        ]);

        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (moviesRes.error) throw moviesRes.error;
        if (resolutionsRes.error) throw resolutionsRes.error;

        setHauptdarsteller(actorsRes.data || []);
        setNebendarsteller(actors2Res.data || []);
        setStudios(studiosRes.data || []);
        setTags(tagsRes.data || []);
        setFilme(moviesRes.data || []);
        setResolutions(resolutionsRes.data || []);

        if (!editingFilmId) {
          const fullHd = (resolutionsRes.data || []).find(
            (r) => r.name === "FullHD"
          );
          if (fullHd && !filmResolutionId) {
            setFilmResolutionId(fullHd.id);
          }
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const actorMap = useMemo(
    () => Object.fromEntries(hauptdarsteller.map((a) => [a.id, a])),
    [hauptdarsteller]
  );

  const supportMap = useMemo(
    () => Object.fromEntries(nebendarsteller.map((a) => [a.id, a])),
    [nebendarsteller]
  );

  const studioMap = useMemo(
    () => Object.fromEntries(studios.map((s) => [s.id, s])),
    [studios]
  );

  const tagMap = useMemo(
    () => Object.fromEntries(tags.map((t) => [t.id, t])),
    [tags]
  );

  const resolutionMap = useMemo(
    () => Object.fromEntries(resolutions.map((r) => [r.id, r])),
    [resolutions]
  );

  const filteredFilme = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase();
    if (!q) return filme;

    return filme.filter((f) => {
      const mainActors = Array.isArray(f.main_actor_ids)
        ? f.main_actor_ids.map((id) => actorMap[id]?.name).filter(Boolean)
        : [];

      const supportActors = Array.isArray(f.supporting_actor_ids)
        ? f.supporting_actor_ids
            .map((id) => supportMap[id]?.name)
            .filter(Boolean)
        : [];

      const tagNames = Array.isArray(f.tag_ids)
        ? f.tag_ids.map((id) => tagMap[id]?.name).filter(Boolean)
        : [];

      const haystack = [
        f.title || "",
        f.year || "",
        f.file_url || "",
        f.thumbnail_url || "",
        studioMap[f.studio_id]?.name || "",
        resolutionMap[f.resolution_id]?.name || "",
        mainActors.join(" "),
        supportActors.join(" "),
        tagNames.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [
    dashboardSearch,
    filme,
    actorMap,
    supportMap,
    studioMap,
    tagMap,
    resolutionMap,
  ]);

  const getResolutionNameById = (resolutionId) => {
    return resolutions.find((r) => r.id === resolutionId)?.name || "";
  };

  const getFirstSelectedMainActor = (ids = selectedMainActorIds) => {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return hauptdarsteller.find((a) => a.id === ids[0]) || null;
  };

  const buildMovieFolderUrl = (actorName, resolutionId = filmResolutionId) => {
    if (!actorName) return DEFAULT_FILE_BASE;

    const actorFolder = encodeURIComponent(actorName.trim());
    const resolutionName = getResolutionNameById(resolutionId);

    if (resolutionName === "4K") {
      return `${DEFAULT_FILE_BASE}${actorFolder}/4K/`;
    }

    return `${DEFAULT_FILE_BASE}${actorFolder}/`;
  };

  const toggleId = (id, arr, setter) => {
    if (arr.includes(id)) {
      setter(arr.filter((x) => x !== id));
    } else {
      setter([...arr, id]);
    }
  };

  const handleToggleMainActor = (actor) => {
    setSelectedMainActorIds((prev) => {
      const alreadySelected = prev.includes(actor.id);

      if (alreadySelected) {
        const next = prev.filter((id) => id !== actor.id);
        const firstRemainingActor = getFirstSelectedMainActor(next);

        if (firstRemainingActor) {
          setFilmFileUrl(
            buildMovieFolderUrl(firstRemainingActor.name, filmResolutionId)
          );
        } else {
          setFilmFileUrl(DEFAULT_FILE_BASE);
        }

        return next;
      }

      setFilmFileUrl(buildMovieFolderUrl(actor.name, filmResolutionId));
      return [...prev, actor.id];
    });
  };

  const handleResolutionChange = (resolutionId) => {
    setFilmResolutionId(resolutionId);

    const firstSelectedActor = getFirstSelectedMainActor();

    if (firstSelectedActor) {
      setFilmFileUrl(buildMovieFolderUrl(firstSelectedActor.name, resolutionId));
    } else {
      setFilmFileUrl(DEFAULT_FILE_BASE);
    }
  };

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setUserMenuOpen(false);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
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
    setDashboardSearch("");
    setMobileSearchOpen(false);
    setUserMenuOpen(false);
    router.replace("/", { scroll: false });
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
    setFilmFileUrl(DEFAULT_FILE_BASE);
    setFilmThumbnailUrl("");
    setSelectedMainActorIds([]);
    setSelectedSupportActorIds([]);
    setSelectedTagIds([]);
    setEditingFilmId(null);

    // Resolution Default: FullHD, sonst erstes
    const fullHd = resolutions.find((r) => r.name === "FullHD");
    if (fullHd) setFilmResolutionId(fullHd.id);
    else setFilmResolutionId(resolutions[0]?.id || "");
  };

  const handleAddOrUpdateFilm = async (e) => {
    e.preventDefault();
    setError(null);

    const title = filmTitel.trim();
    if (!title) {
      setError("Bitte Filmname eingeben.");
      return;
    }

    if (!filmResolutionId) {
      setError("Bitte eine Resolution auswählen (Pflichtfeld).");
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
      resolution_id: filmResolutionId,
      thumbnail_url: filmThumbnailUrl.trim() || null,
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

      setFilme((prev) => prev.map((f) => (f.id === editingFilmId ? data : f)));
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
    setFilmResolutionId(film.resolution_id || "");
    setFilmThumbnailUrl(film.thumbnail_url || "");
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

  // Sidebar-Inhalt (einmal definieren, dann mobil + desktop nutzen)
  const SidebarContent = (
    <>
      {/* Bereiche */}
      <div className="rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-950/90 to-black/90 px-5 py-5 shadow-2xl shadow-black/70">
        <div className="flex flex-row gap-2 lg:flex-col">
          {/* Filme */}
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
            <span>Filme</span>
          </button>

          {/* Neuer Film */}
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
          </button>

          {/* Stammdaten */}
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
          </button>
        </div>
      </div>

      {/* Überblick */}
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
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Tags</span>
            <span className="font-semibold text-neutral-50">{tags.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Resolutions</span>
            <span className="font-semibold text-neutral-50">
              {resolutions.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="page min-h-screen bg-gradient-to-br from-neutral-950 via-black to-neutral-900 text-neutral-100 text-[15px]">
      <style jsx global>{`
        :root {
          --dash-text: rgba(255, 255, 255, 0.92);
          --dash-accent: #e50914;
        }
.changelogPanel {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.changelogPanel::-webkit-scrollbar {
  display: none;
}
        .dashTopbar {
          position: sticky;
          top: 0;
          z-index: 50;
          min-height: 64px;
          padding: 10px 18px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 860px) minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .dashTopbar__left,
        .dashTopbar__right {
          display: flex;
          align-items: center;
        }

        .dashTopbar__left {
          justify-self: start;
        }

        .dashTopbar__mid {
          justify-self: center;
          width: 100%;
          min-width: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .dashTopbar__right {
          justify-self: end;
          gap: 10px;
        }

        .dashSearchWrap {
          position: relative;
          width: 100%;
          max-width: 860px;
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .dashInput {
          width: 100%;
          height: 42px;
          min-height: 42px;
          max-height: 42px;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 0 14px;
          overflow: hidden;
          transition: border-color 0.18s ease, background 0.18s ease;
        }

        .dashInput:focus-within {
          border-color: rgba(229, 9, 20, 0.55);
          background: rgba(255, 255, 255, 0.08);
        }

        .dashInput__icon {
          width: 16px;
          height: 16px;
          opacity: 0.8;
          flex: 0 0 auto;
        }

        .dashInput input {
          flex: 1;
          min-width: 0;
          width: 100%;
          height: 100%;
          outline: none;
          border: none;
          background: transparent;
          color: var(--dash-text);
          font-size: 14px;
          line-height: 42px;
        }

        .dashInput input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .dashBtn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--dash-text);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
          white-space: nowrap;
        }

        .dashBtn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .dashBtn:active {
          transform: translateY(0px);
        }

        .dashBtn--primary {
          background: linear-gradient(
            180deg,
            rgba(229, 9, 20, 0.95),
            rgba(229, 9, 20, 0.78)
          );
          border-color: rgba(229, 9, 20, 0.6);
          box-shadow: 0 18px 36px rgba(229, 9, 20, 0.22);
        }

        .dashBtn--primary:hover {
          background: linear-gradient(
            180deg,
            rgba(255, 21, 33, 0.95),
            rgba(229, 9, 20, 0.8)
          );
          border-color: rgba(255, 21, 33, 0.65);
        }

        .dashBtn--ghost {
          background: transparent;
        }

        .dashAuthForm {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dashAuthField {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 8px 10px;
        }

        .dashAuthField input {
          width: 130px;
          outline: none;
          border: none;
          background: transparent;
          color: var(--dash-text);
          font-size: 13px;
        }

        .dashAuthField input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .dashAuth__label {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 700;
          font-size: 13px;
        }

        .dashUserMenu {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .dashUserMenu__btn,
        .dashIconBtn {
          width: 38px;
          height: 38px;
          border-radius: 14px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.92);
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
        }

        .dashIconBtn {
          width: 42px;
          height: 42px;
        }

        .dashUserMenu__btn:hover,
        .dashIconBtn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .dashUserMenu__btn svg,
        .dashIconBtn svg {
          width: 18px;
          height: 18px;
          opacity: 0.9;
        }

        .dashUserMenu__panel {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          z-index: 2200;
          width: 190px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.92);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.75);
          overflow: hidden;
          padding: 8px;
        }

        .dashUserMenu__item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--dash-text);
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
          text-align: left;
        }

        .dashUserMenu__item:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .dashUserMenu__item--danger {
          border-color: rgba(229, 9, 20, 0.35);
        }

        .dashMSearch {
          position: fixed;
          inset: 0;
          z-index: 5000;
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(10px);
          display: grid;
          align-items: start;
          justify-items: center;
          padding: 14px 12px;
        }

        .dashMSearch__panel {
          width: min(860px, 100%);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.94);
          box-shadow: 0 50px 140px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }

        .dashMSearch__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .dashMSearch__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .dashMSearch__body {
          padding: 12px;
        }

        .dashIconBtn.dashMOnly {
          display: none;
        }

        @media (max-width: 700px) {
          .dashTopbar {
            grid-template-columns: 1fr auto;
          }

          .dashTopbar__mid {
            display: none;
          }

          .dashIconBtn.dashMOnly {
            display: inline-grid;
          }

          .dashAuth__label {
            display: none;
          }

          .dashAuthForm {
            gap: 6px;
          }

          .dashAuthField input {
            width: 92px;
          }
        }

        @media (max-width: 480px) {
          .dashAuthField {
            padding: 7px 8px;
          }

          .dashAuthField input {
            width: 74px;
            font-size: 12px;
          }

          .dashBtn {
            padding: 9px 10px;
          }
        }
      `}</style>

      {/* Header */}
        <div className="dashTopbar">
            <div className="dashTopbar__left" />

          <div className="dashTopbar__mid">
          {loggedIn ? (
            <div className="dashSearchWrap" ref={searchWrapRef}>
              <div className="dashInput" title="Dashboard-Filme suchen">
                <svg
                  className="dashInput__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.5 16.5 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  ref={searchInputRef}
                  value={dashboardSearch}
                  onChange={(e) => {
                    setDashboardSearch(e.target.value);
                    setActiveFilmSection("stats");
                  }}
                  placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                  autoComplete="off"
                />

              </div>
            </div>
          ) : null}
        </div>

        <div className="dashTopbar__right">
          {loggedIn ? (
            <>
              <button
                type="button"
                className="dashIconBtn dashMOnly"
                onClick={openMobileSearch}
                title="Suche"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M16.5 16.5 21 21"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              <div className="dashUserMenu" ref={userMenuRef}>
                <div className="dashAuth__label">Willkommen, {loginUser}</div>

                <button
                  type="button"
                  className="dashUserMenu__btn"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen ? "true" : "false"}
                  title="Menü"
                  onClick={() => {
                    setUserMenuOpen((v) => !v);
                    setMobileSearchOpen(false);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {userMenuOpen ? (
                  <div className="dashUserMenu__panel" role="menu">
                    <button
                      type="button"
                      className="dashUserMenu__item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/");
                      }}
                      title="Zur Hauptseite"
                    >
                      Hauptseite
                    </button>

                    <div style={{ height: 8 }} />

                    <button
                      type="button"
                      className="dashUserMenu__item dashUserMenu__item--danger"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      title="Logout"
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <form className="dashAuthForm" onSubmit={handleLogin}>
              <div className="dashAuthField">
                <input
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="User"
                  autoComplete="username"
                />
              </div>

              <div className="dashAuthField">
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Passwort"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="dashBtn dashBtn--primary"
                disabled={loginLoading}
              >
                {loginLoading ? "Login…" : "Login"}
              </button>
            </form>
          )}
        </div>
      </div>

      {loggedIn && mobileSearchOpen ? (
        <div
          className="dashMSearch"
          role="dialog"
          aria-modal="true"
          onMouseDown={closeMobileSearch}
          onTouchStart={closeMobileSearch}
        >
          <div
            className="dashMSearch__panel"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="dashMSearch__head">
              <div className="dashMSearch__title">Suche</div>

              <button
                type="button"
                className="dashBtn dashBtn--ghost"
                onClick={closeMobileSearch}
              >
                Schließen
              </button>
            </div>

            <div className="dashMSearch__body">
              <div className="dashSearchWrap">
                <div className="dashInput" title="Dashboard-Filme suchen">
                  <svg
                    className="dashInput__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <path
                      d="M16.5 16.5 21 21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>

                  <input
                    ref={mobileSearchInputRef}
                    value={dashboardSearch}
                    onChange={(e) => {
                      setDashboardSearch(e.target.value);
                      setActiveFilmSection("stats");
                    }}
                    placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                    autoComplete="off"
                  />

                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
              <div className="relative">
                {/* Mobile: Sidebar oberhalb der Hauptbox */}
                <div className="mb-5 w-full space-y-4 lg:hidden">
                  {SidebarContent}
                </div>

                {/* Hauptbox: EXAKT horizontal zentriert */}
                <section className="space-y-5 max-w-3xl mx-auto w-full">
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
                            Titel, Jahr, Studio, Resolution, Thumbnail, Cast und
                            Tags festlegen.
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

                        {/* Studio + Resolution + Thumbnail + File URL */}
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-sm text-neutral-300">
                              Studio
                            </label>
                            <select
                              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 focus:border-red-500 focus:outline-none"
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
                          </div>

                          <div>
                            <label className="text-sm text-neutral-300">
                              Resolution <span className="text-red-400">*</span>
                            </label>
                            <select
                              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 focus:border-red-500 focus:outline-none"
                              value={filmResolutionId}
                              onChange={(e) =>
                                handleResolutionChange(e.target.value)
                              }
                              required
                            >
                              <option value="" disabled>
                                Bitte wählen…
                              </option>
                              {resolutions.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Thumbnail Upload: OHNE CROP */}
                          <div>
                            <label className="text-sm text-neutral-300">
                              Thumbnail (optional)
                            </label>

                            {filmThumbnailUrl ? (
                              <div className="mt-2 flex items-center gap-3">
                                <img
                                  src={filmThumbnailUrl}
                                  alt="Thumbnail Preview"
                                  className="h-16 w-16 rounded-xl border border-neutral-700 object-cover bg-neutral-900"
                                  loading="lazy"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-xs text-neutral-400">
                                    {filmThumbnailUrl}
                                  </div>
                                  <div className="mt-2 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setFilmThumbnailUrl("")}
                                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-900"
                                    >
                                      Entfernen
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        try {
                                          navigator.clipboard.writeText(
                                            filmThumbnailUrl
                                          );
                                        } catch {
                                          // ignore
                                        }
                                      }}
                                      className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-900"
                                    >
                                      Copy URL
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2">
                                <MovieThumbnailUploader
                                  onUploaded={(url) =>
                                    setFilmThumbnailUrl(url)
                                  }
                                />
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="text-sm text-neutral-300">
                              File-URL / NAS-Pfad
                            </label>
                            <input
                              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                              value={filmFileUrl}
                              onChange={(e) => setFilmFileUrl(e.target.value)}
                              placeholder="http://192.168.178.58:8080/"
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
                                const active = selectedMainActorIds.includes(
                                  a.id
                                );
                                return (
                                  <button
                                    key={a.id}
                                    type="button"
                                    onClick={() => handleToggleMainActor(a)}
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
                                const active = selectedSupportActorIds.includes(
                                  a.id
                                );
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
                            disabled={!filmTitel.trim() || !filmResolutionId}
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
                            Filme
                          </h2>
                          <p className="mt-1 text-sm text-neutral-500">
                            Insgesamt{" "}
                            <span className="font-semibold text-neutral-100">
                              {filteredFilme.length}
                            </span>{" "}
                            {dashboardSearch.trim()
                              ? "Treffer"
                              : "Filme"}{" "}
                            in der Bibliothek.
                          </p>
                        </div>
                      </div>

                      {filteredFilme.length === 0 ? (
                        <p className="text-sm text-neutral-500">
                          {dashboardSearch.trim()
                            ? "Keine Filme zur Suche gefunden."
                            : "Noch keine Filme angelegt."}
                        </p>
                      ) : (
                        <div className="space-y-3 text-sm">
                          {filteredFilme.map((f) => (
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
                                {f.studio_id && studioMap[f.studio_id] && (
                                  <div className="text-sm text-neutral-400">
                                    Studio: {studioMap[f.studio_id].name}
                                  </div>
                                )}

                                {f.resolution_id &&
                                  resolutionMap[f.resolution_id] && (
                                    <div className="text-sm text-neutral-400">
                                      Resolution:{" "}
                                      {resolutionMap[f.resolution_id].name}
                                    </div>
                                  )}

                                {/* Thumbnail Anzeige */}
                                {f.thumbnail_url && (
                                  <div className="mt-2">
                                    <div className="text-sm text-neutral-400">
                                      Thumbnail:
                                    </div>
                                    <div className="mt-2 flex items-center gap-3">
                                      <img
                                        src={f.thumbnail_url}
                                        alt={`${f.title} Thumbnail`}
                                        className="h-14 w-14 rounded-xl border border-neutral-800 object-cover bg-neutral-900"
                                        loading="lazy"
                                      />
                                      <div className="min-w-0 flex-1">
                                        <div className="break-all text-xs text-neutral-500">
                                          {f.thumbnail_url}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {Array.isArray(f.main_actor_ids) &&
                                  f.main_actor_ids.length > 0 && (
                                    <div className="text-sm text-neutral-300">
                                      Hauptdarsteller:{" "}
                                      {f.main_actor_ids
                                        .map((id) => actorMap[id]?.name)
                                        .filter(Boolean)
                                        .join(", ")}
                                    </div>
                                  )}

                                {Array.isArray(f.supporting_actor_ids) &&
                                  f.supporting_actor_ids.length > 0 && (
                                    <div className="text-sm text-neutral-300">
                                      Nebendarsteller:{" "}
                                      {f.supporting_actor_ids
                                        .map((id) => supportMap[id]?.name)
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
                          <form onSubmit={handleAddActor} className="space-y-2">
                            <div className="font-medium text-neutral-50 text-base">
                              Hauptdarsteller
                            </div>
                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                              placeholder="Name"
                              value={newActorName}
                              onChange={(e) => setNewActorName(e.target.value)}
                            />

                            <ActorImageUploader
                              onUploaded={(url) => setNewActorImage(url)}
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
                              onUploaded={(url) => setNewSupportImage(url)}
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
                                    onClick={() => handleEditSupportActor(a)}
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

                            <ActorImageUploader
                              onUploaded={(url) => setNewStudioImage(url)}
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
                          <form onSubmit={handleAddTag} className="space-y-2">
                            <div className="font-medium text-neutral-50 text-base">
                              Tags
                            </div>
                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-red-500 focus:outline-none"
                              placeholder="Tag-Name"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
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
                                  onClick={() => handleDeleteTagGlobal(t.id)}
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

                {/* Desktop: Sidebar links von der zentrierten Hauptbox, Position ignoriert die Zentrierung */}
                <aside className="hidden lg:flex lg:flex-col lg:space-y-4 lg:absolute lg:-left-72 lg:top-0 lg:w-64">
                  {SidebarContent}
                </aside>
              </div>
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
