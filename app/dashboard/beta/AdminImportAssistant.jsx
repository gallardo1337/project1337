"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function entityLabel(items, id) {
  return items.find((item) => item.id === id)?.name || "Unbekannt";
}

function EntityPicker({
  label,
  items,
  selectedIds,
  suggestedIds = [],
  onChange,
  placeholder,
}) {
  const [query, setQuery] = useState("");
  const suggested = useMemo(() => new Set(suggestedIds), [suggestedIds]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("de");
    return [...items]
      .filter((item) =>
        normalizedQuery
          ? String(item.name || "")
              .toLocaleLowerCase("de")
              .includes(normalizedQuery)
          : true
      )
      .sort((left, right) => {
        const leftSelected = selectedIds.includes(left.id) ? 1 : 0;
        const rightSelected = selectedIds.includes(right.id) ? 1 : 0;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;
        const leftSuggested = suggested.has(left.id) ? 1 : 0;
        const rightSuggested = suggested.has(right.id) ? 1 : 0;
        if (leftSuggested !== rightSuggested) return rightSuggested - leftSuggested;
        return String(left.name || "").localeCompare(
          String(right.name || ""),
          "de",
          { sensitivity: "base" }
        );
      });
  }, [items, query, selectedIds, suggested]);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((current) => current !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <section className="importAssistant__picker">
      <header>
        <div>
          <span>{label}</span>
          <small>{selectedIds.length} ausgewählt</small>
        </div>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder || `${label} durchsuchen`}
          aria-label={`${label} durchsuchen`}
        />
      </header>
      <div className="importAssistant__pickerList">
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const active = selectedIds.includes(item.id);
            const isSuggested = suggested.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "is-active" : ""}
                onClick={() => toggle(item.id)}
                aria-pressed={active}
              >
                <i>{active ? "✓" : "+"}</i>
                <span>{item.name}</span>
                {isSuggested ? <small>Erkannt</small> : null}
              </button>
            );
          })
        ) : (
          <p>Keine passenden Einträge.</p>
        )}
      </div>
    </section>
  );
}

function DuplicateCard({ duplicate, studioMap }) {
  const movie = duplicate.movie || {};
  return (
    <article
      className={`importAssistant__duplicate is-${duplicate.severity}`}
    >
      <div className="importAssistant__duplicateCover">
        {movie.thumbnail_url ? (
          <img src={movie.thumbnail_url} alt="" />
        ) : (
          <span>{String(movie.title || "?").slice(0, 1)}</span>
        )}
      </div>
      <div>
        <small>
          {duplicate.severity === "blocking"
            ? "Import blockiert"
            : `${Math.round((duplicate.score || 0) * 100)} % Ähnlichkeit`}
        </small>
        <strong>{movie.title || "Unbekannter Film"}</strong>
        <span>
          {studioMap[movie.studio_id]?.name || "Ohne Studio"}
          {movie.year ? ` · ${movie.year}` : ""}
        </span>
        <p>{duplicate.reason}</p>
      </div>
    </article>
  );
}

export default function AdminImportAssistant({
  movies,
  studios,
  mainActors,
  supportActors,
  tags,
  resolutions,
  onMovieImported,
  onEditMovie,
  onOpenThumbnailStudio,
  onUnauthorized,
}) {
  const [source, setSource] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [importedMovie, setImportedMovie] = useState(null);
  const latestCheckRef = useRef(0);

  const studioMap = useMemo(
    () => Object.fromEntries(studios.map((item) => [item.id, item])),
    [studios]
  );
  const blockingDuplicate = analysis?.duplicates?.some(
    (duplicate) => duplicate.severity === "blocking"
  );
  const warningDuplicates = (analysis?.duplicates || []).filter(
    (duplicate) => duplicate.severity !== "blocking"
  );
  const canSave = Boolean(
    draft?.title?.trim() &&
      draft?.resolution_id &&
      draft?.file_url &&
      !blockingDuplicate &&
      (!warningDuplicates.length || confirmDuplicate) &&
      !saving
  );

  const requestAnalysis = async ({ preserveDraft = false } = {}) => {
    const fileUrl = preserveDraft ? draft?.file_url : source;
    if (!String(fileUrl || "").trim()) {
      setError("Bitte zuerst einen Videopfad eingeben.");
      return;
    }

    const checkId = latestCheckRef.current + 1;
    latestCheckRef.current = checkId;
    preserveDraft ? setChecking(true) : setAnalyzing(true);
    setError(null);
    try {
      const response = await fetch("/api/movies/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          file_url: fileUrl,
          title: preserveDraft ? draft?.title : undefined,
          year: preserveDraft ? draft?.year : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error || "Der Pfad konnte nicht analysiert werden.");
      }
      if (preserveDraft && checkId !== latestCheckRef.current) return;

      if (preserveDraft) {
        setAnalysis((current) => ({
          ...current,
          duplicates: payload.analysis.duplicates,
          findings: payload.analysis.findings,
        }));
        setConfirmDuplicate(false);
      } else {
        const nextAnalysis = payload.analysis;
        setAnalysis(nextAnalysis);
        setDraft({
          file_url: nextAnalysis.canonical_url,
          title: nextAnalysis.suggestions.title || "",
          year: nextAnalysis.suggestions.year || "",
          studio_id: nextAnalysis.suggestions.studio_id || "",
          resolution_id: nextAnalysis.suggestions.resolution_id || "",
          main_actor_ids: nextAnalysis.suggestions.main_actor_ids || [],
          supporting_actor_ids:
            nextAnalysis.suggestions.supporting_actor_ids || [],
          tag_ids: nextAnalysis.suggestions.tag_ids || [],
        });
        setConfirmDuplicate(false);
        setImportedMovie(null);
      }
    } catch (requestError) {
      setError(
        requestError?.message || "Der Dateipfad konnte nicht analysiert werden."
      );
    } finally {
      setAnalyzing(false);
      if (!preserveDraft || checkId === latestCheckRef.current) {
        setChecking(false);
      }
    }
  };

  useEffect(() => {
    if (!analysis || !draft?.file_url || importedMovie) return undefined;
    const timer = window.setTimeout(() => {
      requestAnalysis({ preserveDraft: true });
    }, 700);
    return () => window.clearTimeout(timer);
    // Nur Titel und Jahr sollen die Duplikatprüfung leise aktualisieren.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.title, draft?.year]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/movies/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...draft,
          confirm_duplicate: confirmDuplicate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      if (!response.ok) {
        if (payload.duplicates) {
          setAnalysis((current) => ({
            ...current,
            duplicates: payload.duplicates,
          }));
          setConfirmDuplicate(false);
        }
        throw new Error(payload.error || "Der Film konnte nicht importiert werden.");
      }

      setImportedMovie(payload.movie);
      onMovieImported?.(payload.movie);
    } catch (saveError) {
      setError(saveError?.message || "Der Film konnte nicht importiert werden.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSource("");
    setAnalysis(null);
    setDraft(null);
    setImportedMovie(null);
    setConfirmDuplicate(false);
    setError(null);
  };

  if (importedMovie) {
    return (
      <section className="importAssistant importAssistant--success">
        <div className="importAssistant__successMark">✓</div>
        <span className="importAssistant__eyebrow">Import abgeschlossen</span>
        <h2>{importedMovie.title}</h2>
        <p>
          Der Film wurde vollständig angelegt. Als nächstes kannst du ein Cover
          aus dem Video erzeugen oder die Daten im normalen Editor öffnen.
        </p>
        <div className="importAssistant__successFacts">
          <div>
            <span>Qualität</span>
            <strong>
              {entityLabel(resolutions, importedMovie.resolution_id)}
            </strong>
          </div>
          <div>
            <span>Cast</span>
            <strong>
              {(importedMovie.main_actor_ids?.length || 0) +
                (importedMovie.supporting_actor_ids?.length || 0)}
            </strong>
          </div>
          <div>
            <span>Tags</span>
            <strong>{importedMovie.tag_ids?.length || 0}</strong>
          </div>
        </div>
        <div className="importAssistant__successActions">
          <button
            type="button"
            className="is-primary"
            onClick={() => onOpenThumbnailStudio?.(importedMovie)}
          >
            Thumbnail erzeugen <span>→</span>
          </button>
          <button type="button" onClick={() => onEditMovie?.(importedMovie)}>
            Film bearbeiten
          </button>
          <button type="button" onClick={reset}>
            Weiteren Film importieren
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="importAssistant">
      <div className="importAssistant__steps" aria-label="Importfortschritt">
        <div className={analysis ? "is-complete" : "is-active"}>
          <b>01</b>
          <span>Quelle</span>
        </div>
        <i />
        <div className={analysis ? "is-active" : ""}>
          <b>02</b>
          <span>Prüfen & ergänzen</span>
        </div>
        <i />
        <div>
          <b>03</b>
          <span>Speichern</span>
        </div>
      </div>

      <section className="importAssistant__source">
        <div>
          <span className="importAssistant__eyebrow">01 / Videoquelle</span>
          <h2>Ein Pfad. Der Rest wird vorbereitet.</h2>
          <p>
            Vollständige URL, relativer Ordnerpfad oder alter NAS-Link – der
            Assistent vereinheitlicht die Quelle und liest verwertbare Metadaten.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            requestAnalysis();
          }}
        >
          <label htmlFor="movie-import-source">MP4-Pfad</label>
          <div>
            <input
              id="movie-import-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Darsteller/Filmname 2026.mp4"
              autoComplete="off"
            />
            <button type="submit" disabled={analyzing || !source.trim()}>
              {analyzing ? "Analysiere…" : analysis ? "Neu analysieren" : "Analysieren"}
              {!analyzing ? <span>→</span> : null}
            </button>
          </div>
          <small>
            Erlaubt sind ausschließlich freigegebene Videoquellen mit echter
            .mp4-Endung.
          </small>
        </form>
      </section>

      {error ? <div className="importAssistant__message is-error">{error}</div> : null}

      {analysis && draft ? (
        <>
          <section className="importAssistant__analysisBar">
            <div>
              <span className="importAssistant__pulse" />
              <div>
                <strong>Quelle geprüft</strong>
                <small>{analysis.source.filename}</small>
              </div>
            </div>
            <code title={draft.file_url}>{draft.file_url}</code>
            <span>{checking ? "Duplikate werden geprüft…" : "Prüfung aktuell"}</span>
          </section>

          <div className="importAssistant__layout">
            <div className="importAssistant__editor">
              <section className="importAssistant__block">
                <header>
                  <div>
                    <span className="importAssistant__eyebrow">02 / Kerndaten</span>
                    <h3>Vorschlag prüfen</h3>
                  </div>
                  <small>Alles bleibt vor dem Speichern editierbar</small>
                </header>
                <div className="importAssistant__fields">
                  <label className="is-wide">
                    <span>Filmtitel *</span>
                    <input
                      value={draft.title}
                      onChange={(event) => updateDraft("title", event.target.value)}
                      maxLength={250}
                      placeholder="Filmtitel"
                    />
                    {analysis.source.title ? (
                      <small>
                        Aus „{analysis.source.filename}“ erkannt · Vertrauen: {analysis.source.title_confidence}
                      </small>
                    ) : null}
                  </label>
                  <label>
                    <span>Jahr</span>
                    <input
                      type="number"
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      value={draft.year}
                      onChange={(event) => updateDraft("year", event.target.value)}
                      placeholder="2026"
                    />
                  </label>
                  <label>
                    <span>Qualität *</span>
                    <select
                      value={draft.resolution_id}
                      onChange={(event) =>
                        updateDraft("resolution_id", event.target.value)
                      }
                    >
                      <option value="">Qualität wählen</option>
                      {resolutions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="is-wide">
                    <span>Studio</span>
                    <select
                      value={draft.studio_id}
                      onChange={(event) => updateDraft("studio_id", event.target.value)}
                    >
                      <option value="">Ohne Studio</option>
                      {studios.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <EntityPicker
                label="Hauptdarsteller"
                items={mainActors}
                selectedIds={draft.main_actor_ids}
                suggestedIds={analysis.suggestions.main_actor_ids}
                onChange={(ids) => updateDraft("main_actor_ids", ids)}
              />
              <EntityPicker
                label="Nebendarsteller"
                items={supportActors}
                selectedIds={draft.supporting_actor_ids}
                suggestedIds={analysis.suggestions.supporting_actor_ids}
                onChange={(ids) => updateDraft("supporting_actor_ids", ids)}
              />
              <EntityPicker
                label="Tags"
                items={tags}
                selectedIds={draft.tag_ids}
                suggestedIds={analysis.suggestions.tag_ids}
                onChange={(ids) => updateDraft("tag_ids", ids)}
              />
            </div>

            <aside className="importAssistant__review">
              <section>
                <span className="importAssistant__eyebrow">Analyse</span>
                <h3>Was erkannt wurde</h3>
                <div className="importAssistant__findings">
                  {analysis.findings.map((finding, index) => (
                    <div key={`${finding.label}-${index}`} className={`is-${finding.type}`}>
                      <i>{finding.type === "warning" ? "!" : "✓"}</i>
                      <span>{finding.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <span className="importAssistant__eyebrow">Duplikatprüfung</span>
                <h3>
                  {analysis.duplicates.length
                    ? `${analysis.duplicates.length} möglicher Treffer`
                    : "Keine Überschneidung"}
                </h3>
                {analysis.duplicates.length ? (
                  <div className="importAssistant__duplicates">
                    {analysis.duplicates.map((duplicate) => (
                      <DuplicateCard
                        key={`${duplicate.type}-${duplicate.movie.id}`}
                        duplicate={duplicate}
                        studioMap={studioMap}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="importAssistant__allClear">
                    Pfad, Titel und Jahr sind im aktuellen Archiv unauffällig.
                  </p>
                )}
                {warningDuplicates.length && !blockingDuplicate ? (
                  <label className="importAssistant__duplicateConfirm">
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={(event) => setConfirmDuplicate(event.target.checked)}
                    />
                    <span>
                      Geprüft: Es ist kein Duplikat und darf importiert werden.
                    </span>
                  </label>
                ) : null}
              </section>

              <section className="importAssistant__summary">
                <span className="importAssistant__eyebrow">03 / Bereitstellen</span>
                <h3>{draft.title || "Titel fehlt"}</h3>
                <dl>
                  <div>
                    <dt>Studio</dt>
                    <dd>{draft.studio_id ? entityLabel(studios, draft.studio_id) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Qualität</dt>
                    <dd>{entityLabel(resolutions, draft.resolution_id)}</dd>
                  </div>
                  <div>
                    <dt>Cast</dt>
                    <dd>{draft.main_actor_ids.length + draft.supporting_actor_ids.length}</dd>
                  </div>
                  <div>
                    <dt>Tags</dt>
                    <dd>{draft.tag_ids.length}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                >
                  {saving ? "Film wird importiert…" : "Film jetzt importieren"}
                  {!saving ? <span>→</span> : null}
                </button>
                {blockingDuplicate ? (
                  <small className="is-blocked">
                    Derselbe Dateipfad ist bereits vergeben.
                  </small>
                ) : warningDuplicates.length && !confirmDuplicate ? (
                  <small>Bitte die Duplikatwarnung zuerst bestätigen.</small>
                ) : (
                  <small>
                    Speicherung erfolgt erst nach einer letzten Serverprüfung.
                  </small>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className="importAssistant__empty">
          <div>MP4</div>
          <span>Warte auf Videoquelle</span>
          <p>
            Nach der Analyse erscheinen hier Metadaten, Cast-Vorschläge und der
            Abgleich mit dem bestehenden Archiv.
          </p>
          <small>{movies.length} Filme stehen für den Vergleich bereit</small>
        </section>
      )}
    </section>
  );
}
