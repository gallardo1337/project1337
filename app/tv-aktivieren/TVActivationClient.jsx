"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./tv-aktivieren.module.css";

function formatCode(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "")
    .slice(0, 8);

  return normalized.length > 4
    ? `${normalized.slice(0, 4)}-${normalized.slice(4)}`
    : normalized;
}

export default function TVActivationClient({
  initialCode,
  initialAuthenticated,
}) {
  const [userCode, setUserCode] = useState(formatCode(initialCode));
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [username, setUsername] = useState("gallardo1337");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false);
  const [deviceName, setDeviceName] = useState("Apple TV");
  const [error, setError] = useState("");

  const codeComplete = userCode.replace("-", "").length === 8;

  async function approveDevice() {
    const response = await fetch("/api/tv-auth/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ userCode }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) setAuthenticated(false);
      throw new Error(payload?.error || "Apple TV konnte nicht verbunden werden.");
    }

    setDeviceName(payload?.deviceName || "Apple TV");
    setApproved(true);
  }

  async function handleApprove(event) {
    event.preventDefault();
    if (!codeComplete || busy) return;

    setBusy(true);
    setError("");
    try {
      await approveDevice();
    } catch (requestError) {
      setError(requestError?.message || "Apple TV konnte nicht verbunden werden.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLoginAndApprove(event) {
    event.preventDefault();
    if (!codeComplete || !username.trim() || !password || busy) return;

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Benutzername oder Passwort ist falsch."
            : payload?.error || "Anmeldung fehlgeschlagen."
        );
      }

      window.localStorage.setItem("auth_1337_flag", "1");
      window.localStorage.setItem("auth_1337_user", username.trim());
      setAuthenticated(true);
      setPassword("");
      await approveDevice();
    } catch (requestError) {
      setError(requestError?.message || "Anmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <section className={styles.card}>
        <div className={styles.brand}>
          <Image
            src="/logo.png"
            alt="Project 1337"
            width={142}
            height={69}
            priority
          />
          <span>TV CONNECT</span>
        </div>

        {approved ? (
          <div className={styles.success}>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.kicker}>VERBUNDEN</p>
            <h1>{deviceName} ist bereit.</h1>
            <p>Die Mediathek öffnet sich jetzt automatisch auf dem Fernseher.</p>
            <a href="/">Zur Project 1337 Library</a>
          </div>
        ) : (
          <>
            <p className={styles.kicker}>APPLE TV FREIGEBEN</p>
            <h1>Auf dem Handy bestätigen.</h1>
            <p className={styles.intro}>
              Vergleiche den Code mit dem Fernseher. Im QR-Code befinden sich
              keine Zugangsdaten.
            </p>

            <label className={styles.codeField}>
              <span>Gerätecode</span>
              <input
                value={userCode}
                onChange={(event) => setUserCode(formatCode(event.target.value))}
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
                placeholder="ABCD-2345"
                aria-label="Gerätecode"
              />
            </label>

            {authenticated ? (
              <form onSubmit={handleApprove}>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={!codeComplete || busy}
                >
                  {busy ? "Wird verbunden …" : "Apple TV verbinden"}
                </button>
              </form>
            ) : (
              <form className={styles.loginForm} onSubmit={handleLoginAndApprove}>
                <p>Bitte melde dich hier auf dem Handy an.</p>
                <label>
                  <span>Benutzername</span>
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                  />
                </label>
                <label>
                  <span>Passwort</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={!codeComplete || !username.trim() || !password || busy}
                >
                  {busy ? "Wird verbunden …" : "Anmelden & verbinden"}
                </button>
              </form>
            )}

            {error ? <p className={styles.error}>{error}</p> : null}
            <p className={styles.hint}>Der Code ist zehn Minuten gültig und nur einmal nutzbar.</p>
          </>
        )}
      </section>
    </main>
  );
}
