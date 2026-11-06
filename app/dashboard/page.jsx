Warning: truncated output (original token count: 44012)
Total output lines: 4440

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AdminBetaOverview from "./beta/AdminBetaOverview.jsx";
import AdminUsageAnalytics from "./beta/AdminUsageAnalytics.jsx";
import AdminMediaHealth from "./beta/AdminMediaHealth.jsx";
import AdminMovieFilePicker from "./AdminMovieFilePicker.jsx";
import AdminMovieMetadataPicker from "./AdminMovieMetadataPicker.jsx";
import PlanetSuzyUpdates from "./beta/PlanetSuzyUpdates.jsx";
import ResolutionIndicator from "../components/ResolutionIndicator.jsx";
import wizardStyles from "./AdminMovieWizard.module.css";
import {
  isCategorizedTag,
  prioritizeTagIds,
  sortTagsByCategory,
  tagCategoryLabel,
} from "../../lib/tagCategories.mjs";
import {
  PUBLIC_VIDEO_BASE,
  hasExactVideoFile,
  movieFileUrlKey,
  normalizeMovieFileUrl,
} from "../../lib/movieFilePaths.mjs";

const AdminHomepageDirector = dynamic(
  () => import("./beta/AdminHomepageDirector.jsx"),
  {
    ssr: false,
    loading: () => (
      <div className="homepageDirectorLoading">
        <span />
        <p>Startseiten-Regisseur wird geladen…</p>
      </div>
    ),
  }
);

const AdminThumbnailStudio = dynamic(
  () => import("./beta/AdminThumbnailStudio.jsx"),
  {
    ssr: false,
    loading: () => (
      <div className="text-xs text-neutral-500">
        Lade Thumbnail Studio…
      </div>
    ),
  }
);

const AdminNasLibrary = dynamic(
  () => import("./beta/AdminNasLibrary.jsx"),
  {
    ssr: false,
    loading: () => (
      <div className="text-xs text-neutral-500">
        Lade NAS-Analyse…
      </div>
    ),
  }
);

const TransparentActorUploader = dynamic(() => import("./TransparentActorUploader.jsx"), { ssr: false });

const MOVIE_PAGE_SIZE = 1000;

async function loadAllMovies() {
  const allMovies = [];

  for (let offset = 0; ; offset += MOVIE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("movies")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + MOVIE_PAGE_SIZE - 1);

    if (error) throw error;

    allMovies.push(...(data || []));
    if (!data || data.length < MOVIE_PAGE_SIZE) return allMovies;
  }
}

// -------------------------------
// Version / Changelog
// -------------------------------

const CHANGELOG = [
  {
    version: "2.8.0",
    date: "2026-11-06",
    items: [
      "Neue Nutzungsstatistik im Beta-Admin mit Web-Besuchern, Seitenaufrufen, Verlauf und Zeitraumfiltern",
      "Herkunftsländer mit ausgeschriebenen deutschen Namen und dezenten Flaggen anzeigen",
      "Apple-TV-Auswertung vorbereitet; Werte werden nach Anbindung der tvOS-App erfasst",
      "Next.js und betroffene Paketabhängigkeiten mit Sicherheitsupdates aktualisiert",
    ],
  },
  {
    version: "2.7.9",
    date: "2026-09-27",
    items: [
      "Darstellerstatistik liest Haarfarben aus Color-Tags und Finish-Werte aus Finish-Tags",
    ],
  },
  {
    version: "2.7.8",
    date: "2026-09-27",
    items: [
      "Frühesten Suchzeitpunkt für Thumbnail-Vorschläge festlegen oder aktuelle Videoposition übernehmen",
    ],
  },
  {
    version: "2.7.7",
    date: "2026-09-27",
    items: [
      "Main Tags durch Color-, Place- und Finish-Kategorien ersetzt und Kategorien zuerst sortiert",
      "Haarfarbe wird im Schritt Hauptdarsteller gewählt und automatisch als Film-Tag übernommen",
    ],
  },
  {
    version: "2.7.6",
    date: "2026-09-27",
    items: [
      "Beim Bearbeiten eines Films lassen sich alle sieben Assistenten-Schritte direkt öffnen",
    ],
  },
  {
    version: "2.7.5",
    date: "2026-09-27",
    items: [
      "Doppelte Zeitanzeige unten rechts in der Videovorschau entfernt",
    ],
  },
  {
    version: "2.7.4",
    date: "2026-09-27",
    items: [
      "Thumbnail-Vorschläge lassen sich sperren und bleiben bei weiteren Generierungen erhalten",
      "Auswahl leeren entfernt nur freie Vorschläge; gesperrte bleiben verfügbar",
      "Über eine Sprungtaste lässt sich der Film direkt an der Stelle eines Vorschlags fortsetzen",
      "Die KI-Auswahl berücksichtigt nur noch Frames mit vollständig sichtbarem Gesicht",
      "Update-Monitor für Hauptdarsteller mit Favoriten, automatischen Prüfungen alle zwei Minuten und Sortierung nach letzter Prüfung ergänzt",
      "Cast-Bilder und lokale KI-Aufwertung im Thumbnail Studio verbessert; Vergleich, Entwackeln, Upscaling und SUPIR-Restaurierung ergänzt",
    ],
  },
  {
    version: "2.7.3",
    date: "2026-09-26",
    items: [
      "Suchfelder für die Darsteller- und Tag-Auswahl kompakter ausgerichtet",
    ],
  },
  {
    version: "2.7.2",
    date: "2026-09-26",
    items: [
      "Darsteller- und Tag-Auswahl im Film-Assistenten mit Suche und kompakten Listen neu gestaltet",
    ],
  },
  {
    version: "2.7.1",
    date: "2026-09-26",
    items: [
      "Dateiabgleich im Film-Wizard um vollständige Filmpaginierung und einheitliche Behandlung kodierter Sonderzeichen erweitert",
    ],
  },
  {
    version: "2.7.0",
    date: "2026-09-25",
    items: [
      "Main Tags in der Tag-Verwaltung markierbar und in tvOS vor normalen Tags priorisiert",
      "Main Tags im Film-Assistenten und in der Admin-Liste zuerst angezeigt",
    ],
  },
  {
    version: "2.6.1",
    date: "2026-08-16",
    items: [
      "NAS-Qualitätsauswertung auf 4K und Nicht 4K anhand eines eigenen 4K-Ordners vereinfacht",
      "Abdeckung nach Hauptdarsteller über anklickbare Spaltenköpfe sortierbar gemacht",
      "Unten abgeschnittene Kennzahlen in der Admin-Übersicht korrigiert",
      "Thumbnails der aktuellen Filme in der Admin-Übersicht auf 16:9 umgestellt",
      "Thumbnails im Filmarchiv vollständig auf 16:9 umgestellt",
      "Bildverwaltung für Studios aus der Admin-Oberfläche entfernt",
      "Dateiauswahl beim Anlegen von Haupt- und Nebendarstellern sauber ausgerichtet",
      "Doppelte Darstellernamen in der NAS-Analyse entfernt und Dateityp-Zähler besser lesbar gemacht",
      "V1-Qualitätslogos auf Hauptseite und im Admin wiederhergestellt: 4K rot, FullHD gelb und Retro weiß-grau",
      "Qualitätslogos in V2 unter die Thumbnails neben den Filmtitel verschoben",
      "Lange V2-Filmtitel neben Qualitätslogos passen ihre Schriftgröße automatisch an, statt gekürzt zu werden",
      "Aktuelle V2-Oberflächen unter / und /dashboard konsolidiert und ungenutzte V1- sowie Classic-Dateien entfernt",
      "Nicht mehr benötigte Weiterleitungsrouten für /beta, /v2, /dashboard/beta und /dashboard/v2 entfernt",
    ],
  },
  {
    version: "2.6.0",
    date: "2026-08-09",
    items: [
      "NAS-Bibliotheksanalyse mit vollständigem Inventar aller Videoformate ergänzt",
      "Exakten Datenbankabgleich, mögliche Dateinamens-Treffer und offene NAS-Dateien getrennt ausgewiesen",
      "Aussagekräftige Statistiken nach Hauptdarsteller, Qualität, Dateiformat und MP4-Konvertierungsstand ergänzt",
      "Geschützten read-only Docker-Scanner für den Hauptordner 1337 vorbereitet",
    ],
  },
  {
    version: "2.5.7",
    date: "2026-08-09",
    items: [
      "Benutzer-Initialen im Kontomenü-Schalter durch ein Zahnrad ersetzt",
    ],
  },
  {
    version: "2.5.6",
    date: "2026-08-09",
    items: [
      "Bezeichnung der Verwaltungsoberfläche überall zu Admin vereinheitlicht",
      "Wechsel zum klassischen Dashboard aus dem Admin-Menü entfernt",
    ],
  },
  {
    version: "2.5.5",
    date: "2026-08-09",
    items: [
      "V1 vollständig aus der aktiven Website entfernt",
      "V1 bleibt dauerhaft im separaten Git-Branch archive/v1 erhalten",
      "Menüeintrag und direkte Route /v1 entfernt",
    ],
  },
  {
    version: "2.5.4",
    date: "2026-08-09",
    items: [
      "Favoritenherzen von allen Filmkarten entfernt",
      "Filme werden weiterhin über das kleine Herz neben der Bewertung als Favorit markiert",
    ],
  },
  {
    version: "2.5.3",
    date: "2026-08-09",
    items: [
      "Favoriten als geräteübergreifend gespeicherte Filmauswahl hinzugefügt",
      "Herz neben dem Film-Roulette öffnet die neue Favoritenansicht",
      "Filme lassen sich auf Filmkarten und direkt neben der Bewertung auf der Filmseite als Favorit markieren",
    ],
  },
  {
    version: "2.5.2",
    date: "2026-08-09",
    items: [
      "Beta KI-Generator für Gesichter, Augen, Körperpunkte und ungünstige Bildausschnitte ergänzt",
      "Kino-Crop, Smart Fit sowie horizontale und vertikale Fokusregler aus dem Thumbnail Studio entfernt",
      "Ausgewählte Frames werden direkt im 16:9-Format mit 1920 × 1080 Pixeln gespeichert",
    ],
  },
  {
    version: "2.5.1",
    date: "2026-08-09",
    items: [
      "Vorschau wird nicht mehr übersprungen und speichert nur noch per ausdrücklichem Klick im letzten Schritt",
      "Die in Schritt 1 gewählte MP4 wird automatisch an den Thumbnail-Generator übergeben",
      "Film hinzufügen als geführten Assistenten mit sieben klaren Schritten neu aufgebaut",
      "Datei, Thumbnail, Filmdaten, Cast und Tags werden nacheinander bearbeitet",
      "Thumbnail Studio direkt in den neuen Film-Assistenten integriert",
      "Abschließende Filmvorschau vor dem ersten Datenbankeintrag ergänzt",
      "Eingaben bleiben beim Vor- und Zurückgehen vollständig erhalten",
    ],
  },
  {
    version: "2.4.0",
    date: "2026-08-09",
    items: [
      "NAS-Ordnerauswahl direkt in Film hinzufügen integriert",
      "Alle MP4-Dateien eines ausgewählten Ordners werden übersichtlich und durchsuchbar angezeigt",
      "Bereits hinzugefügte Videodateien sind grün markiert und für eine erneute Auswahl gesperrt",
      "Doppelte Videopfade werden auch bei manueller Eingabe vor dem Speichern blockiert",
      "Eine ausgewählte MP4 bleibt beim späteren Ändern von Darsteller oder Auflösung erhalten",
    ],
  },
  {
    version: "2.3.2",
    date: "2026-08-08",
    items: [
      "Kartenhöhe der kleineren Filme in gemischten Startseiten-Reihen korrigiert",
      "Große und kleine Filmkarten strecken ihre Inhalte nicht mehr gegenseitig auseinander",
    ],
  },
  {
    version: "2.3.1",
    date: "2026-08-08",
    items: [
      "Bewertung und Aufrufzahl direkt auf den Startseiten-Reihen Top bewertet und Meistgesehen ergänzt",
    ],
  },
  {
    version: "2.3.0",
    date: "2026-08-08",
    items: [
      "Ähnliche Filme als neue kuratierte Reihe auf der Filmseite hinzugefügt",
      "Empfehlungen werden aus gemeinsamen Darstellern, Tags, Studio, Qualität, Epoche und Bewertung berechnet",
      "Empfehlungskarten zeigen den wichtigsten Grund für die jeweilige Auswahl",
    ],
  },
  {
    version: "2.2.2",
    date: "2026-08-08",
    items: [
      "Studio-Dropdown auf einen dunklen Hintergrund mit roter Schrift umgestellt",
    ],
  },
  {
    version: "2.2.1",
    date: "2026-08-08",
    items: [
      "Studio-Auswahl im Startseiten-Regisseur unter Windows lesbar gemacht",
      "Dropdown-Optionen verwenden jetzt einen festen hellen Hintergrund mit dunkler Schrift",
    ],
  },
  {
    version: "2.2.0",
    date: "2026-08-08",
    items: [
      "Startseiten-Regisseur als neuen Arbeitsbereich im Adminbereich hinzugefügt",
      "Bereiche der v2-Startseite können sortiert, ausgeblendet, umbenannt und in ihrer Größe angepasst werden",
      "Neue dynamische Reihen für Top bewertet, Meistgesehen, Zufallsauswahl und Studio-Spotlights ergänzt",
      "Startseiten-Konfiguration geschützt und zentral in Supabase gespeichert",
    ],
  },
  {
    version: "2.1.0",
    date: "2026-08-08",
    items: [
      "Film-Roulette als neue bildschirmfüllende Kinoansicht hinzugefügt",
      "Kompakter Würfel-Button ohne Text direkt im v2-Header integriert",
      "Roulette-Filter für Qualität, Studio, Darsteller, Tags und Mindestbewertung ergänzt",
      "Retro standardmäßig ausgeschlossen und nur gültige MP4-Dateien für die Auslosung zugelassen",
      "Die letzten fünf Roulette-Ergebnisse werden bei weiteren Auslosungen nach Möglichkeit vermieden",
    ],
  },
  {
    version: "2.0.2",
    date: "2026-08-08",
    items: [
      "Verbliebenen Beta-/Vorschau-Button aus dem v1-Archiv entfernt",
      "Changelog bleibt ausschließlich im Adminbereich verfügbar",
    ],
  },
  {
    version: "2.0.1",
    date: "2026-08-08",
    items: [
      "Browser-Verlauf für Darstellerprofile und Filmseiten korrigiert",
      "Seitentaste, Browser-Zurück und Browser-Vorwärts stellen jetzt die vorherige Library-Ansicht wieder her",
      "Suche und Filter ersetzen weiterhin nur den aktuellen Eintrag und überladen den Verlauf nicht",
    ],
  },
  {
    version: "2.0.0",
    date: "2026-08-08",
    items: [
      "Redesign v2 als neue Hauptseite veröffentlicht",
      "Klassische Hauptseite dauerhaft als v1-Archiv unter /v1 erhalten",
      "Bisherigen Vorschau-Schalter entfernt und alle Versionshinweise auf v2 vereinheitlicht",
      "Modernes Control Room unter /dashboard/v2 erreichbar; klassisches Dashboard bleibt erhalten",
    ],
  },
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

// Helper für Chips – Orange als Beta-Akzent
const chipClass = (active) =>
  "px-3 py-1 rounded-full border text-sm " +
  (active
    ? "bg-orange-500 border-orange-600 text-black"
    : "bg-neutral-900/90 border-neutral-700 text-neutral-100 hover:border-neutral-400 transition-colors");

const MOVIE_WIZARD_STEPS = [
  {
    label: "Datei",
    short: "MP4",
    title: "Videodatei auswählen",
    description:
      "Öffne deinen NAS-Ordner und wähle die konkrete MP4 aus. Bereits vorhandene Filme bleiben grün markiert und gesperrt.",
  },
  {
    label: "Thumbnail",
    short: "Cover",
    title: "Thumbnail erstellen",
    description:
      "Erzeuge direkt aus dem ausgewählten Video ein 16:9-Cover oder überspringe diesen optionalen Schritt.",
  },
  {
    label: "Filmdaten",
    short: "Info",
    title: "Filmdaten eintragen",
    description:
      "Lege Titel, Erscheinungsjahr, Studio und Qualität fest. Titel und Qualität sind Pflichtfelder.",
  },
  {
    label: "Hauptdarsteller",
    short: "Cast",
    title: "Hauptdarsteller auswählen",
    description:
      "Wähle alle Hauptdarsteller aus, die auf der Filmseite besonders hervorgehoben werden sollen.",
  },
  {
    label: "Nebendarsteller",
    short: "Cast 2",
    title: "Nebendarsteller auswählen",
    description:
      "Ergänze weitere Darsteller. Dieser Schritt ist optional und kann ohne Auswahl fortgesetzt werden.",
  },
  {
    label: "Tags",
    short: "Meta",
    title: "Tags festlegen",
    description:
      "Ordne dem Film passende Tags zu. Mehrere Einträge können gleichzeitig ausgewählt werden.",
  },
  {
    label: "Vorschau",
    short: "Speichern",
    title: "Prüfen und speichern",
    description:
      "Kontrolliere alle Angaben in Ruhe. Erst mit dem letzten Klick wird der Film in der Datenbank gespeichert.",
  },
];

function decodeMovieFileSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function movieFileName(fileUrl) {
  try {
    const pathname = new URL(fileUrl).pathname;
    return decodeMovieFileSegment(
      pathname.split("/").filter(Boolean).pop() || "MP4-Datei"
    );
  } catch {
    const clean = String(fileUrl || "").split(/[?#]/)[0];
    return decodeMovieFileSegment(
      clean.split("/").filter(Boolean).pop() || "MP4-Datei"
    );
  }
}

const AdminNavIcon = ({ name }) => {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    movies: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="M3 9h18M8 5l3 4M14 5l3 4" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 20V12M10 20V5M16 20v-9M22 20V8" />
        <path d="M2 21h21" />
      </>
    ),
    health: (
      <>
        <path d="M4 5h16v14H4z" />
        <path d="M7 12h2l1.4-3.5 2.2 7 1.5-3.5H17" />
      </>
    ),
    updates: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2" />
      </>
    ),
    nas: (
      <>
        <path d="M4 6.5h16v11H4z" />
        <path d="M7 10h10M7 14h6" />
        <circle cx="17" cy="14" r="1" />
        <path d="M8 4h8M8 20h8" />
      </>
    ),
    thumbnail: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1" />
        <circle cx="9" cy="9" r="2" />
        <path d="m5 17 4.5-4.5 3 3 2.5-2.5 4 4" />
      </>
    ),
    director: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="9" cy="6" r="2" fill="#09090b" />
        <circle cx="15" cy="12" r="2" fill="#09090b" />
        <circle cx="11" cy="18" r="2" fill="#09090b" />
      </>
    ),
    add: <path d="M12 3v18M3 12h18" />,
    mainActors: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21c.7-5 3.2-7.5 7.5-7.5s6.8 2.5 7.5 7.5" />
      </>
    ),
    supportActors: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.6-4.3 2.8-6.5 6.5-6.5 2.1 0 3.8.7 4.9 2.1" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M14.5 15c3.9-.9 6.2.8 6.8 5" />
      </>
    ),
    studios: (
      <>
        <path d="M4 21V8l8-5 8 5v13" />
        <path d="M8 21v-7h8v7M8 9h.01M12 9h.01M16 9h.01" />
      </>
    ),
    tags: (
      <>
        <path d="M20.5 13.5 13 21l-10-10V3h8l9.5 9.5a1.4 1.4 0 0 1 0 2Z" />
        <circle cx="7.5" cy="7.5" r="1" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[name]}
      </g>
    </svg>
  );
};

// -------------------------------
// Dashboard
// -------------------------------

export function DashboardExperience() {
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
  const [sessionChecked, setSessionChecked] = useState(false);

  // Tabs: Filme / Neuer Film / Stammdaten
  const [activeFilmSection, setActiveFilmSection] = useState("overview");
  const [planetUpdatesUnread, setPlanetUpdatesUnread] = useState(0);
  const [metaMenuOpen, setMetaMenuOpen] = useState(false);
  const [activeMetaSection, setActiveMetaSection] = useState("mainActors"); // "mainActors" | "supportActors" | "studios" | "tags"

  // Daten
  const [hauptdarsteller, setHauptdarsteller] = useState([]);
  const [nebendarsteller, setNebendarsteller] = useState([]);
  const [studios, setStudios] = useState([]);
  const [tags, setTags] = useState([]);
  const [filme, setFilme] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [movieMetrics, setMovieMetrics] = useState([]);
  const [resettingViews, setResettingViews] = useState(null);
  const [thumbnailTargetId, setThumbnailTargetId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stammdaten Inputs
  const [newActorName, setNewActorName] = useState("");
  const [newActorCastImage, setNewActorCastImage] = useState("");
  const [newActorTransparentImage, setNewActorTransparentImage] = useState("");
  const [newActorOrigin, setNewActorOrigin] = useState("");
  const [newActorBirthDate, setNewActorBirthDate] = useState("");
  const [newActorIafdUrl, setNewActorIafdUrl] = useState("");
  const [newActorPlanetsuzyUrl, setNewActorPlanetsuzyUrl] = useState("");

  const [newSupportName, setNewSupportName] = useState("");
  const [newSupportCastImage, setNewSupportCastImage] = useState("");

  const [newStudioName, setNewStudioName] = useState("");

  const [newTagName, setNewTagName] = useState("");
  const [newTagCategory, setNewTagCategory] = useState("");

  const [editingActorMetaId, setEditingActorMetaId] = useState(null);
  const [actorEditForm, setActorEditForm] = useState({
    name: "",
    profile_image: "",
    cast_image: "",
    transparent_image: "",
    origin: "",
    birth_date: "",
    iafd_url: "",
    planetsuzy_url: "",
  });

  const [editingSupportMetaId, setEditingSupportMetaId] = useState(null);
  const [supportEditForm, setSupportEditForm] = useState({
    name: "",
    profile_image: "",
    cast_image: "",
  });

  const [editingStudioMetaId, setEditingStudioMetaId] = useState(null);
  const [studioEditForm, setStudioEditForm] = useState({
    name: "",
  });

  const [editingTagMetaId, setEditingTagMetaId] = useState(null);
  const [tagEditName, setTagEditName] = useState("");

  // Film Inputs
  const DEFAULT_FILE_BASE = PUBLIC_VIDEO_BASE;

  const [filmTitel, setFilmTitel] = useState("");
  const [filmJahr, setFilmJahr] = useState("");
  const [filmStudioId, setFilmStudioId] = useState("");
  const [filmFileUrl, setFilmFileUrl] = useState(DEFAULT_FILE_BASE);
  const [filmVideoFile, setFilmVideoFile] = useState(null);
  const [filmResolutionId, setFilmResolutionId] = useState("");
  const [filmThumbnailUrl, setFilmThumbnailUrl] = useState("");
  const [selectedMainActorIds, setSelectedMainActorIds] = useState([]);
  const [selectedSupportActorIds, setSelectedSupportActorIds] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [filmWizardStep, setFilmWizardStep] = useState(0);
  const [filmWizardMaxStep, setFilmWizardMaxStep] = useState(0);
  const [filmSaving, setFilmSaving] = useState(false);

  const [editingFilmId, setEditingFilmId] = useState(null);

  // Browser-Merker und sicheres Server-Cookie gemeinsam prüfen.
  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      if (typeof window === "undefined") return;

      const flag = window.localStorage.getItem("auth_1337_flag");
      const storedUser = window.localStorage.getItem("auth_1337_user");
      if (storedUser) setLoginUser(storedUser);

      try {
        const response = await fetch("/api/login", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => null);
        if (!active) return;

        if (response.ok && payload?.ok) {
          setLoggedIn(true);
          setLoginErr(null);
          window.localStorage.setItem("auth_1337_flag", "1");
          window.localStorage.setItem(
            "auth_1337_user",
            storedUser || "gallardo1337"
          );
        } else {
          setLoggedIn(false);
          window.localStorage.removeItem("auth_1337_flag");
          window.localStorage.removeItem("auth_1337_user");
          if (flag === "1") {
            setLoginErr(
              "Deine Sitzung ist abgelaufen. Bitte einmal neu einloggen."
            );
          }
        }
      } catch (sessionError) {
        console.error("Admin-Sitzung konnte nicht geprüft werden.", sessionError);
        if (!active) return;
        setLoggedIn(false);
        setLoginErr("Sitzung konnte nicht geprüft werden. Bitte neu einloggen.");
      } finally {
        if (active) setSessionChecked(true);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
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
      if (!sessionChecked) return;

      if (!loggedIn) {
        setHauptdarsteller([]);
        setNebendarsteller([]);
        setStudios([]);
        setTags([]);
        setFilme([]);
        setResolutions([]);
        setMovieMetrics([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const metricsPromise = fetch("/api/movie-metrics", { cache: "no-store" })
          .then(async (response) => {
            const payload = await response.json();
            return response.ok && Array.isArray(payload?.metrics)
              ? payload.metrics
              : [];
          })
          .catch((metricsError) => {
            console.warn(
              "Filmstatistiken konnten nicht geladen werden.",
              metricsError
            );
            return [];
          });

        const [
          actorsRes,
          actors2Res,
          studiosRes,
          tagsRes,
          allMovies,
          resolutionsRes,
          metricsData,
        ] = await Promise.all([
          supabase.from("actors").select("*").order("name"),
          supabase.from("actors2").select("*").order("name"),
          supabase.from("studios").select("*").order("name"),
          supabase.from("tags").select("*").order("name"),
          loadAllMovies(),
          supabase.from("resolutions").select("*").order("name"),
          metricsPromise,
        ]);

        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (resolutionsRes.error) throw resolutionsRes.error;

        setHauptdarsteller(actorsRes.data || []);
        setNebendarsteller(actors2Res.data || []);
        setStudios(studiosRes.data || []);
        setTags(tagsRes.data || []);
        setFilme(allMovies);
        setResolutions(resolutionsRes.data || []);
        setMovieMetrics(metricsData);

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
  }, [loggedIn, sessionChecked]);

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

  const movieMetricMap = useMemo(
    () => Object.fromEntries(movieMetrics.map((metric) => [metric.movie_id, metric])),
    [movieMetrics]
  );

  const filmFileDuplicate = useMemo(() => {
    const key = movieFileUrlKey(filmFileUrl);
    if (!key || !hasExactVideoFile(filmFileUrl)) return null;

    return (
      filme.find(
        (movie) =>
          movie.id !== editingFilmId && movieFileUrlKey(movie.file_url) === key
      ) || null
    );
  }, [editingFilmId, filmFileUrl, filme]);

  const wizardThumbnailMovie = useMemo(
    () => ({
      id: editingFilmId || "new-movie-draft",
      title: filmTitel.trim() || movieFileName(filmFileUrl),
      year: filmJahr || null,
      studio_id: filmStudioId || null,
      resolution_id: filmResolutionId || null,
      file_url: filmFileUrl,
      thumbnail_url: filmThumbnailUrl || null,
    }),
    [
      editingFilmId,
      filmFileUrl,
      filmJahr,
      filmResolutionId,
      filmStudioId,
      filmThumbnailUrl,
      filmTitel,
    ]
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

        if (!hasExactVideoFile(filmFileUrl)) {
          if (firstRemainingActor) {
            setFilmFileUrl(
              buildMovieFolderUrl(firstRemainingActor.name, filmResolutionId)
            );
          } else {
            setFilmFileUrl(DEFAULT_FILE_BASE);
          }
        }

        return next;
      }

      if (!hasExactVideoFile(filmFileUrl)) {
        setFilmFileUrl(buildMovieFolderUrl(actor.name, filmResolutionId));
      }
      return [...prev, actor.id];
    });
  };

  const handleResolutionChange = (resolutionId) => {
    setFilmResolutionId(resolutionId);

    const firstSelectedActor = getFirstSelectedMainActor();

    if (!hasExactVideoFile(filmFileUrl)) {
      if (firstSelectedActor) {
        setFilmFileUrl(buildMovieFolderUrl(firstSelectedActor.name, resolutionId));
      } else {
        setFilmFileUrl(DEFAULT_FILE_BASE);
      }
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
        credentials: "same-origin",
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
      setSessionChecked(true);
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

  const handleSessionExpired = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_1337_flag");
      window.localStorage.removeItem("auth_1337_user");
    }
    setLoggedIn(false);
    setSessionChecked(true);
    setLoginPassword("");
    setLoginErr("Deine Sitzung ist abgelaufen. Bitte einmal neu einloggen.");
    setUserMenuOpen(false);
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
        cast_image: newActorCastImage.trim() || null,
        transparent_image: newActorTransparentImage.trim() || null,
        origin: newActorOrigin.trim() || null,
        birth_date: newActorBirthDate || null,
        iafd_url: newActorIafdUrl.trim() || null,
        planetsuzy_url: newActorPlanetsuzyUrl.trim() || null,
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
    setNewActorCastImage("");
    setNewActorTransparentImage("");
    setNewActorOrigin("");
    setNewActorBirthDate("");
    setNewActorIafdUrl("");
    setNewActorPlanetsuzyUrl("");
  };

  const handleAddSupportActor = async (e) => {
    e.preventDefault();
    const name = newSupportName.trim();
    if (!name) return;

    const { data, error: insertError } = await supabase
      .from("actors2")
      .insert({
        name,
        cast_image: newSupportCastImage.trim() || null,
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
    setNewSupportCastImage("");
  };

  const handleAddStudio = async (e) => {
    e.preventDefault();
    const name = newStudioName.trim();
    if (!name) return;

    const { data, error: insertError } = await supabase
      .from("studios")
      .insert({ name })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setStudios((prev) => [...prev, data]);
    setNewStudioName("");
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name) return;

    const { data, error: insertError } = await supabase
      .from("tags")
      .insert({ name, category: newTagCategory || null })
      .select("*")
      .single();

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      return;
    }

    setTags((prev) => [...prev, data]);
    setNewTagName("");
    setNewTagCategory("");
  };

  const handleSetTagCategory = async (tag, category) => {
    const { data, error: updateError } = await supabase
      .from("tags")
      .update({ category: category || null })
      .eq("id", tag.id)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setTags((prev) => prev.map((item) => (item.id === tag.id ? data : item)));
  };

  const handleDeleteStudio = async (studioId) => {
    const ok = window.confirm("Dieses Studio wirklich löschen?");
    if (!ok) return;

    const { error: deleteError } = await supabase
      .from("studios")
      .delete()
      .eq("id", studioId);

    if (deleteError) {
      console.error(deleteError);
      setError(deleteError.message);
      return;
    }

    setStudios((prev) => prev.filter((s) => s.id !== studioId));
    setFilmStudioId((prev) => (prev === studioId ? "" : prev));
  };

  const handleEditTagGlobal = async (tag) => {
    const newName = window.prompt("Neuer Tag-Name:", tag.name || "");
    if (newName === null) return;

    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const { data, error: updateError } = await supabase
      .from("tags")
      .update({ name: trimmedName })
      .eq("id", tag.id)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setTags((prev) => prev.map((t) => (t.id === tag.id ? data : t)));
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

    const newOrigin = window.prompt(
      "Herkunft (leer lassen zum Löschen):",
      actor.origin || ""
    );
    let origin = actor.origin || null;
    if (newOrigin !== null) {
      const t = newOrigin.trim();
      origin = t === "" ? null : t;
    }

    const newBirthDate = window.prompt(
      "Geburtsdatum im Format YYYY-MM-DD (leer lassen zum Löschen):",
      actor.birth_date || ""
    );
    let birth_date = actor.birth_date || null;
    if (newBirthDate !== null) {
      const t = newBirthDate.trim();
      birth_date = t === "" ? null : t;
    }

    const newIafdUrl = window.prompt(
      "IAFD URL (leer lassen zum Löschen):",
      actor.iafd_url || ""
    );
    let iafd_url = actor.iafd_url || null;
    if (newIafdUrl !== null) {
      const t = newIafdUrl.trim();
      iafd_url = t === "" ? null : t;
    }

    const newPlanetsuzyUrl = window.prompt(
      "PlanetSuzy URL (leer lassen zum Löschen):",
      actor.planetsuzy_url || ""
    );
    let planetsuzy_url = actor.planetsuzy_url || null;
    if (newPlanetsuzyUrl !== null) {
      const t = newPlanetsuzyUrl.trim();
      planetsuzy_url = t === "" ? null : t;
    }

    const { data, error: updateError } = await supabase
      .from("actors")
      .update({
        name: trimmedName,
        profile_image,
        origin,
        birth_date,
        iafd_url,
        planetsuzy_url,
      })
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


  const startEditActorInline = (actor) => {
    setEditingActorMetaId(actor.id);
    setActorEditForm({
      name: actor.name || "",
      profile_image: actor.profile_image || "",
      cast_image: actor.cast_image || "",
      transparent_image: actor.transparent_image || "",
      origin: actor.origin || "",
      birth_date: actor.birth_date || "",
      iafd_url: actor.iafd_url || "",
      planetsuzy_url: actor.planetsuzy_url || "",
    });
  };

  const cancelEditActorInline = () => {
    setEditingActorMetaId(null);
    setActorEditForm({
      name: "",
      profile_image: "",
      cast_image: "",
      transparent_image: "",
      origin: "",
      birth_date: "",
      iafd_url: "",
      planetsuzy_url: "",
    });
  };

  const saveEditActorInline = async (actorId) => {
    const name = actorEditForm.name.trim();
    if (!name) return;

    const payload = {
      name,
      profile_image: actorEditForm.profile_image.trim() || null,
      cast_image: actorEditForm.cast_image.trim() || null,
      transparent_image: actorEditForm.transparent_image.trim() || null,
      origin: actorEditForm.origin.trim() || null,
      birth_date: actorEditForm.birth_date || null,
      iafd_url: actorEditForm.iafd_url.trim() || null,
      planetsuzy_url: actorEditForm.planetsuzy_url.trim() || null,
    };

    const { data, error: updateError } = await supabase
      .from("actors")
      .update(payload)
      .eq("id", actorId)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setHauptdarsteller((prev) =>
      prev.map((a) => (a.id === actorId ? data : a))
    );
    cancelEditActorInline();
  };

  const startEditSupportInline = (actor) => {
    setEditingSupportMetaId(actor.id);
    setSupportEditForm({
      name: actor.name || "",
      profile_image: actor.profile_image || "",
      cast_image: actor.cast_image || "",
    });
  };

  const cancelEditSupportInline = () => {
    setEditingSupportMetaId(null);
    setSupportEditForm({
      name: "",
      profile_image: "",
      cast_image: "",
    });
  };

  const saveEditSupportInline = async (actorId) => {
    const name = supportEditForm.name.trim();
    if (!name) return;

    const payload = {
      name,
      profile_image: supportEditForm.profile_image.trim() || null,
      cast_image: supportEditForm.cast_image.trim() || null,
    };

    const { data, error: updateError } = await supabase
      .from("actors2")
      .update(payload)
      .eq("id", actorId)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setNebendarsteller((prev) =>
      prev.map((a) => (a.id === actorId ? data : a))
    );
    cancelEditSupportInline();
  };

  const startEditStudioInline = (studio) => {
    setEditingStudioMetaId(studio.id);
    setStudioEditForm({
      name: studio.name || "",
    });
  };

  const cancelEditStudioInline = () => {
    setEditingStudioMetaId(null);
    setStudioEditForm({
      name: "",
    });
  };

  const saveEditStudioInline = async (studioId) => {
    const name = studioEditForm.name.trim();
    if (!name) return;

    const { data, error: updateError } = await supabase
      .from("studios")
      .update({ name })
      .eq("id", studioId)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setStudios((prev) => prev.map((s) => (s.id === studioId ? data : s)));
    cancelEditStudioInline();
  };

  const startEditTagInline = (tag) => {
    setEditingTagMetaId(tag.id);
    setTagEditName(tag.name || "");
  };

  const cancelEditTagInline = () => {
    setEditingTagMetaId(null);
    setTagEditName("");
  };

  const saveEditTagInline = async (tagId) => {
    const name = tagEditName.trim();
    if (!name) return;

    const { data, error: updateError } = await supabase
      .from("tags")
      .update({ name })
      .eq("id", tagId)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      return;
    }

    setTags((prev) => prev.map((t) => (t.id === tagId ? data : t)));
    cancelEditTagInline();
  };


  // ---------------- Filme anlegen / bearbeiten / löschen ----------------

  const resetFilmForm = () => {
    setFilmTitel("");
    setFilmJahr("");
    setFilmStudioId("");
    setFilmFileUrl(DEFAULT_FILE_BASE);
    setFilmVideoFile(null);
    setFilmThumbnailUrl("");
    setSelectedMainActorIds([]);
    setSelectedSupportActorIds([]);
    setSelectedTagIds([]);
    setEditingFilmId(null);
    setFilmWizardStep(0);
    setFilmWizardMaxStep(0);

    // Resolution Default: FullHD, sonst erstes
    const fullHd = resolutions.find((r) => r.name === "FullHD");
    if (fullHd) setFilmResolutionId(fullHd.id);
    else setFilmResolutionId(resolutions[0]?.id || "");
  };

  const handleAddOrUpdateFilm = async () => {
    if (filmSaving) return false;
    setError(null);

    if (!hasExactVideoFile(filmFileUrl)) {
      setError("Bitte zuerst eine konkrete MP4-Datei auswählen.");
      return false;
    }

    const title = filmTitel.trim();
    if (!title) {
      setError("Bitte Filmname eingeben.");
      return false;
    }

    if (!filmResolutionId) {
      setError("Bitte eine Resolution auswählen (Pflichtfeld).");
      return false;
    }

    if (filmFileDuplicate) {
      setError(
        `Diese Videodatei wurde bereits als „${filmFileDuplicate.title}“ hinzugefügt.`
      );
      return false;
    }

    let year = null;
    if (filmJahr.trim()) {
      const parsed = Number(filmJahr.trim());
      if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) {
        setError("Erscheinungsjahr ist keine gültige Zahl.");
        return false;
      }
      year = parsed;
    }

    const payload = {
      title,
      year,
      studio_id: filmStudioId || null,
      file_url: normalizeMovieFileUrl(filmFileUrl),
      resolution_id: filmResolutionId,
      thumbnail_url: filmThumbnailUrl.trim() || null,
      main_actor_ids:
        selectedMainActorIds.length > 0 ? selectedMainActorIds : null,
      supporting_actor_ids:
        selectedSupportActorIds.length > 0 ? selectedSupportActorIds : null,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : null,
    };

    setFilmSaving(true);

    try {
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
          return false;
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
          return false;
        }

        setFilme((prev) => [data, ...prev]);
        resetFilmForm();
      }

      return true;
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.message || "Film konnte nicht gespeichert werden.");
      return false;
    } finally {
      setFilmSaving(false);
    }
  };

  const handleEditFilm = (film) => {
    setEditingFilmId(film.id);
    setFilmTitel(film.title || "");
    setFilmJahr(film.year ? String(film.year) : "");
    setFilmStudioId(film.studio_id || "");
    setFilmFileUrl(film.file_url || "");
    setFilmVideoFile(null);
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
    setFilmWizardStep(0);
    setFilmWizardMaxStep(0);

    setActiveFilmSection("new");
    setMetaMenuOpen(false);
  };

  const handleCancelEdit = () => {
    resetFilmForm();
  };

  const handleWizardFileChange = (url, localFile = null) => {
    const previousKey = movieFileUrlKey(filmFileUrl);
    const nextKey = movieFileUrlKey(url);

    if (previousKey !== nextKey) {
      setFilmThumbnailUrl("");
      setFilmVideoFile(localFile);
    } else if (localFile) {
      setFilmVideoFile(localFile);
    }

    setFilmFileUrl(url);
    setError(null);
  };

  const validateMovieWizardStep = (step) => {
    setError(null);

    if (step === 0) {
      if (!hasExactVideoFile(filmFileUrl)) {
        setError("Bitte zuerst eine konkrete MP4-Datei auswählen.");
        return false;
      }

      if (filmFileDuplicate) {
        setError(
          `Diese Videodatei wurde bereits als „${filmFileDuplicate.title}“ hinzugefügt.`
        );
        return false;
      }
    }

    if (step === 2) {
      if (!filmTitel.trim()) {
        setError("Bitte einen Filmtitel eingeben.");
        return false;
      }

      if (filmJahr.trim()) {
        const parsedYear = Number(filmJahr.trim());
        if (
          !Number.isInteger(parsedYear) ||
          parsedYear < 1900 ||
          parsedYear > 2100
        ) {
          setError("Bitte ein gültiges Erscheinungsjahr eingeben.");
          return false;
        }
      }

      if (!filmResolutionId) {
        setError("Bitte eine Qualität auswählen.");
        return false;
      }
    }

    return true;
  };

  const handleWizardNext = () => {
    if (!validateMovieWizardStep(filmWizardStep)) return;

    const nextStep = Math.min(
      filmWizardStep + 1,
      MOVIE_WIZARD_STEPS.length - 1
    );
    setFilmWizardStep(nextStep);
    setFilmWizardMaxStep((current) => Math.max(current, nextStep));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWizardBack = () => {
    setError(null);
    setFilmWizardStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleWizardStepSelect = (step) => {
    if (!editingFilmId && step > filmWizardMaxStep) return;
    setError(null);
    setFilmWizardStep(step);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const preventMovieWizardSubmit = (event) => {
    event.preventDefault();
  };

  const handleDelete…14012 tokens truncated…     <div className={wizardStyles.actionsRight}>
                              {filmWizardStep > 0 ? (
                                <button
                                  type="button"
                                  className={wizardStyles.secondaryButton}
                                  onClick={handleWizardBack}
                                  disabled={filmSaving}
                                >
                                  Zurück
                                </button>
                              ) : editingFilmId ? (
                                <button
                                  type="button"
                                  className={wizardStyles.secondaryButton}
                                  onClick={handleCancelEdit}
                                  disabled={filmSaving}
                                >
                                  Abbrechen
                                </button>
                              ) : null}

                              {filmWizardStep < MOVIE_WIZARD_STEPS.length - 1 ? (
                                <button
                                  type="button"
                                  className={wizardStyles.primaryButton}
                                  onClick={handleWizardNext}
                                  disabled={
                                    filmWizardStep === 0 &&
                                    (!hasExactVideoFile(filmFileUrl) ||
                                      Boolean(filmFileDuplicate))
                                  }
                                >
                                  Weiter →
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={wizardStyles.saveButton}
                                  onClick={handleAddOrUpdateFilm}
                                  disabled={
                                    filmSaving ||
                                    !hasExactVideoFile(filmFileUrl) ||
                                    !filmTitel.trim() ||
                                    !filmResolutionId ||
                                    Boolean(filmFileDuplicate)
                                  }
                                >
                                  {filmSaving
                                    ? "Wird gespeichert…"
                                    : editingFilmId
                                    ? "Film aktualisieren"
                                    : "Film speichern"}
                                </button>
                              )}
                            </div>
                          </div>
                        </section>
                      </form>
                    </div>
                  )}

                  {/* Tab: Filmestatistik */}
                  {activeFilmSection === "stats" && (
                    <div className="dashPanel dashPanel--library rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/95 p-6 shadow-2xl shadow-black/70 space-y-4">
                      <div className="dashPanel__legacyHeader flex items-center justify-between">
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
                              className="dashMovieRow group rounded-2xl border border-neutral-800 bg-neutral-950/95 p-4 shadow-sm shadow-black/60 transition-all hover:border-orange-500/70"
                            >
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                                <div className="dashMovieIdentity flex items-center gap-2">
                                  <div className="dashMovieIdentity__cover">
                                    {f.thumbnail_url ? (
                                      <img src={f.thumbnail_url} alt="" loading="lazy" />
                                    ) : (
                                      <span>{f.title?.slice(0, 1) || "?"}</span>
                                    )}
                                  </div>
                                  <div className="dashMovieIdentity__text">
                                    <span className="text-base font-medium text-neutral-50">
                                      {f.title}
                                    </span>
                                    <small>
                                      {studioMap[f.studio_id]?.name || "Kein Studio"} · {f.year || "Jahr offen"}
                                    </small>
                                  </div>
                                </div>
                                <div className="adminMovieColumns">
                                  <span>
                                    <ResolutionIndicator
                                      value={resolutionMap[f.resolution_id]?.name}
                                      logoClassName="adminMovieColumns__qualityLogo"
                                      fallbackClassName="adminMovieColumns__qualityText"
                                      fallback="–"
                                    />
                                    <small>Qualität</small>
                                  </span>
                                  <span>
                                    <strong>{Number(movieMetricMap[f.id]?.view_count || 0).toLocaleString("de-DE")}</strong>
                                    <small>Aufrufe</small>
                                  </span>
                                  <span>
                                    <strong>{movieMetricMap[f.id]?.rating || "–"}</strong>
                                    <small>Bewertung</small>
                                  </span>
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
                                        className="aspect-video w-28 shrink-0 rounded-xl border border-neutral-800 object-cover bg-neutral-900"
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
                                      {prioritizeTagIds(f.tag_ids, tags).map((id) => {
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
                                  {f.file_url ? (
                                    <a
                                      href={f.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="adminFileAction rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                    >
                                      Datei öffnen
                                    </a>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => handleEditFilm(f)}
                                    className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                  >
                                    Bearbeiten
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResetMovieViews(f)}
                                    disabled={
                                      resettingViews !== null ||
                                      !Number(
                                        movieMetricMap[f.id]?.view_count
                                      )
                                    }
                                    className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {resettingViews === f.id
                                      ? "Wird zurückgesetzt…"
                                      : "Aufrufe zurücksetzen"}
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
                    <section className="dashPanel dashPanel--meta rounded-3xl border border-neutral-800/80 bg-gradient-to-b from-neutral-950 to-black/95 p-6 text-sm text-neutral-100 shadow-2xl shadow-black/70 space-y-5">
                      <div className="dashPanel__legacyHeader flex items-center justify-between gap-4">
                        <div>
                          <h2 className="text-xl font-semibold text-neutral-50">
                            {activeMetaSection === "mainActors"
                              ? "Hauptdarsteller"
                              : activeMetaSection === "supportActors"
                              ? "Nebendarsteller"
                              : activeMetaSection === "studios"
                              ? "Studios"
                              : "Tags"}
                          </h2>
                          <p className="mt-1 text-sm text-neutral-500">
                            {activeMetaSection === "mainActors"
                              ? "Hauptdarsteller anlegen, bearbeiten und löschen."
                              : activeMetaSection === "supportActors"
                              ? "Nebendarsteller anlegen, bearbeiten und löschen."
                              : activeMetaSection === "studios"
                              ? "Studios anlegen, bearbeiten und löschen."
                              : "Tags anlegen, bearbeiten und löschen."}
                          </p>
                        </div>
                      </div>

                      {activeMetaSection === "mainActors" && (
                        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr),minmax(0,1.35fr)]">
                          <form
                            onSubmit={handleAddActor}
                            className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5"
                          >
                            <div className="text-base font-semibold text-neutral-50">
                              Neuen Hauptdarsteller anlegen
                            </div>

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Name"
                              value={newActorName}
                              onChange={(e) => setNewActorName(e.target.value)}
                            />

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Herkunft"
                              value={newActorOrigin}
                              onChange={(e) =>
                                setNewActorOrigin(e.target.value)
                              }
                            />

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Geburtsdatum"
                              type="date"
                              value={newActorBirthDate}
                              onChange={(e) =>
                                setNewActorBirthDate(e.target.value)
                              }
                            />

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="IAFD URL"
                              value={newActorIafdUrl}
                              onChange={(e) =>
                                setNewActorIafdUrl(e.target.value)
                              }
                            />

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="PlanetSuzy URL"
                              value={newActorPlanetsuzyUrl}
                              onChange={(e) =>
                                setNewActorPlanetsuzyUrl(e.target.value)
                              }
                            />

                            <TransparentActorUploader
                              value={newActorCastImage}
                              onChange={setNewActorCastImage}
                              title="Cast-Bild (PNG)"
                              description="Freigestelltes Bild für die 4:5-Darstellerkarten unter den Filmen. Ohne Cast-Bild erscheint dort das normale Foto."
                              recommendedSize="Empfohlen: 800 × 1000 px im Verhältnis 4:5."
                              filenamePrefix="actor_cast"
                            />
                            <TransparentActorUploader
                              value={newActorTransparentImage}
                              onChange={setNewActorTransparentImage}
                            />

                            <button
                              type="submit"
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow shadow-orange-900/70 hover:bg-orange-400 disabled:opacity-60"
                              disabled={!newActorName.trim()}
                            >
                              Speichern
                            </button>
                          </form>

                          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-base font-semibold text-neutral-50">
                                Vorhandene Hauptdarsteller
                              </div>
                              <div className="text-xs text-neutral-500">
                                {hauptdarsteller.length}
                              </div>
                            </div>

                            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                              {hauptdarsteller.map((a) => (
                                <div
                                  key={a.id}
                                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5"
                                >
                                  {editingActorMetaId === a.id ? (
                                    <div className="space-y-3">
                                      <div className="grid gap-3">
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="Name"
                                          value={actorEditForm.name}
                                          onChange={(e) =>
                                            setActorEditForm((prev) => ({
                                              ...prev,
                                              name: e.target.value,
                                            }))
                                          }
                                        />
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="Herkunft"
                                          value={actorEditForm.origin}
                                          onChange={(e) =>
                                            setActorEditForm((prev) => ({
                                              ...prev,
                                              origin: e.target.value,
                                            }))
                                          }
                                        />
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          type="date"
                                          value={actorEditForm.birth_date}
                                          onChange={(e) =>
                                            setActorEditForm((prev) => ({
                                              ...prev,
                                              birth_date: e.target.value,
                                            }))
                                          }
                                        />
                                        <div className="space-y-2">
                                          {actorEditForm.profile_image ? (
                                            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2">
                                              <img
                                                src={actorEditForm.profile_image}
                                                alt="Bisheriges Darstellerbild"
                                                className="h-14 w-14 rounded-lg border border-neutral-800 object-cover bg-neutral-900"
                                                loading="lazy"
                                              />
                                              <div>
                                                <div className="text-xs font-medium text-neutral-200">Bisheriges Darstellerbild</div>
                                                <p className="mt-1 text-xs text-neutral-500">Bleibt als Rückfall erhalten, solange kein Cast-Bild hinterlegt ist.</p>
                                              </div>
                                            </div>
                                          ) : null}

                                          <TransparentActorUploader
                                            value={actorEditForm.cast_image}
                                            onChange={(url) => setActorEditForm((prev) => ({ ...prev, cast_image: url }))}
                                            title="Cast-Bild (PNG)"
                                            description="Freigestelltes Bild für die 4:5-Darstellerkarten unter den Filmen. Ohne Cast-Bild erscheint dort das normale Foto."
                                            recommendedSize="Empfohlen: 800 × 1000 px im Verhältnis 4:5."
                                            filenamePrefix="actor_cast"
                                          />
                                          <TransparentActorUploader
                                            value={actorEditForm.transparent_image}
                                            onChange={(url) => setActorEditForm((prev) => ({ ...prev, transparent_image: url }))}
                                          />
                                        </div>
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="IAFD URL"
                                          value={actorEditForm.iafd_url}
                                          onChange={(e) =>
                                            setActorEditForm((prev) => ({
                                              ...prev,
                                              iafd_url: e.target.value,
                                            }))
                                          }
                                        />
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="PlanetSuzy URL"
                                          value={actorEditForm.planetsuzy_url}
                                          onChange={(e) =>
                                            setActorEditForm((prev) => ({
                                              ...prev,
                                              planetsuzy_url: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveEditActorInline(a.id)}
                                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                                          disabled={!actorEditForm.name.trim()}
                                        >
                                          Speichern
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditActorInline}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Abbrechen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        {a.profile_image ? (
                                          <img
                                            src={a.profile_image}
                                            alt={a.name}
                                            className="h-10 w-10 rounded-lg border border-neutral-800 object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="grid h-10 w-10 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-[10px] font-bold text-neutral-500">
                                            IMG
                                          </div>
                                        )}

                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-medium text-neutral-50">
                                            {a.name}
                                          </div>
                                          {(a.origin ||
                                            a.birth_date ||
                                            a.iafd_url ||
                                            a.planetsuzy_url) && (
                                            <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-neutral-500">
                                              {a.origin ? <span>{a.origin}</span> : null}
                                              {a.birth_date ? (
                                                <span>{a.birth_date}</span>
                                              ) : null}
                                              {a.iafd_url ? (
                                                <span className="text-red-400">
                                                  IAFD
                                                </span>
                                              ) : null}
                                              {a.planetsuzy_url ? (
                                                <span className="text-red-400">
                                                  PlanetSuzy
                                                </span>
                                              ) : null}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex shrink-0 gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => startEditActorInline(a)}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Bearbeiten
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteActor(a.id)}
                                          className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
                                        >
                                          Löschen
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeMetaSection === "supportActors" && (
                        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr),minmax(0,1.35fr)]">
                          <form
                            onSubmit={handleAddSupportActor}
                            className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5"
                          >
                            <div className="text-base font-semibold text-neutral-50">
                              Neuen Nebendarsteller anlegen
                            </div>

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Name"
                              value={newSupportName}
                              onChange={(e) =>
                                setNewSupportName(e.target.value)
                              }
                            />

                            <TransparentActorUploader
                              value={newSupportCastImage}
                              onChange={setNewSupportCastImage}
                              title="Cast-Bild (PNG)"
                              description="Freigestelltes Bild für die 4:5-Darstellerkarten unter den Filmen. Ohne Cast-Bild erscheint dort das normale Foto."
                              recommendedSize="Empfohlen: 800 × 1000 px im Verhältnis 4:5."
                              filenamePrefix="actor_cast"
                            />

                            <button
                              type="submit"
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow shadow-orange-900/70 hover:bg-orange-400 disabled:opacity-60"
                              disabled={!newSupportName.trim()}
                            >
                              Speichern
                            </button>
                          </form>

                          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-base font-semibold text-neutral-50">
                                Vorhandene Nebendarsteller
                              </div>
                              <div className="text-xs text-neutral-500">
                                {nebendarsteller.length}
                              </div>
                            </div>

                            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                              {nebendarsteller.map((a) => (
                                <div
                                  key={a.id}
                                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5"
                                >
                                  {editingSupportMetaId === a.id ? (
                                    <div className="space-y-3">
                                      <div className="grid gap-3">
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="Name"
                                          value={supportEditForm.name}
                                          onChange={(e) =>
                                            setSupportEditForm((prev) => ({
                                              ...prev,
                                              name: e.target.value,
                                            }))
                                          }
                                        />
                                        <div className="space-y-2">
                                          {supportEditForm.profile_image ? (
                                            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/80 p-2">
                                              <img
                                                src={supportEditForm.profile_image}
                                                alt="Bisheriges Darstellerbild"
                                                className="h-14 w-14 rounded-lg border border-neutral-800 object-cover bg-neutral-900"
                                                loading="lazy"
                                              />
                                              <div>
                                                <div className="text-xs font-medium text-neutral-200">Bisheriges Darstellerbild</div>
                                                <p className="mt-1 text-xs text-neutral-500">Bleibt als Rückfall erhalten, solange kein Cast-Bild hinterlegt ist.</p>
                                              </div>
                                            </div>
                                          ) : null}

                                          <TransparentActorUploader
                                            value={supportEditForm.cast_image}
                                            onChange={(url) => setSupportEditForm((prev) => ({ ...prev, cast_image: url }))}
                                            title="Cast-Bild (PNG)"
                                            description="Freigestelltes Bild für die 4:5-Darstellerkarten unter den Filmen. Ohne Cast-Bild erscheint dort das normale Foto."
                                            recommendedSize="Empfohlen: 800 × 1000 px im Verhältnis 4:5."
                                            filenamePrefix="actor_cast"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveEditSupportInline(a.id)}
                                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                                          disabled={!supportEditForm.name.trim()}
                                        >
                                          Speichern
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditSupportInline}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Abbrechen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        {a.profile_image ? (
                                          <img
                                            src={a.profile_image}
                                            alt={a.name}
                                            className="h-10 w-10 rounded-lg border border-neutral-800 object-cover"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <div className="grid h-10 w-10 place-items-center rounded-lg border border-neutral-800 bg-neutral-900 text-[10px] font-bold text-neutral-500">
                                            IMG
                                          </div>
                                        )}

                                        <span className="truncate text-sm font-medium text-neutral-50">
                                          {a.name}
                                        </span>
                                      </div>

                                      <div className="flex shrink-0 gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => startEditSupportInline(a)}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Bearbeiten
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteSupportActor(a.id)
                                          }
                                          className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
                                        >
                                          Löschen
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeMetaSection === "studios" && (
                        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr),minmax(0,1.35fr)]">
                          <form
                            onSubmit={handleAddStudio}
                            className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5"
                          >
                            <div className="text-base font-semibold text-neutral-50">
                              Neues Studio anlegen
                            </div>

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Studio"
                              value={newStudioName}
                              onChange={(e) =>
                                setNewStudioName(e.target.value)
                              }
                            />

                            <button
                              type="submit"
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow shadow-orange-900/70 hover:bg-orange-400 disabled:opacity-60"
                              disabled={!newStudioName.trim()}
                            >
                              Speichern
                            </button>
                          </form>

                          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-base font-semibold text-neutral-50">
                                Vorhandene Studios
                              </div>
                              <div className="text-xs text-neutral-500">
                                {studios.length}
                              </div>
                            </div>

                            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                              {studios.map((s) => (
                                <div
                                  key={s.id}
                                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5"
                                >
                                  {editingStudioMetaId === s.id ? (
                                    <div className="space-y-3">
                                      <div className="grid gap-3">
                                        <input
                                          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                          placeholder="Studio"
                                          value={studioEditForm.name}
                                          onChange={(e) =>
                                            setStudioEditForm((prev) => ({
                                              ...prev,
                                              name: e.target.value,
                                            }))
                                          }
                                        />
                                      </div>

                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveEditStudioInline(s.id)}
                                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                                          disabled={!studioEditForm.name.trim()}
                                        >
                                          Speichern
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditStudioInline}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Abbrechen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <span className="truncate text-sm font-medium text-neutral-50">
                                          {s.name}
                                        </span>
                                      </div>

                                      <div className="flex shrink-0 gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => startEditStudioInline(s)}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Bearbeiten
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteStudio(s.id)}
                                          className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
                                        >
                                          Löschen
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeMetaSection === "tags" && (
                        <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr),minmax(0,1.35fr)]">
                          <form
                            onSubmit={handleAddTag}
                            className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5"
                          >
                            <div className="text-base font-semibold text-neutral-50">
                              Neuen Tag anlegen
                            </div>

                            <input
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                              placeholder="Tag-Name"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                            />

                            <select
                              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 focus:border-orange-500 focus:outline-none"
                              value={newTagCategory}
                              onChange={(event) => setNewTagCategory(event.target.value)}
                              aria-label="Kategorie für neuen Tag"
                            >
                              <option value="">Ohne Kategorie</option>
                              <option value="haircolor">Color</option>
                              <option value="place">Place</option>
                              <option value="finish">Finish</option>
                            </select>

                            <button
                              type="submit"
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black shadow shadow-orange-900/70 hover:bg-orange-400 disabled:opacity-60"
                              disabled={!newTagName.trim()}
                            >
                              Speichern
                            </button>
                          </form>

                          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/95 p-5">
                            <div className="mb-3 flex items-center justify-between">
                              <div className="text-base font-semibold text-neutral-50">
                                Tags kategorisieren
                              </div>
                              <div className="text-xs text-neutral-500">
                                {tags.length}
                              </div>
                            </div>

                            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                              {sortTagsByCategory(tags)
                                .map((t) => (
                                <div
                                  key={t.id}
                                  className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5"
                                >
                                  {editingTagMetaId === t.id ? (
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                      <input
                                        className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
                                        placeholder="Tag-Name"
                                        value={tagEditName}
                                        onChange={(e) =>
                                          setTagEditName(e.target.value)
                                        }
                                      />

                                      <div className="flex shrink-0 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => saveEditTagInline(t.id)}
                                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                                          disabled={!tagEditName.trim()}
                                        >
                                          Speichern
                                        </button>
                                        <button
                                          type="button"
                                          onClick={cancelEditTagInline}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Abbrechen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="truncate text-sm font-medium text-neutral-50">
                                          {t.name}
                                        </span>
                                        {isCategorizedTag(t) ? (
                                          <span className="shrink-0 rounded-full border border-orange-400/50 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200">
                                            {tagCategoryLabel(t.category)}
                                          </span>
                                        ) : null}
                                      </div>

                                      <div className="flex shrink-0 gap-1.5">
                                        <select
                                          className="max-w-36 rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-100 focus:border-orange-500 focus:outline-none"
                                          value={t.category || ""}
                                          onChange={(event) =>
                                            handleSetTagCategory(t, event.target.value)
                                          }
                                          aria-label={`${t.name} kategorisieren`}
                                          title="Tag-Kategorie ändern"
                                        >
                                          <option value="">Ohne Kategorie</option>
                                          <option value="haircolor">Color</option>
                                          <option value="place">Place</option>
                                          <option value="finish">Finish</option>
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => startEditTagInline(t)}
                                          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs text-neutral-100 hover:bg-neutral-800"
                                        >
                                          Bearbeiten
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTagGlobal(t.id)}
                                          className="rounded-lg border border-red-600 px-3 py-1.5 text-xs text-red-200 hover:bg-red-700/80"
                                        >
                                          Löschen
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </section>

                {/* Desktop: Sidebar links von der zentrierten Hauptbox, Position ignoriert die Zentrierung */}
                <aside className="dashSidebarDesktop hidden lg:flex lg:flex-col lg:space-y-4 lg:absolute lg:-left-72 lg:top-0 lg:w-64">
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

export default function DashboardPage() {
  return <DashboardExperience />;
}
