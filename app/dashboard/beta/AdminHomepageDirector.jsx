"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createHomepageSection,
  HOMEPAGE_SECTION_TYPES,
  normalizeHomepageSections,
} from "../../../lib/homepageSections";

const formatNumber = (value) =>
  new Intl.NumberFormat("de-DE").format(Math.max(0, Number(value) || 0));

function sectionDescription(section, movies, studios, metricMap, resolutionMap) {
  const limit = Math.max(1, Number(section.itemLimit) || 1);

  if (section.type === "showcase") {
    return `${Math.min(limit, movies.length)} zufällige Filme · Retro ausgeschlossen`;
  }
  if (section.type === "recent") {
    return `${Math.min(limit, movies.length)} zuletzt hinzugefügte Filme`;
  }
  if (section.type === "top_rated") {
    const rated = movies.filter((movie) => Number(metricMap[movie.id]?.rating) > 0);
    return `${Math.min(limit, rated.length)} bestbewertete Filme`;
  }
  if (section.type === "most_viewed") {
    const viewed = movies.filter((movie) => Number(metricMap[movie.id]?.view_count) > 0);
    return `${Math.min(limit, viewed.length)} Filme mit den meisten Aufrufen`;
  }
  if (section.type === "random") {
    const eligible = section.config?.includeRetro
      ? movies
      : movies.filter(
          (movie) =>
            !String(resolutionMap[movie.resolution_id]?.name || "")
              .toLowerCase()
              .includes("retro")
        );
    return `${Math.min(limit, eligible.length)} bei jedem Laden neu ausgewählte Filme`;
  }
  if (section.type === "studio") {
    const studio = studios.find((item) => item.name === section.config?.studio);
    const count = studio
      ? movies.filter((movie) => String(movie.studio_id) === String(studio.id)).length
      : 0;
    return studio
      ? `${Math.min(limit, count)} Filme von ${studio.name}`
      : "Noch kein Studio ausgewählt";
  }
  if (section.type === "actors") {
    return `${limit} Darsteller nach Anzahl ihrer Filme`;
  }
  return "Redaktioneller Abschluss der Startseite";
}

export default function AdminHomepageDirector({
  movies,
  studios,
  metricMap,
  resolutionMap,
  onUnauthorized,
}) {
  const onUnauthorizedRef = useRef(onUnauthorized);
  const [sections, setSections] = useState([]);
  const [savedSnapshot, setSavedSnapshot] = useState("[]");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newType, setNewType] = useState("top_rated");
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/homepage-settings", {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (response.status === 401) {
          onUnauthorizedRef.current?.();
          throw new Error("Deine Sitzung ist abgelaufen.");
        }
        if (!response.ok) {
          throw new Error(
            payload?.error || "Startseiten-Konfiguration konnte nicht geladen werden."
          );
        }

        const normalized = normalizeHomepageSections(payload?.sections);
        if (!cancelled) {
          setSections(normalized);
          setSavedSnapshot(JSON.stringify(normalized));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = JSON.stringify(sections) !== savedSnapshot;
  const enabledCount = sections.filter((section) => section.enabled).length;
  const usedUniqueTypes = useMemo(
    () =>
      new Set(
        sections
          .filter((section) => HOMEPAGE_SECTION_TYPES[section.type]?.unique)
          .map((section) => section.type)
      ),
    [sections]
  );
  const availableTypes = useMemo(
    () =>
      Object.entries(HOMEPAGE_SECTION_TYPES).filter(
        ([type, definition]) => !definition.unique || !usedUniqueTypes.has(type)
      ),
    [usedUniqueTypes]
  );

  useEffect(() => {
    if (!availableTypes.some(([type]) => type === newType)) {
      setNewType(availableTypes[0]?.[0] || "");
    }
  }, [availableTypes, newType]);

  const updateSection = (id, updater) => {
    setNotice("");
    setSections((current) =>
      current.map((section) =>
        section.id === id
          ? typeof updater === "function"
            ? updater(section)
            : { ...section, ...updater }
          : section
      )
    );
  };

  const moveSection = (id, targetIndex) => {
    setNotice("");
    setSections((current) => {
      const fromIndex = current.findIndex((section) => section.id === id);
      if (fromIndex < 0) return current;
      const boundedIndex = Math.max(0, Math.min(targetIndex, current.length - 1));
      if (boundedIndex === fromIndex) return current;

      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(boundedIndex, 0, moved);
      return next;
    });
  };

  const addSection = () => {
    if (!newType) return;
    const suffix =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const section = createHomepageSection(newType, `${newType}-${suffix}`);
    if (!section) return;

    setNotice("");
    setSections((current) => [...current, section]);
  };

  const removeSection = (id) => {
    setNotice("");
    setSections((current) => current.filter((section) => section.id !== id));
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/homepage-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        onUnauthorizedRef.current?.();
        throw new Error("Deine Sitzung ist abgelaufen.");
      }
      if (!response.ok) {
        throw new Error(
          payload?.error || "Startseiten-Konfiguration konnte nicht gespeichert werden."
        );
      }

      const normalized = normalizeHomepageSections(payload?.sections);
      setSections(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setNotice("Startseite veröffentlicht.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="homepageDirectorLoading">
        <span />
        <p>Startseiten-Regisseur wird geladen…</p>
      </div>
    );
  }

  return (
    <div className="homepageDirector">
      <section className="homepageDirectorSummary">
        <div>
          <span>Live composition</span>
          <strong>{enabledCount}</strong>
          <p>sichtbare Bereiche</p>
        </div>
        <div>
          <span>Status</span>
          <strong className={dirty ? "is-dirty" : ""}>
            {dirty ? "Entwurf" : "Live"}
          </strong>
          <p>{dirty ? "Änderungen noch nicht veröffentlicht" : "Startseite ist aktuell"}</p>
        </div>
        <div className="homepageDirectorSummary__actions">
          <button
            type="button"
            onClick={() => window.open("/", "_blank", "noopener,noreferrer")}
          >
            Startseite ansehen ↗
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={saveSettings}
            disabled={!dirty || saving}
          >
            {saving ? "Wird veröffentlicht…" : "Änderungen veröffentlichen"}
          </button>
        </div>
      </section>

      {error ? <div className="homepageDirectorMessage is-error">{error}</div> : null}
      {notice ? <div className="homepageDirectorMessage is-success">{notice}</div> : null}

      <section className="homepageDirectorComposer">
        <div className="homepageDirectorComposer__head">
          <div>
            <span>Reihenfolge von oben nach unten</span>
            <h2>Startseiten-Dramaturgie</h2>
            <p>
              Ziehe Bereiche an die gewünschte Position oder nutze die Pfeile.
              Erst beim Veröffentlichen wird die echte Startseite geändert.
            </p>
          </div>
          <small>{sections.length} Bereiche im Entwurf</small>
        </div>

        <div className="homepageDirectorList">
          {sections.map((section, index) => {
            const definition = HOMEPAGE_SECTION_TYPES[section.type];
            return (
              <article
                key={section.id}
                className={`homepageDirectorCard ${
                  section.enabled ? "" : "is-disabled"
                } ${draggedId === section.id ? "is-dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId =
                    event.dataTransfer.getData("text/plain") || draggedId;
                  if (sourceId && sourceId !== section.id) {
                    moveSection(sourceId, index);
                  }
                  setDraggedId(null);
                }}
              >
                <div className="homepageDirectorCard__order">
                  <button
                    type="button"
                    className="homepageDirectorDrag"
                    draggable
                    onDragStart={(event) => {
                      setDraggedId(section.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", section.id);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    aria-label="Bereich ziehen"
                  >
                    <i /><i /><i /><i /><i /><i />
                  </button>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <div>
                    <button
                      type="button"
                      onClick={() => moveSection(section.id, index - 1)}
                      disabled={index === 0}
                      aria-label="Nach oben"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(section.id, index + 1)}
                      disabled={index === sections.length - 1}
                      aria-label="Nach unten"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="homepageDirectorCard__main">
                  <div className="homepageDirectorCard__heading">
                    <div>
                      <span>{definition?.label || section.type}</span>
                      <strong>{section.title}</strong>
                      <small>
                        {sectionDescription(
                          section,
                          movies,
                          studios,
                          metricMap,
                          resolutionMap
                        )}
                      </small>
                    </div>
                    <label className="homepageDirectorSwitch">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(event) =>
                          updateSection(section.id, {
                            enabled: event.target.checked,
                          })
                        }
                      />
                      <span />
                      <b>{section.enabled ? "Sichtbar" : "Ausgeblendet"}</b>
                    </label>
                  </div>

                  <div className="homepageDirectorFields">
                    <label>
                      <span>Titel</span>
                      <input
                        value={section.title}
                        maxLength={80}
                        onChange={(event) =>
                          updateSection(section.id, { title: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Kleine Überschrift</span>
                      <input
                        value={section.eyebrow}
                        maxLength={80}
                        onChange={(event) =>
                          updateSection(section.id, { eyebrow: event.target.value })
                        }
                      />
                    </label>
                    {section.type !== "manifesto" ? (
                      <label className="homepageDirectorLimit">
                        <span>Anzahl</span>
                        <input
                          type="number"
                          min={definition?.minLimit || 1}
                          max={definition?.maxLimit || 12}
                          value={section.itemLimit}
                          onChange={(event) =>
                            updateSection(section.id, {
                              itemLimit: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    ) : null}
                    {section.type === "studio" ? (
                      <label className="homepageDirectorStudio">
                        <span>Studio</span>
                        <select
                          value={section.config?.studio || ""}
                          onChange={(event) =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              config: {
                                ...current.config,
                                studio: event.target.value,
                              },
                            }))
                          }
                        >
                          <option value="">Studio auswählen…</option>
                          {studios
                            .slice()
                            .sort((a, b) =>
                              a.name.localeCompare(b.name, "de", {
                                sensitivity: "base",
                              })
                            )
                            .map((studio) => (
                              <option key={studio.id} value={studio.name}>
                                {studio.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                    {section.type === "random" ? (
                      <label className="homepageDirectorRetro">
                        <input
                          type="checkbox"
                          checked={section.config?.includeRetro === true}
                          onChange={(event) =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              config: {
                                ...current.config,
                                includeRetro: event.target.checked,
                              },
                            }))
                          }
                        />
                        <span>Retro in dieser Reihe zulassen</span>
                      </label>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  className="homepageDirectorCard__remove"
                  onClick={() => removeSection(section.id)}
                  aria-label={`${section.title} entfernen`}
                >
                  ×
                </button>
              </article>
            );
          })}
        </div>

        <div className="homepageDirectorAdd">
          <div>
            <span>Neuer Bereich</span>
            <strong>Weitere Reihe hinzufügen</strong>
          </div>
          <select value={newType} onChange={(event) => setNewType(event.target.value)}>
            {availableTypes.map(([type, definition]) => (
              <option key={type} value={type}>
                {definition.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={addSection} disabled={!newType}>
            <span>+</span> Hinzufügen
          </button>
        </div>
      </section>

      <footer className="homepageDirectorFoot">
        <span>{formatNumber(movies.length)} Filme stehen für dynamische Reihen bereit.</span>
        <strong>Änderungen wirken nach dem Veröffentlichen beim nächsten Laden der v2-Startseite.</strong>
      </footer>
    </div>
  );
}
