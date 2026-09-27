"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  hasUnreadPost,
  markPostsRead,
  observePostId,
} from "../../../lib/planetSuzyUpdates.mjs";
import styles from "./PlanetSuzyUpdates.module.css";

const LEGACY_STORAGE_KEY = "project1337:planet-suzy-updates:v1";

function formatCheckedAt(value) {
  if (!value) return "Noch nicht geprüft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Noch nicht geprüft";
  return "Zuletzt geprüft " + date.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ActorPortrait({ actor }) {
  const sources = [...new Set([
    actor.cast_image,
    actor.transparent_image,
    actor.profile_image,
  ].filter((source) => typeof source === "string" && source.trim()))];
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = sources[sourceIndex];
  const useNextSource = () => {
    setSourceIndex((current) => Math.min(current + 1, sources.length - 1));
  };

  if (!source) return null;

  return (
    <Image
      src={source}
      alt=""
      width={60}
      height={82}
      sizes="60px"
      quality={95}
      loading="lazy"
      onError={useNextSource}
      onLoad={(event) => {
        const image = event.currentTarget;
        const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
        if (
          sourceIndex < sources.length - 1 &&
          (image.naturalWidth < image.clientWidth * pixelRatio ||
            image.naturalHeight < image.clientHeight * pixelRatio)
        ) {
          useNextSource();
        }
      }}
    />
  );
}

export default function PlanetSuzyUpdates({
  actors = [],
  visible = false,
  enabled = false,
  onUnreadCountChange,
  onUnauthorized,
}) {
  const actorList = useMemo(
    () => [...actors].sort((a, b) => a.name.localeCompare(b.name, "de")),
    [actors]
  );
  const [states, setStates] = useState({});
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [favoriteError, setFavoriteError] = useState(null);
  const [checkingIds, setCheckingIds] = useState([]);
  const [favoriteOverrides, setFavoriteOverrides] = useState({});
  const [savingFavoriteIds, setSavingFavoriteIds] = useState([]);
  const statesRef = useRef({});
  const checkingRef = useRef(new Set());
  const unauthorizedRef = useRef(onUnauthorized);

  useEffect(() => {
    unauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    const loadStates = async () => {
      try {
        const response = await fetch("/api/planet-updates/state", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          unauthorizedRef.current?.();
          return;
        }
        if (!response.ok) throw new Error(result.error || "Update-Status konnte nicht geladen werden.");
        if (cancelled) return;
        const saved = result.states || {};
        let legacyStates = {};
        try {
          const parsed = JSON.parse(window.localStorage.getItem(LEGACY_STORAGE_KEY) || "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            legacyStates = parsed;
          }
        } catch {
          // Ignore malformed legacy browser data; Supabase remains the source of truth.
        }

        const legacyEntries = Object.entries(legacyStates);
        if (legacyEntries.length > 0) {
          const migrationResults = await Promise.all(legacyEntries.map(async ([actorId, state]) => {
            const migrationResponse = await fetch("/api/planet-updates/state", {
              method: "PUT",
              cache: "no-store",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ actorId, state }),
            });
            const migrationPayload = await migrationResponse.json().catch(() => ({}));
            return { actorId, response: migrationResponse, payload: migrationPayload };
          }));

          const failedMigration = migrationResults.find(({ response }) => !response.ok);
          if (failedMigration?.response.status === 401) {
            unauthorizedRef.current?.();
            return;
          }
          for (const { actorId, response, payload } of migrationResults) {
            if (response.ok && payload.state) saved[actorId] = payload.state;
          }
          if (failedMigration) {
            throw new Error("Alte Prüfstände konnten nicht vollständig zu Supabase übertragen werden.");
          }
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        }

        if (cancelled) return;
        statesRef.current = saved;
        setStates(saved);
        setStorageError(null);
      } catch (error) {
        if (!cancelled) setStorageError(error?.message || "Online gespeicherter Update-Status ist nicht erreichbar.");
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    };
    loadStates();
    return () => { cancelled = true; };
  }, []);

  const saveActorState = useCallback(async (actorId, nextState) => {
    const nextStates = { ...statesRef.current, [actorId]: nextState };
    statesRef.current = nextStates;
    setStates(nextStates);
    try {
      const response = await fetch("/api/planet-updates/state", {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, state: nextState }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        unauthorizedRef.current?.();
        throw new Error("Deine Admin-Sitzung ist abgelaufen.");
      }
      if (!response.ok) throw new Error(result.error || "Update-Status konnte online nicht gespeichert werden.");
      setStorageError(null);
    } catch (error) {
      setStorageError(error?.message || "Update-Status konnte online nicht gespeichert werden.");
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    const actorIds = new Set(actorList.map((actor) => actor.id));
    const unreadCount = Object.entries(states).filter(
      ([actorId, state]) => actorIds.has(actorId) && hasUnreadPost(state)
    ).length;
    onUnreadCountChange?.(unreadCount);
  }, [actorList, onUnreadCountChange, states, storageReady]);

  const checkActor = useCallback(
    async (actorId) => {
      if (!enabled || !storageReady || storageError || checkingRef.current.has(actorId)) return;
      checkingRef.current.add(actorId);
      setCheckingIds([...checkingRef.current]);

      try {
        const response = await fetch("/api/planet-updates/check", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actorId }),
        });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          unauthorizedRef.current?.();
          return;
        }

        const checkedAt = Date.now();
        if (!response.ok || !result.latestPostId) {
          const previous = statesRef.current[actorId] || {};
          await saveActorState(actorId, {
            ...previous,
            checkedAt,
            error: result.error || "Beitrag konnte nicht geprüft werden.",
          });
          return;
        }

        const previous = statesRef.current[actorId] || null;
        await saveActorState(
          actorId,
          observePostId(previous, result.latestPostId, checkedAt)
        );
      } catch {
        const previous = statesRef.current[actorId] || {};
        try {
          await saveActorState(actorId, {
            ...previous,
            checkedAt: Date.now(),
            error: "PlanetSuzy ist gerade nicht erreichbar. Bitte später erneut prüfen.",
          });
        } catch {
          // storageError is surfaced below; do not fall back to per-device state.
        }
      } finally {
        checkingRef.current.delete(actorId);
        setCheckingIds([...checkingRef.current]);
      }
    },
    [enabled, saveActorState, storageError, storageReady]
  );

  const markRead = useCallback(
    (actorId) => {
      const previous = statesRef.current[actorId];
      if (!previous) return;
      saveActorState(actorId, markPostsRead(previous)).catch(() => {});
    },
    [saveActorState]
  );

  const toggleFavorite = useCallback(async (actorId, currentValue) => {
    const nextValue = !currentValue;
    setFavoriteOverrides((previous) => ({ ...previous, [actorId]: nextValue }));
    setSavingFavoriteIds((previous) => [...new Set([...previous, actorId])]);
    setFavoriteError(null);
    try {
      const response = await fetch("/api/planet-updates/favorite", {
        method: "PUT",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorId, favorite: nextValue }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        unauthorizedRef.current?.();
        throw new Error("Deine Admin-Sitzung ist abgelaufen.");
      }
      if (!response.ok) throw new Error(result.error || "Favorit konnte nicht gespeichert werden.");
    } catch (error) {
      setFavoriteOverrides((previous) => ({ ...previous, [actorId]: currentValue }));
      setFavoriteError(error?.message || "Favorit konnte nicht gespeichert werden.");
    } finally {
      setSavingFavoriteIds((previous) => previous.filter((id) => id !== actorId));
    }
  }, []);

  const sortedActorList = useMemo(
    () => [...actorList].sort((a, b) => {
      const aFavorite = favoriteOverrides[a.id] ?? Boolean(a.planet_suzy_update_favorite);
      const bFavorite = favoriteOverrides[b.id] ?? Boolean(b.planet_suzy_update_favorite);
      const aCheckedAt = Number(states[a.id]?.checkedAt || 0);
      const bCheckedAt = Number(states[b.id]?.checkedAt || 0);
      return bCheckedAt - aCheckedAt ||
        Number(bFavorite) - Number(aFavorite) ||
        a.name.localeCompare(b.name, "de");
    }),
    [actorList, favoriteOverrides, states]
  );

  if (!visible) return null;

  return (
    <section className={styles.panel} aria-labelledby="planet-updates-title">
      <div className={styles.intro}>
        <div>
          <span className={styles.eyebrow}>THREAD MONITOR</span>
          <h2 id="planet-updates-title">Update</h2>
          <p>
            Hauptdarsteller und ihre PlanetSuzy-Threads. Neue Beitrags-IDs werden
            markiert; gelöschte Beiträge setzen den gespeicherten Höchststand
            nicht zurück.
          </p>
        </div>
        <div className={styles.polling}>
          <span className={styles.pulse} />
          Favoriten stündlich · übrige täglich oder manuell
        </div>
      </div>

      {!storageReady ? (
        <div className={styles.empty}>Update-Status wird geladen…</div>
      ) : actorList.length === 0 ? (
        <div className={styles.empty}>Keine Hauptdarsteller vorhanden.</div>
      ) : (
        <>
        {storageError ? <div className={styles.error} role="alert">{storageError}</div> : null}
        {favoriteError ? <div className={styles.error} role="alert">{favoriteError}</div> : null}
        <div className={styles.list}>
          {sortedActorList.map((actor) => {
            const state = states[actor.id];
            const unread = hasUnreadPost(state);
            const checking = checkingIds.includes(actor.id);
            const linked = Boolean(actor.planetsuzy_url);
            const favorite = favoriteOverrides[actor.id] ?? Boolean(actor.planet_suzy_update_favorite);
            const savingFavorite = savingFavoriteIds.includes(actor.id);

            return (
              <article
                className={unread ? styles.row + " " + styles.rowUnread : styles.row}
                key={actor.id}
              >
                <div className={styles.identity}>
                  <span className={styles.avatar}>
                    <ActorPortrait actor={actor} key={`${actor.cast_image || ""}:${actor.transparent_image || ""}:${actor.profile_image || ""}`} />
                  </span>
                  <div className={styles.actorInfo}>
                    <div className={styles.actorName}>
                      <strong>{actor.name}</strong>
                      {favorite ? <span className={styles.favoriteLabel}>Favorit</span> : null}
                    </div>
                    {linked ? (
                      <a
                        href={actor.planetsuzy_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => markRead(actor.id)}
                      >
                        PlanetSuzy-Thread <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span className={styles.noLink}>Kein Thread-Link hinterlegt</span>
                    )}
                  </div>
                </div>

                <div className={styles.status}>
                  {unread ? (
                    <span className={styles.newBadge}>
                      <span aria-hidden="true">!</span> Neuer Beitrag
                    </span>
                  ) : state?.maxPostId ? (
                    <span className={styles.postId}>{"Beitrag #" + state.maxPostId}</span>
                  ) : (
                    <span className={styles.waiting}>Noch kein Prüfstand</span>
                  )}
                  {state?.error ? (
                    <span className={styles.error} title={state.error}>
                      {state.error}
                    </span>
                  ) : (
                    <span className={styles.checkedAt}>
                      {formatCheckedAt(state?.checkedAt)}
                    </span>
                  )}
                </div>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={favorite ? styles.favoriteButton + " " + styles.favoriteActive : styles.favoriteButton}
                    onClick={() => toggleFavorite(actor.id, favorite)}
                    disabled={savingFavorite}
                    aria-label={favorite ? `${actor.name} nicht mehr priorisieren` : `${actor.name} für regelmäßige Prüfungen priorisieren`}
                    aria-pressed={favorite}
                    title={favorite ? "Aus Favoriten entfernen" : "Als Favorit markieren – häufiger prüfen"}
                  >
                    {favorite ? "★" : "☆"}
                  </button>
                  {unread ? (
                    <a
                      href={actor.planetsuzy_url}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.readButton}
                      onClick={() => markRead(actor.id)}
                    >
                      Öffnen <span aria-hidden="true">↗</span>
                    </a>
                  ) : null}
                  {linked ? (
                    <button
                      type="button"
                      className={styles.checkButton}
                      onClick={() => checkActor(actor.id)}
                      disabled={checking || Boolean(storageError)}
                      title={storageError || undefined}
                    >
                      {checking ? "Prüft…" : "Jetzt prüfen"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
        </>
      )}
    </section>
  );
}
