"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setErr("Passwort falsch.");
        } else {
          setErr("Login fehlgeschlagen.");
        }
        return;
      }

      // Erfolgreich: weiterleiten
      router.push(redirectTo);
    } catch (error) {
      console.error(error);
      setErr("Netzwerkfehler beim Login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          background: "#030712",
          borderRadius: 16,
          border: "1px solid #1f2937",
          padding: "1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div
            style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: 4,
            }}
          >
            1337 Library
          </div>
          <div
            style={{
              fontSize: "1.2rem",
              fontWeight: 600,
              color: "#e5e7eb",
            }}
          >
            Login
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label
              style={{
                fontSize: "0.8rem",
                color: "#9ca3af",
                display: "block",
                marginBottom: 4,
              }}
            >
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "1px solid #374151",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "0.9rem",
                padding: "8px 10px",
              }}
            />
          </div>

          {err && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "#f97373",
                marginTop: 4,
              }}
            >
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              marginTop: 8,
              width: "100%",
              borderRadius: 999,
              border: "none",
              background: "#f97316",
              color: "#111827",
              fontSize: "0.9rem",
              fontWeight: 600,
              padding: "8px 12px",
              cursor: loading || !password ? "default" : "pointer",
              opacity: loading || !password ? 0.7 : 1,
            }}
          >
            {loading ? "Prüfe …" : "Einloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}
