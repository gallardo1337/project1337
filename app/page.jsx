"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/* =========================
   Helpers & UI
========================= */

function Pill({ children }) {
  return <span className="pill">{children}</span>;
}

function EmptyState({ title, subtitle, action }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {subtitle ? <div className="empty__sub">{subtitle}</div> : null}
      {action ? <div className="empty__cta">{action}</div> : null}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="skRow">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skCard" />
      ))}
    </div>
  );
}

function safeOpen(url) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function includesLoose(hay, needle) {
  return String(hay || "")
    .toLowerCase()
    .includes(String(needle || "").toLowerCase());
}

/* =========================
   Filter Section
========================= */

function FilterSection({
  title,
  items,
  selectedKeys,
  getKey,
  getLabel,
  onToggle,
  search,
  setSearch,
  showSelectedOnly,
  setShowSelectedOnly,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const selectedSet = useMemo(() => new Set(selectedKeys.map(String)), [selectedKeys]);

  const filtered = useMemo(() => {
    let list = items || [];
    if (showSelectedOnly) list = list.filter((it) => selectedSet.has(String(getKey(it))));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((it) => includesLoose(getLabel(it), q));
    }
    return list;
  }, [items, showSelectedOnly, selectedSet, search, getKey, getLabel]);

  return (
    <div className="fsec">
      <button className="fsec__head" onClick={() => setOpen((v) => !v)}>
        <div className="fsec__title">{title}</div>
        <div className="fsec__chev">{open ? "—" : "+"}</div>
      </button>

      {open && (
        <div className="fsec__body">
          <div className="fsearch">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" />
          </div>

          <label className="toggle">
            <input type="checkbox" checked={showSelectedOnly} onChange={(e) => setShowSelectedOnly(e.target.checked)} />
            <span>Nur Auswahl</span>
          </label>

          <div className="pickList">
            {filtered.map((it) => {
              const key = String(getKey(it));
              const active = selectedSet.has(key);
              return (
                <button
                  key={key}
                  className={`pick ${active ? "pick--on" : ""}`}
                  onClick={() => onToggle(key)}
                >
                  {getLabel(it)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Page
========================= */

export default function HomePage() {
  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [viewMode, setViewMode] = useState("actors");
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);

  /* =========================
     CSS
  ========================= */

  return (
    <div className="nfx">
      <style jsx global>{`
        body {
          margin: 0;
          background: #0b0b0f;
          color: rgba(255, 255, 255, 0.92);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        }

        .wrap {
          max-width: 1240px;
          margin: 0 auto;
          padding: 0 18px 80px;
        }

        /* =========================
           LOGO (FINAL)
        ========================= */

        .logoSolo {
          margin: 26px 0 10px;
          display: flex;
          justify-content: center;
        }

        .logoSolo img {
          width: 260px;
          max-width: 70%;
          height: auto;
          opacity: 0.95;
        }

        /* =========================
           Sections
        ========================= */

        .sectionHead {
          margin: 28px 0 14px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .sectionTitle {
          font-size: 18px;
          font-weight: 800;
        }

        .row {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 12px;
        }

        .movieGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .card,
        .movieCard {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 12px;
          cursor: pointer;
        }

        .pill {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
        }

        @media (max-width: 900px) {
          .row {
            grid-template-columns: repeat(3, 1fr);
          }
          .movieGrid {
            grid-template-columns: repeat(2, 1fr);
          }
          .logoSolo img {
            width: 220px;
          }
        }

        @media (max-width: 600px) {
          .row,
          .movieGrid {
            grid-template-columns: 1fr;
          }
          .logoSolo img {
            width: 180px;
          }
        }
      `}</style>

      <div className="wrap">
        {/* LOGO – frei, klein, ohne Box */}
        <div className="logoSolo">
          <img src="/logo.png" alt="Project1337" />
        </div>

        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : viewMode === "actors" ? (
          <>
            <div className="sectionHead">
              <div className="sectionTitle">Hauptdarsteller</div>
            </div>
            <div className="row">
              {actors.map((a) => (
                <div key={a.id} className="card">
                  {a.name}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="sectionHead">
              <div className="sectionTitle">Filme</div>
            </div>
            <div className="movieGrid">
              {visibleMovies.map((m) => (
                <div key={m.id} className="movieCard">
                  {m.title}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
