"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  hasUnreadPost,
  markPostsRead,
  observePostId,
} from "../../../lib/planetSuzyUpdates.mjs";
import styles from "./PlanetSuzyUpdates.module.css";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const CHECKED_AGAIN_AFTER_MS = 60 * 60 * 1000;
const AUTO_BATCH_SIZE = 3;

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatCheckedAt(value) {
  if (!value) return "Noch nicht geprüft";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Noch nicht geprüft";
  return "Zuletzt geprüft " + date.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const linkedActors = useMemo(
    () => actorList.filter((actor) => actor.planetsuzy_url),
    [actorList]
  );
  const [states, setStates] = useState({});
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [checkingIds, setCheckingIds] = useState([]);
  const statesRef = useRef({});
  const checkingRef = useRef(new Set());
  const batchRunningRef = useRef(false);
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
          onUnauthorized?.();
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

  useEffect(() => {
    if (!enabled || !storageReady || storageError || linkedActors.length === 0) return undefined;

    const runNextBatch = async () => {
      if (batchRunningRef.current) return;
      const now = Date.now();
      const dueActors = linkedActors
        .filter((actor) => {
          const checkedAt = Number(statesRef.current[actor.id]?.checkedAt || 0);
          return now - checkedAt >= CHECKED_AGAIN_AFTER_MS;
        })
        .sort(
          (a, b) =>
            Number(statesRef.current[a.id]?.checkedAt || 0) -
            Number(statesRef.current[b.id]?.checkedAt || 0)
        )
        .slice(0, AUTO_BATCH_SIZE);

      if (dueActors.length === 0) return;
      batchRunningRef.current = true;
      try {
        await Promise.all(dueActors.map((actor) => checkActor(actor.id)));
      } finally {
        batchRunningRef.current = false;
      }
    };

    const initialTimer = window.setTimeout(runNextBatch, 900);
    const interval = window.setInterval(runNextBatch, POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [checkActor, enabled, linkedActors, storageError, storageReady]);

  const markRead = useCallback(
    (actorId) => {
      const previous = statesRef.current[actorId];
      if (!previous) return;
      saveActorState(actorId, markPostsRead(previous)).catch(() => {});
    },
    [saveActorState]
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
          Automatische Prüfung: 3 Threads alle 5 Minuten
        </div>
      </div>

      {!storageReady ? (
        <div className={styles.empty}>Update-Status wird geladen…</div>
      ) : actorList.length === 0 ? (
        <div className={styles.empty}>Keine Hauptdarsteller vorhanden.</div>
      ) : (
        <>
        {storageError ? <div className={styles.error} role="alert">{storageError}</div> : null}
        <div className={styles.list}>
          {actorList.map((actor) => {
            const state = states[actor.id];
            const unread = hasUnreadPost(state);
            const checking = checkingIds.includes(actor.id);
            const linked = Boolean(actor.planetsuzy_url);

            return (
              <article
                className={unread ? styles.row + " " + styles.rowUnread : styles.row}
                key={actor.id}
              >
                <div className={styles.identity}>
                  <span className={styles.avatar}>{initials(actor.name)}</span>
                  <div className={styles.actorInfo}>
                    <strong>{actor.name}</strong>
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
