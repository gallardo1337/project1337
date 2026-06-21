"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient"; // app/page.jsx -> ../lib/supabaseClient

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

function MovieCastCard({ person }) {
  return (
    <div className="movieCastCard" title={person.name}>
      <div className="movieCastCard__img">
        {person.profileImage ? (
          <img src={person.profileImage} alt={person.name} loading="lazy" />
        ) : (
          <div className="movieCastCard__placeholder">NO IMAGE</div>
        )}
      </div>
      <div className="movieCastCard__body">
        <div className="movieCastCard__name">{person.name}</div>
      </div>
    </div>
  );
}

function MovieDetailView({ movie, onBack }) {
  if (!movie) return null;

  const resolutionIcon = getResolutionIcon(movie.resolution);
  const mainCast = Array.isArray(movie.mainCast) ? movie.mainCast : [];
  const supportCast = Array.isArray(movie.supportCast) ? movie.supportCast : [];
  const castCount = mainCast.length + supportCast.length;

  return (
    <div className="movieDetail">
      <div className="movieDetail__top">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Zurück
        </button>

        {movie.fileUrl ? (
          <button
            type="button"
            className="btn"
            onClick={() => safeOpen(movie.fileUrl)}
          >
            Extern öffnen
          </button>
        ) : null}
      </div>

      <div className="movieDetail__playerShell">
        {movie.fileUrl ? (
          <video
            className="movieDetail__player"
            src={movie.fileUrl}
            poster={movie.thumbnailUrl || undefined}
            controls
            playsInline
            preload="metadata"
          />
        ) : (
          <div className="movieDetail__fallback">
            Für diesen Film ist keine Datei hinterlegt.
          </div>
        )}
      </div>

      <div className="movieDetail__titleBlock">
        <div className="movieDetail__titleRow">
          <h1 className="movieDetail__title">{movie.title || "Unbenannt"}</h1>

          {resolutionIcon ? (
            <img
              className="movieDetail__titleIcon"
              src={resolutionIcon.src}
              alt={resolutionIcon.alt}
              title={resolutionIcon.title}
            />
          ) : null}
        </div>

        <div className="movieDetail__infoLine">
          {movie.studio ? (
            <span className="movieDetail__studio">{movie.studio}</span>
          ) : null}

          {movie.studio && movie.year ? (
            <span className="movieDetail__dot">•</span>
          ) : null}

          {movie.year ? (
            <span className="movieDetail__year">{movie.year}</span>
          ) : null}

          {(movie.studio || movie.year) && movie.tags && movie.tags.length ? (
            <span className="movieDetail__dot">•</span>
          ) : null}

          {movie.tags && movie.tags.length ? (
            <span className="movieDetail__tags">
              {[...movie.tags]
                .sort((a, b) =>
                  a.localeCompare(b, "de", { sensitivity: "base" })
                )
                .join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      <section className="movieDetail__cast">
        {castCount === 0 ? (
          <EmptyState
            title="Keine Darsteller hinterlegt"
            subtitle="Für diesen Film sind aktuell keine Haupt- oder Nebendarsteller verknüpft."
          />
        ) : (
          <div className="movieCastGrid">
            {mainCast.map((person) => (
              <MovieCastCard
                key={`main-${person.id}`}
                person={person}
                type="Hauptdarsteller"
              />
            ))}
            {supportCast.map((person) => (
              <MovieCastCard
                key={`support-${person.id}`}
                person={person}
                type="Nebendarsteller"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function SkeletonRow() {
  return (
    <div className="skRow" aria-hidden="true">
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
      <div className="skCard" />
    </div>
  );
}

function safeOpen(url) {
  if (!url) return;
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    // ignore
  }
}

function includesLoose(hay, needle) {
  return String(hay || "")
    .toLowerCase()
    .includes(String(needle || "").toLowerCase());
}

function isUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v
    )
  );
}

function AutoFitActorTitle({ text }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isMobile = () =>
      typeof window !== "undefined" && window.innerWidth <= 700;

    const fit = () => {
      if (!ref.current) return;

      if (!isMobile()) {
        el.style.fontSize = "";
        return;
      }

      let size = 14;
      const min = 10;
      const step = 0.5;

      el.style.fontSize = `${size}px`;

      while (el.scrollWidth > el.clientWidth + 1 && size > min) {
        size -= step;
        el.style.fontSize = `${size}px`;
      }
    };

    const raf = requestAnimationFrame(fit);

    const onResize = () => fit();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [text]);

  return (
    <div ref={ref} className="card__title" title={text}>
      {text}
    </div>
  );
}


function AutoFitActorHeroName({ text }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      if (!ref.current) return;

      const width = el.clientWidth;
      if (!width) return;

      const isMobile =
        typeof window !== "undefined" && window.innerWidth <= 700;

      let size = isMobile ? 34 : 58;
      const min = isMobile ? 22 : 30;
      const step = 1;

      el.style.fontSize = `${size}px`;
      el.style.whiteSpace = "nowrap";

      while (el.scrollWidth > el.clientWidth + 1 && size > min) {
        size -= step;
        el.style.fontSize = `${size}px`;
      }
    };

    const raf = requestAnimationFrame(fit);
    const onResize = () => fit();

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [text]);

  return (
    <h1 ref={ref} className="actorHero__name" title={text}>
      {text}
    </h1>
  );
}

function FilterSection({
  title,
  subtitle,
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
  const selectedSet = useMemo(
    () => new Set(selectedKeys.map(String)),
    [selectedKeys]
  );

  const filtered = useMemo(() => {
    const base = items || [];
    let list = base;

    if (showSelectedOnly)
      list = list.filter((it) => selectedSet.has(String(getKey(it))));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((it) => includesLoose(getLabel(it), q));
    }

    return list;
  }, [items, showSelectedOnly, selectedSet, search, getKey, getLabel]);

  return (
    <div className="fsec">
      <button
        type="button"
        className="fsec__head"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="fsec__headL">
          <div className="fsec__title">{title}</div>
          <div className="fsec__sub">
            {subtitle ? (
              <>
                {subtitle} • <span className="mono">{selectedKeys.length}</span>{" "}
                aktiv
              </>
            ) : (
              <>
                <span className="mono">{selectedKeys.length}</span> aktiv
              </>
            )}
          </div>
        </div>
        <div className="fsec__headR">
          <span className="fsec__chev">{open ? "—" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="fsec__body">
          <div className="fsec__tools">
            <div className="fsearch">
              <svg
                className="fsearch__icon"
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen…"
              />
              {search ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => setSearch("")}
                >
                  Reset
                </button>
              ) : null}
            </div>

            <label className="toggle">
              <input
                type="checkbox"
                checked={showSelectedOnly}
                onChange={(e) => setShowSelectedOnly(e.target.checked)}
              />
              <span>Nur Auswahl</span>
            </label>
          </div>

          {selectedKeys.length > 0 ? (
            <div className="chipsRow">
              {selectedKeys.slice(0, 14).map((k) => {
                const it = items.find((x) => String(getKey(x)) === String(k));
                const label = it ? getLabel(it) : String(k);
                return (
                  <button
                    key={`sel-${title}-${k}`}
                    type="button"
                    className={`selChip`}
                    onClick={() => onToggle(k)}
                    title="Entfernen"
                  >
                    <span className="selChip__dot" />
                    <span className="selChip__txt">{label}</span>
                    <span className="selChip__x">×</span>
                  </button>
                );
              })}
              {selectedKeys.length > 14 ? (
                <Pill>+{selectedKeys.length - 14}</Pill>
              ) : null}
            </div>
          ) : null}

          <div className="pickList">
            {filtered.length === 0 ? (
              <div className="pickEmpty">Keine Treffer</div>
            ) : (
              filtered.map((it) => {
                const key = String(getKey(it));
                const active = selectedSet.has(key);
                return (
                  <button
                    key={`${title}-${key}`}
                    type="button"
                    className={`pick ${active ? "pick--on" : ""}`}
                    onClick={() => onToggle(key)}
                    title={getLabel(it)}
                  >
                    <span className="pick__dot" />
                    <span className="pick__txt">{getLabel(it)}</span>
                    <span className="pick__state">{active ? "ON" : ""}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getResolutionIcon(resolutionName) {
  const r = String(resolutionName || "").trim().toLowerCase();
  if (!r) return null;

  if (r === "4k" || r.includes("4k"))
    return { src: "/4k.svg", alt: "4K", title: "4K" };
  if (
    r === "fullhd" ||
    r === "full hd" ||
    r.includes("fullhd") ||
    r.includes("full hd")
  ) {
    return { src: "/fullhd.svg", alt: "FullHD", title: "FullHD" };
  }
  if (r === "retro" || r.includes("retro"))
    return { src: "/retro.svg", alt: "Retro", title: "Retro" };

  return null;
}

function getAgeFromBirthDate(value) {
  if (!value) return null;

  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const birthdayThisYear = new Date(
    today.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

  if (today < birthdayThisYear) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function formatBirthDate(value) {
  if (!value) return "";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);

  const formatted = d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const age = getAgeFromBirthDate(value);
  return age === null ? formatted : `${formatted} (${age})`;
}


function getCountryFlag(origin) {
  const value = String(origin || "").trim();
  if (!value) return null;

  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const map = {
    deutschland: "de",
    germany: "de",
    deutsch: "de",
    german: "de",
    de: "de",
    usa: "us",
    us: "us",
    unitedstates: "us",
    "united states": "us",
    amerika: "us",
    america: "us",
    kanada: "ca",
    canada: "ca",
    uk: "gb",
    gb: "gb",
    england: "gb",
    schottland: "gb",
    scotland: "gb",
    wales: "gb",
    frankreich: "fr",
    france: "fr",
    italien: "it",
    italy: "it",
    spanien: "es",
    spain: "es",
    portugal: "pt",
    niederlande: "nl",
    holland: "nl",
    netherlands: "nl",
    belgien: "be",
    belgium: "be",
    schweiz: "ch",
    switzerland: "ch",
    osterreich: "at",
    austria: "at",
    polen: "pl",
    poland: "pl",
    ukraine: "ua",
    russland: "ru",
    russia: "ru",
    tschechien: "cz",
    czechia: "cz",
    "czech republic": "cz",
    slowakei: "sk",
    slovakia: "sk",
    ungarn: "hu",
    ungarland: "hu",
    hungary: "hu",
    hu: "hu",
    albanien: "al",
    albania: "al",
    albanisch: "al",
    albanian: "al",
    al: "al",
    rumanien: "ro",
    romania: "ro",
    bulgarien: "bg",
    bulgaria: "bg",
    kroatien: "hr",
    croatia: "hr",
    serbien: "rs",
    serbia: "rs",
    turkei: "tr",
    turkey: "tr",
    griechenland: "gr",
    greece: "gr",
    danemark: "dk",
    denmark: "dk",
    schweden: "se",
    sweden: "se",
    norwegen: "no",
    norway: "no",
    finnland: "fi",
    finland: "fi",
    irland: "ie",
    ireland: "ie",
    australien: "au",
    australia: "au",
    neuseeland: "nz",
    "new zealand": "nz",
    mexiko: "mx",
    mexico: "mx",
    brasilien: "br",
    brazil: "br",
    argentinien: "ar",
    argentina: "ar",
    kolumbien: "co",
    colombia: "co",
    japan: "jp",
    china: "cn",
    sudkorea: "kr",
    korea: "kr",
    "south korea": "kr",
    thailand: "th",
    indien: "in",
    india: "in",
  };

  const compact = normalized.replace(/\s+/g, "");
  const code = map[normalized] || map[compact] || (/^[a-z]{2}$/.test(compact) ? compact : "");
  if (!code) return null;

  return {
    code,
    src: `https://flagcdn.com/w40/${code}.png`,
    srcSet: `https://flagcdn.com/w80/${code}.png 2x`,
  };
}

function normalizeStatValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HAIR_COLOR_TAGS = [
  "Blonde",
  "Brunette",
  "Dark Hair",
  "Red Hair",
].map(normalizeStatValue);

const FINISH_TAGS = [
  "Creampie",
  "Cum in Mouth",
  "Cum on Ass",
  "Cum on Belly",
  "Cum on Pussy",
  "Cum on Tits",
  "Swallow",
  "Facial",
].map(normalizeStatValue);

function isHairColorTag(tag) {
  const normalized = normalizeStatValue(tag);
  if (!normalized) return false;
  return HAIR_COLOR_TAGS.includes(normalized);
}

function isFinishTag(tag) {
  const normalized = normalizeStatValue(tag);
  if (!normalized) return false;
  return FINISH_TAGS.includes(normalized);
}

function countValues(values) {
  const counts = new Map();
  values
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean)
    .forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));

  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.value.localeCompare(b.value, "de", { sensitivity: "base" });
    });
}

function withPercent(items, total) {
  return items.map((item) => ({
    ...item,
    percent: total ? Math.round((item.count / total) * 100) : 0,
  }));
}

function buildActorStats(actorMovies) {
  const list = Array.isArray(actorMovies) ? actorMovies : [];
  const years = list
    .map((m) => parseInt(m.year, 10))
    .filter((y) => Number.isFinite(y));

  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearRange =
    minYear && maxYear
      ? minYear === maxYear
        ? String(minYear)
        : `${minYear}–${maxYear}`
      : "-";

  const allTags = list.flatMap((m) => (Array.isArray(m.tags) ? m.tags : []));
  const hairTags = allTags.filter(isHairColorTag);
  const finishTags = allTags.filter(isFinishTag);
  const topTagsSource = allTags.filter(
    (tag) => !isHairColorTag(tag) && !isFinishTag(tag)
  );
  const topStudios = countValues(list.map((m) => m.studio)).slice(0, 5);
  const topSupportingActors = countValues(
    list.flatMap((m) =>
      Array.isArray(m.supportingActorNames) ? m.supportingActorNames : []
    )
  ).slice(0, 5);
  const topTags = countValues(topTagsSource).slice(0, 5);
  const topFinish = countValues(finishTags).slice(0, 5);
  const totalResolutions = list.filter((m) => m.resolution).length;
  const totalHairTags = hairTags.length;
  const qualityStats = withPercent(countValues(list.map((m) => m.resolution)), totalResolutions);
  const hairColorStats = withPercent(countValues(hairTags), totalHairTags);

  return {
    yearRange,
    topStudios,
    topSupportingActors,
    topTags,
    topFinish,
    hairColorStats,
    qualityStats,
  };
}

function ActorHero({ actor, movieCount, movies: actorMovies = [] }) {
  const [statsOpen, setStatsOpen] = useState(false);

  if (!actor) return null;

  const originFlag = getCountryFlag(actor.origin);
  const stats = buildActorStats(actorMovies);
  const hasMeta = Boolean(actor.origin || actor.birthDate || stats.yearRange !== "-");
  const hasLinks = Boolean(actor.iafdUrl || actor.planetsuzyUrl);

  return (
    <section className="actorHero">
      <div className="actorHero__media">
        {actor.profileImage ? (
          <img src={actor.profileImage} alt={actor.name} />
        ) : (
          <div className="actorHero__placeholder">NO IMAGE</div>
        )}
      </div>

      <div className="actorHero__content">
        <div className="actorHero__main">
            <AutoFitActorHeroName text={actor.name} />
          <div className="actorHero__count">{movieCount} Film(e)</div>

          {hasMeta ? (
            <div className="actorHero__meta">
              {actor.origin ? (
                <div className="actorHero__metaItem">
                  <span>Herkunft</span>
                  <strong className="actorHero__metaValue">
                    {originFlag ? (
                      <img
                        className="actorHero__flag"
                        src={originFlag.src}
                        srcSet={originFlag.srcSet}
                        alt=""
                        loading="lazy"
                        aria-hidden="true"
                      />
                    ) : null}
                    {actor.origin}
                  </strong>
                </div>
              ) : null}

              {actor.birthDate ? (
                <div className="actorHero__metaItem">
                  <span>Geboren</span>
                  <strong className="actorHero__metaValue">
                    {formatBirthDate(actor.birthDate)}
                  </strong>
                </div>
              ) : null}

              {stats.yearRange !== "-" ? (
                <div className="actorHero__metaItem">
                  <span>Zeitraum</span>
                  <strong className="actorHero__metaValue">{stats.yearRange}</strong>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasLinks ? (
            <div className="actorHero__links">
              {actor.iafdUrl ? (
                <button
                  type="button"
                  className="actorHero__link"
                  onClick={() => safeOpen(actor.iafdUrl)}
                >
                  <img
                    className="actorHero__linkIcon"
                    src="/db.png"
                    alt="IAFD"
                  />
                </button>
              ) : null}

              {actor.planetsuzyUrl ? (
                <button
                  type="button"
                  className="actorHero__link"
                  onClick={() => safeOpen(actor.planetsuzyUrl)}
                >
                  <img
                    className="actorHero__linkIcon"
                    src="/palm.png"
                    alt="PlanetSuzy"
                  />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="actorHero__stats" aria-label="Statistiken">
          <button
            type="button"
            className="actorHero__statsToggle"
            onClick={() => setStatsOpen((value) => !value)}
            aria-expanded={statsOpen ? "true" : "false"}
          >
            <span>Statistiken</span>
            <span className="actorHero__statsToggleIcon" aria-hidden="true">
              {statsOpen ? "−" : "+"}
            </span>
          </button>

          <div className={`actorHero__statsGrid ${statsOpen ? "actorHero__statsGrid--open" : ""}`}>
            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Haarfarbe</div>
              <div className="actorHero__qualityList">
                {stats.hairColorStats.length ? (
                  stats.hairColorStats.map((hairColor) => (
                    <div key={hairColor.value} className="actorHero__qualityLine">
                      <div className="actorHero__qualityTop">
                        <span>{hairColor.value}</span>
                        <strong>{hairColor.percent}%</strong>
                      </div>
                      <div className="actorHero__qualityBar" aria-hidden="true">
                        <div style={{ width: `${hairColor.percent}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>

            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Qualität</div>
              <div className="actorHero__qualityList">
                {stats.qualityStats.length ? (
                  stats.qualityStats.map((quality) => (
                    <div key={quality.value} className="actorHero__qualityLine">
                      <div className="actorHero__qualityTop">
                        <span>{quality.value}</span>
                        <strong>{quality.percent}%</strong>
                      </div>
                      <div className="actorHero__qualityBar" aria-hidden="true">
                        <div style={{ width: `${quality.percent}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>

            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Top 5 Studios</div>
              <div className="actorHero__rankList">
                {stats.topStudios.length ? (
                  stats.topStudios.map((studio, index) => (
                    <div key={`${studio.value}-${index}`} className="actorHero__rankLine">
                      <span className="actorHero__rankNo">{index + 1}</span>
                      <strong>{studio.value}</strong>
                      <em>{studio.count}</em>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>

            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Top 5 Nebendarsteller</div>
              <div className="actorHero__rankList">
                {stats.topSupportingActors.length ? (
                  stats.topSupportingActors.map((supportingActor, index) => (
                    <div key={`${supportingActor.value}-${index}`} className="actorHero__rankLine">
                      <span className="actorHero__rankNo">{index + 1}</span>
                      <strong>{supportingActor.value}</strong>
                      <em>{supportingActor.count}</em>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>

            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Top 5 Tags</div>
              <div className="actorHero__rankList">
                {stats.topTags.length ? (
                  stats.topTags.map((tag, index) => (
                    <div key={`${tag.value}-${index}`} className="actorHero__rankLine">
                      <span className="actorHero__rankNo">{index + 1}</span>
                      <strong>{tag.value}</strong>
                      <em>{tag.count}</em>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>

            <div className="actorHero__statsBlock">
              <div className="actorHero__statsLabel">Top Finish</div>
              <div className="actorHero__rankList">
                {stats.topFinish.length ? (
                  stats.topFinish.map((finish, index) => (
                    <div key={`${finish.value}-${index}`} className="actorHero__rankLine">
                      <span className="actorHero__rankNo">{index + 1}</span>
                      <strong>{finish.value}</strong>
                      <em>{finish.count}</em>
                    </div>
                  ))
                ) : (
                  <div className="actorHero__emptyStat">-</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();

  const [movies, setMovies] = useState([]);
  const [actors, setActors] = useState([]);
  const [selectedActor, setSelectedActor] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  const [viewMode, setViewMode] = useState("actors"); // "actors" | "movies"
  const [visibleMovies, setVisibleMovies] = useState([]);
  const [movieSort, setMovieSort] = useState("added_desc");
  const [moviesTitle, setMoviesTitle] = useState("Filme");
  const [moviesSubtitle, setMoviesSubtitle] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState("gallardo1337");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErr, setLoginErr] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedStudio, setSelectedStudio] = useState("");
  const [selectedResolution, setSelectedResolution] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const [selectedMainActors, setSelectedMainActors] = useState([]);
  const [selectedSupportingActors, setSelectedSupportingActors] = useState([]);

  const [tagSearch, setTagSearch] = useState("");
  const [mainActorSearch, setMainActorSearch] = useState("");
  const [suppActorSearch, setSuppActorSearch] = useState("");

  const [tagsSelectedOnly, setTagsSelectedOnly] = useState(false);
  const [mainSelectedOnly, setMainSelectedOnly] = useState(false);
  const [suppSelectedOnly, setSuppSelectedOnly] = useState(false);

  const searchWrapRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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

  useEffect(() => {
    if (!filtersOpen && !mobileSearchOpen && !userMenuOpen) return;

    const onDown = (e) => {
      if (mobileSearchOpen) {
        const panel = document.querySelector(".mSearch__panel");
        if (panel && panel.contains(e.target)) return;
        setMobileSearchOpen(false);
        setFiltersOpen(false);
        setUserMenuOpen(false);
        return;
      }

      const root = searchWrapRef.current;
      if (root && !root.contains(e.target)) setFiltersOpen(false);

      const um = userMenuRef.current;
      if (um && !um.contains(e.target)) setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onDown, true);

    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onDown, true);
    };
  }, [filtersOpen, mobileSearchOpen, userMenuOpen]);

  useEffect(() => {
    if (!mobileSearchOpen && !userMenuOpen && !filtersOpen) return;

    const onKey = (e) => {
      if (e.key === "Escape") {
        setMobileSearchOpen(false);
        setFiltersOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSearchOpen, userMenuOpen, filtersOpen]);

  useEffect(() => {
    if (!loggedIn) {
      setMovies([]);
      setActors([]);
      setSelectedActor(null);
      setSelectedMovieId(null);
      setVisibleMovies([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setErr(null);

        const [
          moviesRes,
          actorsRes,
          actors2Res,
          studiosRes,
          tagsRes,
          resolutionsRes,
        ] = await Promise.all([
          supabase.from("movies").select("*"),
          supabase.from("actors").select("*"),
          supabase.from("actors2").select("*"),
          supabase.from("studios").select("*"),
          supabase.from("tags").select("*"),
          supabase.from("resolutions").select("*"),
        ]);

        if (moviesRes.error) throw moviesRes.error;
        if (actorsRes.error) throw actorsRes.error;
        if (actors2Res.error) throw actors2Res.error;
        if (studiosRes.error) throw studiosRes.error;
        if (tagsRes.error) throw tagsRes.error;
        if (resolutionsRes.error) throw resolutionsRes.error;

        const moviesData = moviesRes.data || [];
        const mainActors = actorsRes.data || [];
        const supportActors = actors2Res.data || [];
        const studios = studiosRes.data || [];
        const tags = tagsRes.data || [];
        const resolutions = resolutionsRes.data || [];

        const mainActorById = Object.fromEntries(
          mainActors.map((a) => [a.id, a])
        );
        const supportActorById = Object.fromEntries(
          supportActors.map((a) => [a.id, a])
        );
        const studioMap = Object.fromEntries(
          studios.map((s) => [s.id, s.name])
        );
        const tagMap = Object.fromEntries(tags.map((t) => [t.id, t.name]));
        const resolutionMap = Object.fromEntries(
          resolutions.map((r) => [r.id, r.name])
        );

        const mappedMovies = (moviesData || []).map((m) => {
          const mainIds = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          const supportIds = Array.isArray(m.supporting_actor_ids)
            ? m.supporting_actor_ids
            : [];

          const mainNames = mainIds
            .map((id) => mainActorById[id]?.name)
            .filter(Boolean);
          const supportNames = supportIds
            .map((id) => supportActorById[id]?.name)
            .filter(Boolean);

          const allActors = [...mainNames, ...supportNames];
          const tagNames = Array.isArray(m.tag_ids)
            ? m.tag_ids
                .map((id) => tagMap[id])
                .filter(Boolean)
                .sort((a, b) =>
                  a.localeCompare(b, "de", { sensitivity: "base" })
                )
            : [];

          const resolutionName = m.resolution_id
            ? resolutionMap[m.resolution_id] || null
            : null;

          return {
            id: m.id,
            title: m.title,
            year: m.year,
            fileUrl: m.file_url,
            studio: m.studio_id ? studioMap[m.studio_id] || null : null,
            resolution: resolutionName,
            thumbnailUrl: m.thumbnail_url || null,
            addedAt: m.created_at || m.inserted_at || m.createdAt || null,
            actors: allActors,
            tags: tagNames,
            mainActorIds: mainIds,
            supportingActorIds: supportIds,
            mainActorNames: mainNames,
            supportingActorNames: supportNames,
            mainCast: mainIds
              .map((id) => mainActorById[id])
              .filter(Boolean)
              .map((a) => ({
                id: a.id,
                name: a.name,
                profileImage: a.profile_image || null,
              })),
            supportCast: supportIds
              .map((id) => supportActorById[id])
              .filter(Boolean)
              .map((a) => ({
                id: a.id,
                name: a.name,
                profileImage: a.profile_image || null,
              })),
          };
        });

        setMovies(mappedMovies);

        const movieCountByActorId = new Map();
        moviesData.forEach((m) => {
          const arr = Array.isArray(m.main_actor_ids) ? m.main_actor_ids : [];
          arr.forEach((id) =>
            movieCountByActorId.set(id, (movieCountByActorId.get(id) || 0) + 1)
          );
        });

        const actorList = mainActors
          .map((a) => ({
            id: a.id,
            slug: a.slug || null,
            name: a.name,
            profileImage: a.profile_image || null,
            origin: a.origin || null,
            birthDate: a.birth_date || null,
            iafdUrl: a.iafd_url || null,
            planetsuzyUrl: a.planetsuzy_url || null,
            movieCount: movieCountByActorId.get(a.id) || 0,
          }))
          .filter((a) => a.movieCount > 0)
          .sort((a, b) =>
            a.name.localeCompare(b.name, "de", { sensitivity: "base" })
          );

        setActors(actorList);

        let actorParam = null;
        let movieParam = null;
        if (typeof window !== "undefined") {
          const sp = new URLSearchParams(window.location.search || "");
          actorParam = sp.get("actor");
          movieParam = sp.get("movie");
        }

        if (movieParam && mappedMovies.some((movie) => String(movie.id) === String(movieParam))) {
          setSelectedMovieId(movieParam);
          setViewMode("movies");
          setSelectedActor(null);
          setVisibleMovies([]);
          setMoviesTitle("Filme");
          setMoviesSubtitle("");
        } else if (actorParam) {
          const actor =
            isUuid(actorParam)
              ? actorList.find((a) => String(a.id) === String(actorParam))
              : actorList.find((a) => String(a.slug) === String(actorParam));

          if (actor) {
            const subset = mappedMovies.filter(
              (movie) =>
                Array.isArray(movie.mainActorIds) &&
                movie.mainActorIds.includes(actor.id)
            );

            if (isUuid(actorParam) && actor.slug) {
              const sp = new URLSearchParams(window.location.search || "");
              sp.set("actor", actor.slug);
              router.replace(`/?${sp.toString()}`, { scroll: false });
            }

            setSelectedActor(actor);
            setSelectedMovieId(null);
            setMoviesTitle(actor.name);
            setMoviesSubtitle(`${subset.length} Film(e)`);
            setVisibleMovies(subset);
            setViewMode("movies");
          } else {
            setViewMode("actors");
            setSelectedActor(null);
            setSelectedMovieId(null);
            setVisibleMovies([]);
            setMoviesTitle("Filme");
            setMoviesSubtitle("");
          }
        } else {
          setViewMode("actors");
          setSelectedActor(null);
          setSelectedMovieId(null);
          setVisibleMovies([]);
          setMoviesTitle("Filme");
          setMoviesSubtitle("");
        }
      } catch (e) {
        console.error(e);
        setErr("Fehler beim Laden der Daten.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [loggedIn, router]);

  const allTags = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => (m.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const allStudios = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      if (m.studio) set.add(m.studio);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const allResolutions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) => {
      if (m.resolution) set.add(m.resolution);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const mainActorOptions = useMemo(() => {
    return (actors || [])
      .map((a) => ({ id: a.id, name: a.name }))
      .sort((a, b) =>
        a.name.localeCompare(b.name, "de", { sensitivity: "base" })
      );
  }, [actors]);

  const supportingActorOptions = useMemo(() => {
    const set = new Set();
    movies.forEach((m) =>
      (m.supportingActorNames || []).forEach((n) => set.add(n))
    );
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, "de", { sensitivity: "base" })
    );
  }, [movies]);

  const applyAdvancedFilters = (baseList) => {
    let list = baseList;

    if (selectedStudio)
      list = list.filter((m) => (m.studio || "") === selectedStudio);
    if (selectedResolution)
      list = list.filter((m) => (m.resolution || "") === selectedResolution);

    const yf = yearFrom ? parseInt(yearFrom, 10) : null;
    const yt = yearTo ? parseInt(yearTo, 10) : null;
    if (yf || yt) {
      list = list.filter((m) => {
        const y = m.year ? parseInt(m.year, 10) : null;
        if (!y) return false;
        if (yf && y < yf) return false;
        if (yt && y > yt) return false;
        return true;
      });
    }

    if (selectedTags.length > 0) {
      list = list.filter((m) => {
        const mtags = Array.isArray(m.tags) ? m.tags : [];
        return selectedTags.every((t) => mtags.includes(t));
      });
    }

    if (selectedMainActors.length > 0) {
      list = list.filter((m) => {
        const ids = Array.isArray(m.mainActorIds)
          ? m.mainActorIds.map(String)
          : [];
        return selectedMainActors.map(String).every((id) => ids.includes(id));
      });
    }

    if (selectedSupportingActors.length > 0) {
      list = list.filter((m) => {
        const names = Array.isArray(m.supportingActorNames)
          ? m.supportingActorNames
          : [];
        return selectedSupportingActors.every((n) => names.includes(n));
      });
    }

    return list;
  };

  const hasAnyFilter = useMemo(() => {
    return Boolean(
      selectedStudio ||
        selectedResolution ||
        selectedTags.length > 0 ||
        yearFrom ||
        yearTo ||
        selectedMainActors.length > 0 ||
        selectedSupportingActors.length > 0
    );
  }, [
    selectedStudio,
    selectedResolution,
    selectedTags.length,
    yearFrom,
    yearTo,
    selectedMainActors.length,
    selectedSupportingActors.length,
  ]);

  const showMovies = viewMode === "movies";

  const getAddedTime = (movie) => {
    if (!movie?.addedAt) return 0;
    const t = new Date(movie.addedAt).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const getYearValue = (movie) => {
    const y = movie?.year ? parseInt(movie.year, 10) : 0;
    return Number.isNaN(y) ? 0 : y;
  };

  const getQualityRank = (movie) => {
    const r = String(movie?.resolution || "").trim().toLowerCase();
    if (r.includes("4k")) return 3;
    if (r.includes("fullhd") || r.includes("full hd")) return 2;
    if (r.includes("retro")) return 1;
    return 0;
  };

  const movieList = useMemo(() => {
    if (!showMovies) return [];

    const list = [...visibleMovies];

    list.sort((a, b) => {
      if (movieSort === "year_desc") {
        return (getYearValue(b) - getYearValue(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
      }

      if (movieSort === "quality_desc") {
        return (getQualityRank(b) - getQualityRank(a)) || (getAddedTime(b) - getAddedTime(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
      }

      return (getAddedTime(b) - getAddedTime(a)) || String(a.title || "").localeCompare(String(b.title || ""), "de", { sensitivity: "base" });
    });

    return list;
  }, [showMovies, visibleMovies, movieSort]);

  const handleShowMoviesForActor = (actorId, actorName, actorSlug) => {
    const actor = actors.find((a) => String(a.id) === String(actorId)) || null;
    const urlVal = actorSlug ? actorSlug : actorId;
    router.replace(`/?actor=${encodeURIComponent(urlVal)}`, { scroll: false });

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    const subset = movies.filter(
      (movie) =>
        Array.isArray(movie.mainActorIds) && movie.mainActorIds.includes(actorId)
    );
    const filtered = applyAdvancedFilters(subset);
    setSelectedActor(actor);
    setSelectedMovieId(null);
    setMoviesTitle(actorName);
    setMoviesSubtitle(`${filtered.length} Film(e)`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const handleSearchChange = (val) => {
    setSearch(val);
    const trimmed = val.trim();

    if (!trimmed) {
      if (hasAnyFilter) {
        const filtered = applyAdvancedFilters(movies);
        setMoviesTitle("Gefilterte Filme");
        setMoviesSubtitle(`${filtered.length} Treffer`);
        setVisibleMovies(filtered);
        setSelectedActor(null);
        setSelectedMovieId(null);
        setViewMode("movies");
      } else {
        router.replace("/", { scroll: false });
        setSelectedActor(null);
        setSelectedMovieId(null);
        setViewMode("actors");
        setVisibleMovies([]);
        setMoviesTitle("Filme");
        setMoviesSubtitle("");
      }
      return;
    }

    router.replace("/", { scroll: false });

    const q = trimmed.toLowerCase();
    const raw = movies.filter((movie) => {
      const haystack = [
        movie.title || "",
        movie.studio || "",
        movie.resolution || "",
        movie.actors.join(" "),
        movie.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

    const filtered = applyAdvancedFilters(raw);
    setSelectedActor(null);
    setSelectedMovieId(null);
    setMoviesTitle(`Suchergebnis für "${trimmed}"`);
    setMoviesSubtitle(`${filtered.length} Treffer`);
    setVisibleMovies(filtered);
    setViewMode("movies");
  };

  const handleBackToActors = () => {
    router.replace("/", { scroll: false });
    setViewMode("actors");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
  };

  const handleSwitchToMovies = () => {
    router.replace("/", { scroll: false });
    const filtered = applyAdvancedFilters(movies);
    setSelectedActor(null);
    setSelectedMovieId(null);
    setViewMode("movies");
    setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
    setMoviesSubtitle(`${filtered.length} Film(e)`);
    setVisibleMovies(filtered);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErr(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPassword }),
      });

      if (!res.ok) {
        setLoginErr(
          res.status === 401
            ? "User oder Passwort falsch."
            : "Login fehlgeschlagen."
        );
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
      // ignore
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("auth_1337_flag");
      window.localStorage.removeItem("auth_1337_user");
    }
    router.replace("/", { scroll: false });
    setLoggedIn(false);
    setSearch("");
    setSelectedActor(null);
    setSelectedMovieId(null);
    setViewMode("actors");
    setVisibleMovies([]);
    setMoviesTitle("Filme");
    setMoviesSubtitle("");
    setFiltersOpen(false);
    setMobileSearchOpen(false);
    setUserMenuOpen(false);
  };

  const resetFilters = () => {
    setSelectedTags([]);
    setSelectedStudio("");
    setSelectedResolution("");
    setYearFrom("");
    setYearTo("");
    setSelectedMainActors([]);
    setSelectedSupportingActors([]);

    setTagSearch("");
    setMainActorSearch("");
    setSuppActorSearch("");
    setTagsSelectedOnly(false);
    setMainSelectedOnly(false);
    setSuppSelectedOnly(false);
  };

  const applyFiltersNow = () => {
    if (search.trim()) handleSearchChange(search);
    else {
      router.replace("/", { scroll: false });
      const filtered = applyAdvancedFilters(movies);
      setSelectedActor(null);
      setViewMode("movies");
      setMoviesTitle(hasAnyFilter ? "Gefilterte Filme" : "Filme");
      setMoviesSubtitle(`${filtered.length} Treffer`);
      setVisibleMovies(filtered);
    }

    setFiltersOpen(false);
    setMobileSearchOpen(false);
  };

  const toggleTag = (t) =>
    setSelectedTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const toggleMainActor = (id) => {
    const sid = String(id);
    setSelectedMainActors((prev) => {
      const p = prev.map(String);
      return p.includes(sid) ? p.filter((x) => x !== sid) : [...p, sid];
    });
  };

  const toggleSupportingActor = (name) =>
    setSelectedSupportingActors((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );

  const tagItems = useMemo(
    () => allTags.map((t) => ({ key: t, label: t })),
    [allTags]
  );
  const mainItems = useMemo(
    () => mainActorOptions.map((a) => ({ key: String(a.id), label: a.name })),
    [mainActorOptions]
  );
  const suppItems = useMemo(
    () => supportingActorOptions.map((n) => ({ key: n, label: n })),
    [supportingActorOptions]
  );

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setFiltersOpen(true);
    setUserMenuOpen(false);
    setTimeout(() => mobileSearchInputRef.current?.focus(), 0);
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setFiltersOpen(false);
  };

  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return movies.find((movie) => String(movie.id) === String(selectedMovieId)) || null;
  }, [movies, selectedMovieId]);

  const handleOpenMovie = (movie) => {
    if (!movie?.id) return;

    const sp = new URLSearchParams();
    sp.set("movie", String(movie.id));
    router.replace(`/?${sp.toString()}`, { scroll: false });
    setSelectedMovieId(String(movie.id));

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  const handleCloseMovie = () => {
    setSelectedMovieId(null);

    if (selectedActor) {
      const urlVal = selectedActor.slug ? selectedActor.slug : selectedActor.id;
      router.replace(`/?actor=${encodeURIComponent(urlVal)}`, { scroll: false });
    } else {
      router.replace("/", { scroll: false });
    }

    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  };

  // Reusable ViewToggle component
  const ViewToggle = () => (
    <div className="viewToggle">
      <button
        type="button"
        className={`viewToggle__btn ${viewMode === "actors" ? "viewToggle__btn--active" : ""}`}
        onClick={handleBackToActors}
      >
        Darsteller
      </button>
      <button
        type="button"
        className={`viewToggle__btn ${viewMode === "movies" ? "viewToggle__btn--active" : ""}`}
        onClick={handleSwitchToMovies}
      >
        Filme
      </button>
    </div>
  );

  const SortControl = () => (
    <select
        className="actorSortSelect"
        value={movieSort}
        onChange={(e) => setMovieSort(e.target.value)}
      >
        <option value="added_desc">Zuletzt hinzugefügt</option>
        <option value="year_desc">Erscheinungsdatum</option>
        <option value="quality_desc">Qualität</option>
      </select>
  );

  return (
    <div className="nfx">
      <style jsx global>{`
        :root {
          --bg: #0b0b0f;
          --text: rgba(255, 255, 255, 0.92);
          --muted: rgba(255, 255, 255, 0.68);
          --muted2: rgba(255, 255, 255, 0.52);
          --accent: #e50914;
          --shadow: rgba(0, 0, 0, 0.55);
          --menuBg: #111218;
        }

        html,
        body {
          background: var(--bg);
          color: var(--text);
        }
        * {
          box-sizing: border-box;
        }
        .mono {
          font-variant-numeric: tabular-nums;
        }

        .nfx {
          min-height: 100vh;
          background: radial-gradient(
              1200px 700px at 15% 15%,
              rgba(229, 9, 20, 0.25),
              transparent 55%
            ),
            radial-gradient(
              900px 600px at 85% 10%,
              rgba(255, 255, 255, 0.08),
              transparent 55%
            ),
            radial-gradient(
              900px 700px at 60% 80%,
              rgba(255, 255, 255, 0.06),
              transparent 60%
            ),
            linear-gradient(
              180deg,
              rgba(0, 0, 0, 0.65),
              rgba(0, 0, 0, 0.95)
            );
        }

        .topbar {
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
        .topbar__mid {
          justify-self: center;
          width: 100%;
          min-width: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .topbar__right {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .input {
          width: 100%;
          height: 42px;
          min-height: 42px;
          max-height: 42px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          padding: 0 14px;
          overflow: hidden;
          min-width: 0;
          transition: border-color 0.18s ease, background 0.18s ease;
        }
        .input:focus-within {
          border-color: rgba(229, 9, 20, 0.55);
          background: rgba(255, 255, 255, 0.08);
        }
        .input__icon {
          width: 16px;
          height: 16px;
          opacity: 0.8;
        }
        .input input {
          flex: 1;
          min-width: 0;
          width: 100%;
          height: 100%;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 14px;
          line-height: 42px;
        }
        .input input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
          white-space: nowrap;
        }
        .btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .btn:active {
          transform: translateY(0px);
        }
        .btn--primary {
          background: linear-gradient(
            180deg,
            rgba(229, 9, 20, 0.95),
            rgba(229, 9, 20, 0.78)
          );
          border-color: rgba(229, 9, 20, 0.6);
          box-shadow: 0 18px 36px rgba(229, 9, 20, 0.22);
        }
        .btn--primary:hover {
          background: linear-gradient(
            180deg,
            rgba(255, 21, 33, 0.95),
            rgba(229, 9, 20, 0.8)
          );
          border-color: rgba(255, 21, 33, 0.65);
        }
        .btn--ghost {
          background: transparent;
        }
        .btn--danger {
          border-color: rgba(229, 9, 20, 0.35);
        }
        .btn--xs {
          padding: 6px 10px;
          border-radius: 10px;
          font-size: 12px;
        }

        /* View Toggle */
        .viewToggle {
          display: inline-flex;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          padding: 4px;
          gap: 4px;
        }
        .viewToggle__btn {
          appearance: none;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255, 255, 255, 0.62);
          border-radius: 10px;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease,
            border-color 0.15s ease;
          white-space: nowrap;
        }
        .viewToggle__btn:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.06);
        }
        .viewToggle__btn--active {
          background: rgba(229, 9, 20, 0.18);
          border-color: rgba(229, 9, 20, 0.35);
          color: rgba(255, 255, 255, 0.95);
        }


        .sortBox__select option {
          background: var(--menuBg);
          color: rgba(255, 255, 255, 0.92);
        }

        .auth__label {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 700;
          font-size: 13px;
        }

        /* User dropdown */
        .userMenu {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .userMenu__btn {
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
        .userMenu__btn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .userMenu__btn svg {
          width: 18px;
          height: 18px;
          opacity: 0.9;
        }
        .userMenu__panel {
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
        .userMenu__item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
          transition: transform 0.12s ease, background 0.12s ease,
            border-color 0.12s ease;
          text-align: left;
        }
        .userMenu__item:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .userMenu__item:active {
          transform: translateY(0px);
        }
        .userMenu__item--danger {
          border-color: rgba(229, 9, 20, 0.35);
        }

        .searchWrap {
          position: relative;
          width: 100%;
          max-width: 860px;
          min-width: 0;
          display: grid;
          gap: 10px;
        }

        .filterPopover {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          z-index: 2000;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.92);
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }

        .filterPopover__head {
          padding: 12px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .filterPopover__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .filterPopover__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .filterPopover__body {
          padding: 12px;
          max-height: min(70vh, 640px);
          overflow: auto;
        }

        .wrap {
          width: 100%;
          max-width: 1800px;
          margin: 0 auto;
          padding: 0 18px 70px;
        }

        .logoSolo {
          margin-top: 22px;
          display: flex;
          justify-content: center;
        }
        .logoSolo__img {
          width: min(260px, 65%);
          height: auto;
          display: block;
          opacity: 0.95;
          filter: drop-shadow(0 18px 55px rgba(0, 0, 0, 0.55));
        }

        .sectionHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin: 22px 2px 12px;
        }
        .sectionTitle {
          font-size: 18px;
          font-weight: 850;
          letter-spacing: -0.01em;
        }
        .sectionMeta {
          color: var(--muted2);
          font-size: 13px;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          font-weight: 650;
        }

        .row {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }

        .card {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          transition: transform 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;
        }
        .card:hover {
          transform: translateY(-3px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .card__img {
          position: relative;
          width: 100%;
          aspect-ratio: 3/4;
          background: rgba(255, 255, 255, 0.06);
          overflow: hidden;
        }
        .card__img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scale(1.02);
        }

        .card__badge {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 2;
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(0, 0, 0, 0.55);
          color: rgba(255, 255, 255, 0.92);
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          backdrop-filter: blur(10px);
        }

        .card__body {
          padding: 8px 10px 10px;
        }
        .card__title {
          font-weight: 600;
          font-size: 14px;
          line-height: 1.4;
          letter-spacing: -0.01em;
          margin: 0;
          text-align: center;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 18px;
          white-space: nowrap;
        }

        .movieGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .movieCard {
          position: relative;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
          transition: transform 0.14s ease, border-color 0.14s ease,
            background 0.14s ease;

          display: flex;
          flex-direction: column;
        }
        .movieCard:hover {
          transform: translateY(-2px);
          border-color: rgba(229, 9, 20, 0.35);
          background: rgba(255, 255, 255, 0.07);
        }
        .movieCard--clickable {
          cursor: pointer;
        }

        .movieCard--clickable:focus {
          outline: none;
          border-color: rgba(229, 9, 20, 0.48);
          background: rgba(255, 255, 255, 0.075);
        }

        .movieCard__resIcon {
          position: absolute;
          right: 8px;
          bottom: 8px;
          width: 46px;
          height: 46px;
          z-index: 6;
          pointer-events: none;
          filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.55));
          opacity: 0.95;
        }

        .movieCard__resIcon--noThumb {
          right: 14px;
          bottom: 14px;
        }

        .movieCard__resIcon img {
          width: 100%;
          height: 100%;
          display: block;
        }


        .movieCard__thumb {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .movieCard__thumb img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          display: block;
          transform: none;
        }

        .movieCard__top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex: 0 0 auto;
        }

        .movieCard__title {
          margin: 0;
          font-weight: 900;
          letter-spacing: -0.01em;
          line-height: 1.15;
          max-width: 100%;
          font-size: 16px;

          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;

          min-height: 56px;
        }

        .movieCard__year {
          color: rgba(255, 255, 255, 0.62);
          font-weight: 800;
          font-size: 13px;
          white-space: nowrap;
          padding-top: 2px;
        }

        .movieCard__meta {
          margin-top: 10px;
          display: grid;
          gap: 8px;
          flex: 0 0 auto;
        }

        .kv {
          display: grid;
          grid-template-columns: 90px 1fr;
          gap: 10px;
          align-items: start;
        }
        .kv__k {
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .kv__v {
          color: rgba(255, 255, 255, 0.84);
          font-size: 13px;
          line-height: 1.35;
        }

        .movieCard__tags {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }


        .authForm {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .authField {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 8px 10px;
        }
        .authField input {
          width: 130px;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 13px;
        }

        .errorBanner {
          margin-top: 14px;
          border-radius: 16px;
          padding: 12px 14px;
          border: 1px solid rgba(229, 9, 20, 0.35);
          background: rgba(229, 9, 20, 0.1);
          color: rgba(255, 255, 255, 0.88);
        }

        .empty {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        }
        .empty__title {
          font-weight: 900;
          font-size: 16px;
          margin-bottom: 6px;
        }
        .empty__sub {
          color: rgba(255, 255, 255, 0.68);
          font-size: 13px;
          line-height: 1.45;
        }
        .empty__cta {
          margin-top: 12px;
        }

        .skRow {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 12px;
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        .skCard {
          border-radius: 16px;
          aspect-ratio: 3/4;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.08),
            rgba(255, 255, 255, 0.05)
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s infinite linear;
        }

        .filterGrid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .filterGrid {
            grid-template-columns: 1fr;
          }
        }
        .fieldLabel {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .select {
          width: 100%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.92);
          border-radius: 12px;
          padding: 10px 12px;
          outline: none;
        }
        .select option {
          background: var(--menuBg);
          color: rgba(255, 255, 255, 0.92);
        }

        .yearRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .fsec {
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          overflow: hidden;
        }
        .fsec__head {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px;
          background: rgba(0, 0, 0, 0.25);
          border: none;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .fsec__head:hover {
          background: rgba(0, 0, 0, 0.32);
        }
        .fsec__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .fsec__sub {
          margin-top: 2px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
        }
        .fsec__chev {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          font-weight: 900;
        }
        .fsec__body {
          padding: 12px;
          display: grid;
          gap: 10px;
        }

        .fsec__tools {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .fsearch {
          flex: 1;
          min-width: 220px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 8px 10px;
        }
        .fsearch__icon {
          width: 16px;
          height: 16px;
          opacity: 0.75;
        }
        .fsearch input {
          width: 100%;
          outline: none;
          border: none;
          background: transparent;
          color: var(--text);
          font-size: 13px;
        }
        .fsearch input::placeholder {
          color: rgba(255, 255, 255, 0.45);
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 700;
          user-select: none;
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }
        .toggle input {
          accent-color: var(--accent);
        }

        .chipsRow {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .selChip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(229, 9, 20, 0.28);
          background: rgba(229, 9, 20, 0.1);
          color: rgba(255, 255, 255, 0.88);
          cursor: pointer;
          font-size: 12px;
          font-weight: 750;
        }
        .selChip:hover {
          border-color: rgba(229, 9, 20, 0.4);
          background: rgba(229, 9, 20, 0.14);
        }
        .selChip__dot {
          width: 7px;
          height: 7px;
          border-radius: 99px;
          background: var(--accent);
        }
        .selChip__txt {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .selChip__x {
          opacity: 0.9;
          font-size: 14px;
          line-height: 1;
        }

        .pickList {
          max-height: 260px;
          overflow: auto;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.22);
          padding: 6px;
        }
        .pickList::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        .pickList::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 999px;
        }
        .pick {
          width: 100%;
          display: grid;
          grid-template-columns: 14px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          text-align: left;
        }
        .pick:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.08);
        }
        .pick--on {
          background: rgba(229, 9, 20, 0.1);
          border-color: rgba(229, 9, 20, 0.22);
        }
        .pick__dot {
          width: 10px;
          height: 10px;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.25);
        }
        .pick--on .pick__dot {
          background: var(--accent);
          box-shadow: 0 0 0 6px rgba(229, 9, 20, 0.12);
        }
        .pick__txt {
          font-size: 13px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.88);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pick__state {
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.55);
        }
        .pick--on .pick__state {
          color: rgba(255, 255, 255, 0.8);
        }
        .pickEmpty {
          padding: 14px 10px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 10px 0;
        }

        .iconBtn {
          width: 42px;
          height: 42px;
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
        .iconBtn:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }
        .iconBtn svg {
          width: 18px;
          height: 18px;
          opacity: 0.9;
        }
        .iconBtn.mOnly {
          display: none;
        }

        .mSearch {
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
        .mSearch__panel {
          width: min(860px, 100%);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(10, 10, 14, 0.94);
          box-shadow: 0 50px 140px rgba(0, 0, 0, 0.75);
          overflow: hidden;
        }
        .mSearch__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .mSearch__title {
          font-weight: 900;
          letter-spacing: -0.01em;
        }
        .mSearch__body {
          padding: 12px;
        }
        .mSearch .filterPopover {
          position: static;
          margin-top: 10px;
        }


        
        
        .movieDetail {
          width: 100%;
          max-width: 1280px;
          margin: 14px auto 0;
        }



        
        .movieDetail__top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }


        
        
        .movieDetail__playerShell {
          position: relative;
          width: min(100%, 1280px);
          margin: 0 auto;
          aspect-ratio: 16 / 9;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.045);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.45);
          overflow: hidden;
        }



        
        
        
        .movieDetail__player {
          width: 100%;
          height: 100%;
          display: block;
          background: #000;
          object-fit: contain;
        }




        
        
        
        .movieDetail__fallback {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(0, 0, 0, 0.55);
          color: rgba(255, 255, 255, 0.72);
          text-align: center;
          font-weight: 850;
        }


        
        
        .movieDetail__titleBlock {
          width: min(100%, 1280px);
          margin: 16px auto 0;
          display: grid;
          gap: 10px;
        }



        
        
        .movieDetail__title {
          margin: 0;
          min-width: 0;
          color: rgba(255, 255, 255, 0.96);
          font-size: clamp(34px, 4.2vw, 62px);
          font-weight: 950;
          line-height: 0.96;
          letter-spacing: -0.05em;
        }




        .movieDetail__titleRow {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .movieDetail__titleIcon {
          width: 58px;
          height: 58px;
          flex: 0 0 58px;
          display: block;
          object-fit: contain;
          filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.55));
        }

        

        
                .movieDetail__year {
          color: rgba(255, 255, 255, 0.78);
          font-size: inherit;
          font-weight: 850;
          font-variant-numeric: tabular-nums;
          line-height: inherit;
        }


        .movieDetail__infoLine {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          color: rgba(255, 255, 255, 0.78);
          font-size: 18px;
          font-weight: 800;
          line-height: 1.35;
        }

        .movieDetail__studio {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 900;
        }

        .movieDetail__dot {
          color: rgba(255, 255, 255, 0.42);
          font-weight: 900;
        }

        .movieDetail__tags {
          color: rgba(255, 255, 255, 0.72);
          font-weight: 750;
        }


        .movieDetail__meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        
        
        .movieDetail__cast {
          width: min(100%, 1280px);
          margin: 18px auto 0;
        }



        

        
        
        .movieCastGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 14px;
        }



        
        .movieCastCard {
          min-width: 0;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 14px 38px rgba(0, 0, 0, 0.28);
        }


        .movieCastCard__img {
          width: 100%;
          aspect-ratio: 3 / 4;
          background: rgba(0, 0, 0, 0.32);
          overflow: hidden;
        }

        .movieCastCard__img img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .movieCastCard__placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        
        
        .movieCastCard__body {
          padding: 10px 10px 11px;
        }



        
        
        .movieCastCard__name {
          color: rgba(255, 255, 255, 0.92);
          font-size: 14px;
          font-weight: 850;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: center;
        }



        

        @media (max-width: 1200px) {
          .movieCastGrid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .movieCastGrid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .movieDetail {
            margin-top: 14px;
          }

          .movieDetail__top {
            margin-bottom: 12px;
          }

          .movieDetail__playerShell {
            border-radius: 18px;
          }

          .movieDetail__title {
            font-size: 32px;
          }

          .movieDetail__titleBlock {
            width: 100%;
            margin-top: 12px;
          }

          .movieDetail__titleRow {
            gap: 10px;
          }

          .movieDetail__titleIcon {
            width: 44px;
            height: 44px;
            flex-basis: 44px;
          }

          .movieDetail__subRow {
            align-items: flex-start;
          }

          .movieDetail__year {
            font-size: 16px;
          }


          .movieCastGrid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }

          .movieCastCard__body {
            padding: 8px;
          }

          .movieCastCard__name {
            font-size: 12px;
          }
        }

        @media (max-width: 420px) {
          .movieCastGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .actorHero {
          margin: 22px 0 18px;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 20px;
          align-items: stretch;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: linear-gradient(
              135deg,
              rgba(229, 9, 20, 0.18),
              rgba(255, 255, 255, 0.05) 45%,
              rgba(0, 0, 0, 0.2)
            ),
            rgba(255, 255, 255, 0.05);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42);
          padding: 16px;
          overflow: hidden;
        }

        .actorHero__media {
          width: 100%;
          aspect-ratio: 3 / 4;
          border-radius: 18px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.32);
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.42);
        }

        .actorHero__media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .actorHero__placeholder {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 900;
          letter-spacing: 0.04em;
        }

        .actorHero__content {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(250px, 0.34fr) minmax(0, 1.66fr);
          gap: 18px;
          align-items: center;
          padding: 8px 4px;
        }

        .actorHero__main {
          min-width: 0;
        }

        .actorHero__eyebrow {
          color: rgba(255, 255, 255, 0.54);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .actorHero__name {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.96);
          font-size: 58px;
          font-weight: 950;
          line-height: 0.98;
          letter-spacing: -0.05em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: clip;
          max-width: 100%;
        }


        .actorHero__count {
          margin-top: 10px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 13px;
          font-weight: 800;
        }

        .actorHero__meta {
          margin-top: 22px;
          display: grid;
          gap: 9px;
          max-width: 360px;
        }

        .actorHero__metaItem {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: 14px;
          align-items: center;
          padding: 0;
          border: none;
          background: transparent;
        }

        .actorHero__metaItem > span {
          display: block;
          color: rgba(255, 255, 255, 0.5);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .actorHero__metaValue {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: rgba(255, 255, 255, 0.92);
          font-size: 15px;
          line-height: 1.25;
        }

        .actorHero__flag {
          width: 24px;
          height: 18px;
          flex: 0 0 24px;
          display: block;
          object-fit: cover;
          border-radius: 4px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
        }

        .actorHero__links {
          margin-top: 18px;
          display: flex;
          gap: 2px;
          flex-wrap: wrap;
        }

        .actorHero__link {
          appearance: none;
          width: 54px;
          height: 54px;
          display: inline-grid;
          place-items: center;
          border: none;
          background: transparent;
          border-radius: 16px;
          padding: 0;
          margin: 0;
          cursor: pointer;
          transition: transform 0.12s ease, filter 0.12s ease;
        }

        .actorHero__link:hover {
          transform: translateY(-2px) scale(1.03);
          filter: brightness(1.08);
        }

        .actorHero__linkIcon {
          width: 54px;
          height: 54px;
          object-fit: contain;
          display: block;
          pointer-events: none;
        }

        .actorHero__stats {
          width: 100%;
          min-width: 0;
          align-self: center;
          justify-self: stretch;
          overflow-x: auto;
          scrollbar-width: thin;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(0, 0, 0, 0.2);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
          padding: 18px;
        }

        .actorHero__statsToggle {
          width: 100%;
          margin: 0 0 12px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.58);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-align: left;
          cursor: default;
        }

        .actorHero__statsToggleIcon {
          display: none;
        }

        .actorHero__statsGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(132px, 1fr));
          gap: 10px;
        }

        .actorHero__statsBlock {
          min-width: 0;
          display: grid;
          align-content: start;
          gap: 9px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.07);
          padding: 12px;
        }

        .actorHero__statsLabel {
          color: rgba(255, 255, 255, 0.48);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .actorHero__rankList,
        .actorHero__qualityList {
          display: grid;
          gap: 8px;
        }

        .actorHero__rankLine {
          min-width: 0;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          gap: 10px;
          align-items: center;
        }

        .actorHero__rankNo {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(229, 9, 20, 0.16);
          color: rgba(255, 255, 255, 0.78);
          font-size: 11px;
          font-weight: 950;
        }

        .actorHero__rankLine strong {
          min-width: 0;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          font-weight: 850;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .actorHero__rankLine em {
          color: rgba(255, 255, 255, 0.52);
          font-size: 12px;
          font-style: normal;
          font-weight: 850;
          font-variant-numeric: tabular-nums;
        }

        .actorHero__qualityLine {
          display: grid;
          gap: 6px;
        }

        .actorHero__qualityTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          color: rgba(255, 255, 255, 0.86);
          font-size: 13px;
          font-weight: 850;
        }

        .actorHero__qualityTop strong {
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }

        .actorHero__qualityBar {
          height: 6px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }

        .actorHero__qualityBar div {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg,
            rgba(229, 9, 20, 0.65),
            rgba(255, 255, 255, 0.5)
          );
        }

        .actorHero__emptyStat {
          color: rgba(255, 255, 255, 0.52);
          font-size: 13px;
          font-weight: 850;
        }

        @media (max-width: 1200px) {
          .row {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .actorHero__content {
            grid-template-columns: minmax(240px, 0.38fr) minmax(0, 1.62fr);
            gap: 16px;
          }
        }
        @media (max-width: 1050px) {
          .actorHero {
            grid-template-columns: 180px minmax(0, 1fr);
          }

          .actorHero__content {
            grid-template-columns: 1fr;
            gap: 16px;
            align-items: start;
          }
        }

        @media (max-width: 900px) {
          .row {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        @media (max-width: 700px) {

          .actorHero__content {
            align-items: center;
            text-align: center;
          }

          .actorHero__name {
            text-align: center;
            margin-left: auto;
            margin-right: auto;
          }

          .actorHero__count {
            text-align: center;
          }

          .actorHero__info {
            align-items: center;
            text-align: center;
          }

          .actorHero__meta {
            justify-content: center;
            text-align: center;
          }

          .actorHero__metaItem {
            text-align: center;
          }

          .actorHero__links {
            justify-content: center;
          }

          .actorHero__statsToggle {
            justify-content: center;
            text-align: center;
          }

          .row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .movieGrid {
            grid-template-columns: 1fr;
          }

          .actorHero {
            grid-template-columns: 1fr;
            gap: 14px;
            padding: 12px;
          }

          .actorHero__media {
            width: min(240px, 72vw);
            justify-self: center;
          }

          .actorHero__content {
            grid-template-columns: 1fr;
            gap: 14px;
            align-items: start;
            padding: 4px 0;
          }

          .actorHero__main {
            width: 100%;
          }

          .actorHero__stats {
            padding: 12px;
            border-radius: 16px;
            overflow-x: hidden;
          }

          .actorHero__statsToggle {
            min-height: 38px;
            margin-bottom: 0;
            padding: 0 2px;
            cursor: pointer;
          }

          .actorHero__statsToggleIcon {
            width: 30px;
            height: 30px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.05);
            color: rgba(255, 255, 255, 0.86);
            font-size: 18px;
            font-weight: 900;
            line-height: 1;
            letter-spacing: 0;
          }

          .actorHero__statsGrid {
            display: none;
            grid-template-columns: 1fr;
            gap: 10px;
            margin-top: 12px;
          }

          .actorHero__statsGrid--open {
            display: grid;
          }

          .actorHero__statsBlock {
            padding: 10px;
          }

          .actorHero__rankLine {
            grid-template-columns: 22px minmax(0, 1fr) auto;
            gap: 8px;
          }
          .actorHero__name {
            font-size: 34px;
            letter-spacing: -0.045em;
          }


          .actorHero__meta {
            margin-top: 14px;
            gap: 8px;
            max-width: none;
          }

          .actorHero__metaItem {
            grid-template-columns: 82px minmax(0, 1fr);
            gap: 10px;
          }

          .topbar {
            grid-template-columns: 1fr auto;
          }
          .topbar__mid {
            display: none;
          }
          .iconBtn.mOnly {
            display: inline-grid;
          }

        }
        @media (max-width: 420px) {
          .row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }


        @media (max-width: 700px) {

        }
        .actorSortSelect {
          min-width: 190px;
          height: 40px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.88);
          padding: 0 30px 0 8px;
          outline: none;
          font-size: 13px;
          font-weight: 750;
          cursor: pointer;
        }

        .actorSortSelect:focus {
          background: transparent;
          border: none;
          outline: none;
        }


        .actorSortSelect option {
          background: var(--menuBg);
          color: rgba(255, 255, 255, 0.92);
        }

        @media (max-width: 700px) {
          .actorSortSelect {
            width: 100%;
            min-width: 0;
          }
        }

        .logoBtn {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
        }
      `}</style>

      <div className="topbar">
        <div className="topbar__left" />

        <div className="topbar__mid">
          {loggedIn ? (
            <div className="searchWrap" ref={searchWrapRef}>
              <div
                className="input"
                title="Suche nach Titel, Studio, Darsteller, Tags"
              >
                <svg
                  className="input__icon"
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
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => {
                    setFiltersOpen(true);
                    setUserMenuOpen(false);
                  }}
                  placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                  autoComplete="off"
                />
              </div>

              {filtersOpen && (
                <div
                  className="filterPopover"
                  role="dialog"
                  aria-modal="false"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div className="filterPopover__head">
                    <div className="filterPopover__title">Filter</div>
                    <div className="filterPopover__actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={resetFilters}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={applyFiltersNow}
                      >
                        Anwenden
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setFiltersOpen(false)}
                      >
                        Schließen
                      </button>
                    </div>
                  </div>

                  <div className="filterPopover__body">
                    <div className="filterGrid">
                      <div style={{ display: "grid", gap: 12 }}>
                        <FilterSection
                          title="Tags"
                          subtitle=""
                          items={tagItems}
                          selectedKeys={selectedTags}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleTag(String(k))}
                          search={tagSearch}
                          setSearch={setTagSearch}
                          showSelectedOnly={tagsSelectedOnly}
                          setShowSelectedOnly={setTagsSelectedOnly}
                          defaultOpen={true}
                        />
                        <FilterSection
                          title="Hauptdarsteller"
                          subtitle=""
                          items={mainItems}
                          selectedKeys={selectedMainActors}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleMainActor(String(k))}
                          search={mainActorSearch}
                          setSearch={setMainActorSearch}
                          showSelectedOnly={mainSelectedOnly}
                          setShowSelectedOnly={setMainSelectedOnly}
                          defaultOpen={false}
                        />
                        <FilterSection
                          title="Nebendarsteller"
                          subtitle=""
                          items={suppItems}
                          selectedKeys={selectedSupportingActors}
                          getKey={(it) => it.key}
                          getLabel={(it) => it.label}
                          onToggle={(k) => toggleSupportingActor(String(k))}
                          search={suppActorSearch}
                          setSearch={setSuppActorSearch}
                          showSelectedOnly={suppSelectedOnly}
                          setShowSelectedOnly={setSuppSelectedOnly}
                          defaultOpen={false}
                        />
                      </div>

                      <div style={{ display: "grid", gap: 12 }}>
                        <div className="fsec">
                          <div
                            className="fsec__head"
                            style={{ cursor: "default" }}
                          >
                            <div className="fsec__headL">
                              <div className="fsec__title">Basis</div>
                              <div className="fsec__sub">
                                Studio, Resolution & Jahr
                              </div>
                            </div>
                            <div className="fsec__headR">
                              <span
                                className="fsec__chev"
                                style={{ opacity: 0.35 }}
                              >
                                ✓
                              </span>
                            </div>
                          </div>

                          <div className="fsec__body">
                            <div>
                              <div className="fieldLabel">Studio</div>
                              <select
                                className="select"
                                value={selectedStudio}
                                onChange={(e) =>
                                  setSelectedStudio(e.target.value)
                                }
                              >
                                <option value="">Alle Studios</option>
                                {allStudios.map((s) => (
                                  <option key={`st-${s}`} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="fieldLabel">Resolution</div>
                              <select
                                className="select"
                                value={selectedResolution}
                                onChange={(e) =>
                                  setSelectedResolution(e.target.value)
                                }
                              >
                                <option value="">Alle Resolutions</option>
                                {allResolutions.map((r) => (
                                  <option key={`rs-${r}`} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="fieldLabel">Jahr</div>
                              <div className="yearRow">
                                <input
                                  className="select"
                                  value={yearFrom}
                                  onChange={(e) => setYearFrom(e.target.value)}
                                  placeholder="von (z.B. 1999)"
                                  inputMode="numeric"
                                />
                                <input
                                  className="select"
                                  value={yearTo}
                                  onChange={(e) => setYearTo(e.target.value)}
                                  placeholder="bis (z.B. 2025)"
                                  inputMode="numeric"
                                />
                              </div>
                            </div>

                            {hasAnyFilter ? (
                              <>
                                <div className="divider" />
                                <div style={{ display: "grid", gap: 8 }}>
                                  <div className="fieldLabel">Aktiv</div>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    {selectedStudio ? <Pill>Studio</Pill> : null}
                                    {selectedResolution ? (
                                      <Pill>{selectedResolution}</Pill>
                                    ) : null}
                                    {yearFrom ? (
                                      <Pill>ab {yearFrom}</Pill>
                                    ) : null}
                                    {yearTo ? <Pill>bis {yearTo}</Pill> : null}
                                    {selectedTags.length ? (
                                      <Pill>{selectedTags.length} Tags</Pill>
                                    ) : null}
                                    {selectedMainActors.length ? (
                                      <Pill>
                                        {selectedMainActors.length} Haupt
                                      </Pill>
                                    ) : null}
                                    {selectedSupportingActors.length ? (
                                      <Pill>
                                        {selectedSupportingActors.length} Neben
                                      </Pill>
                                    ) : null}
                                  </div>
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="topbar__right">
          {loggedIn ? (
            <>
              <button
                type="button"
                className="iconBtn mOnly"
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

              <div className="userMenu" ref={userMenuRef}>
                <div className="auth__label">Willkommen, {loginUser}</div>

                <button
                  type="button"
                  className="userMenu__btn"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen ? "true" : "false"}
                  title="Menü"
                  onClick={() => {
                    setUserMenuOpen((v) => !v);
                    setFiltersOpen(false);
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
                  <div className="userMenu__panel" role="menu">
                    <button
                      type="button"
                      className="userMenu__item"
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        safeOpen("/dashboard");
                      }}
                      title="Zum Dashboard"
                    >
                      Dashboard
                    </button>
                    <div style={{ height: 8 }} />
                    <button
                      type="button"
                      className="userMenu__item userMenu__item--danger"
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
            <form className="authForm" onSubmit={handleLogin}>
              <div className="authField">
                <input
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  placeholder="User"
                  autoComplete="username"
                />
              </div>
              <div className="authField">
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
                className="btn btn--primary"
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
          className="mSearch"
          role="dialog"
          aria-modal="true"
          onMouseDown={closeMobileSearch}
          onTouchStart={closeMobileSearch}
        >
          <div
            className="mSearch__panel"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="mSearch__head">
              <div className="mSearch__title">Suche</div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closeMobileSearch}
              >
                Schließen
              </button>
            </div>

            <div className="mSearch__body">
              <div className="searchWrap">
                <div
                  className="input"
                  title="Suche nach Titel, Studio, Darsteller, Tags"
                >
                  <svg
                    className="input__icon"
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
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      setFiltersOpen(true);
                      setUserMenuOpen(false);
                    }}
                    placeholder="Suchen: Titel, Studio, Darsteller, Tags…"
                    autoComplete="off"
                  />
                </div>

                {filtersOpen && (
                  <div
                    className="filterPopover"
                    role="dialog"
                    aria-modal="false"
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <div className="filterPopover__head">
                      <div className="filterPopover__title">Filter</div>
                      <div className="filterPopover__actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={resetFilters}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={applyFiltersNow}
                        >
                          Anwenden
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => setFiltersOpen(false)}
                        >
                          Schließen
                        </button>
                      </div>
                    </div>

                    <div className="filterPopover__body">
                      <div className="filterGrid">
                        <div style={{ display: "grid", gap: 12 }}>
                          <FilterSection
                            title="Tags"
                            subtitle=""
                            items={tagItems}
                            selectedKeys={selectedTags}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleTag(String(k))}
                            search={tagSearch}
                            setSearch={setTagSearch}
                            showSelectedOnly={tagsSelectedOnly}
                            setShowSelectedOnly={setTagsSelectedOnly}
                            defaultOpen={true}
                          />
                          <FilterSection
                            title="Hauptdarsteller"
                            subtitle=""
                            items={mainItems}
                            selectedKeys={selectedMainActors}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleMainActor(String(k))}
                            search={mainActorSearch}
                            setSearch={setMainActorSearch}
                            showSelectedOnly={mainSelectedOnly}
                            setShowSelectedOnly={setMainSelectedOnly}
                            defaultOpen={false}
                          />
                          <FilterSection
                            title="Nebendarsteller"
                            subtitle=""
                            items={suppItems}
                            selectedKeys={selectedSupportingActors}
                            getKey={(it) => it.key}
                            getLabel={(it) => it.label}
                            onToggle={(k) => toggleSupportingActor(String(k))}
                            search={suppActorSearch}
                            setSearch={setSuppActorSearch}
                            showSelectedOnly={suppSelectedOnly}
                            setShowSelectedOnly={setSuppSelectedOnly}
                            defaultOpen={false}
                          />
                        </div>

                        <div style={{ display: "grid", gap: 12 }}>
                          <div className="fsec">
                            <div
                              className="fsec__head"
                              style={{ cursor: "default" }}
                            >
                              <div className="fsec__headL">
                                <div className="fsec__title">Basis</div>
                                <div className="fsec__sub">
                                  Studio, Resolution & Jahr
                                </div>
                              </div>
                              <div className="fsec__headR">
                                <span
                                  className="fsec__chev"
                                  style={{ opacity: 0.35 }}
                                >
                                  ✓
                                </span>
                              </div>
                            </div>

                            <div className="fsec__body">
                              <div>
                                <div className="fieldLabel">Studio</div>
                                <select
                                  className="select"
                                  value={selectedStudio}
                                  onChange={(e) =>
                                    setSelectedStudio(e.target.value)
                                  }
                                >
                                  <option value="">Alle Studios</option>
                                  {allStudios.map((s) => (
                                    <option key={`st-${s}`} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="fieldLabel">Resolution</div>
                                <select
                                  className="select"
                                  value={selectedResolution}
                                  onChange={(e) =>
                                    setSelectedResolution(e.target.value)
                                  }
                                >
                                  <option value="">Alle Resolutions</option>
                                  {allResolutions.map((r) => (
                                    <option key={`rs-${r}`} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <div className="fieldLabel">Jahr</div>
                                <div className="yearRow">
                                  <input
                                    className="select"
                                    value={yearFrom}
                                    onChange={(e) =>
                                      setYearFrom(e.target.value)
                                    }
                                    placeholder="von (z.B. 1999)"
                                    inputMode="numeric"
                                  />
                                  <input
                                    className="select"
                                    value={yearTo}
                                    onChange={(e) => setYearTo(e.target.value)}
                                    placeholder="bis (z.B. 2025)"
                                    inputMode="numeric"
                                  />
                                </div>
                              </div>

                              {hasAnyFilter ? (
                                <>
                                  <div className="divider" />
                                  <div style={{ display: "grid", gap: 8 }}>
                                    <div className="fieldLabel">Aktiv</div>
                                    <div
                                      style={{
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      {selectedStudio ? (
                                        <Pill>Studio</Pill>
                                      ) : null}
                                      {selectedResolution ? (
                                        <Pill>{selectedResolution}</Pill>
                                      ) : null}
                                      {yearFrom ? (
                                        <Pill>ab {yearFrom}</Pill>
                                      ) : null}
                                      {yearTo ? (
                                        <Pill>bis {yearTo}</Pill>
                                      ) : null}
                                      {selectedTags.length ? (
                                        <Pill>{selectedTags.length} Tags</Pill>
                                      ) : null}
                                      {selectedMainActors.length ? (
                                        <Pill>
                                          {selectedMainActors.length} Haupt
                                        </Pill>
                                      ) : null}
                                      {selectedSupportingActors.length ? (
                                        <Pill>
                                          {selectedSupportingActors.length} Neben
                                        </Pill>
                                      ) : null}
                                    </div>
                                  </div>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="wrap">
        <div className="logoSolo">
          <button
            type="button"
            className="logoBtn"
            onClick={() => {
              router.replace("/", { scroll: false });
              setViewMode("actors");
              setSelectedActor(null);
              setSelectedMovieId(null);
              setVisibleMovies([]);
              setSearch("");
            }}
            title="Zur Hauptseite"
            aria-label="Zur Hauptseite"
          >
            <img className="logoSolo__img" src="/logo.png" alt="Project1337 Logo" />
          </button>
        </div>

        {loginErr ? <div className="errorBanner">{loginErr}</div> : null}
        {err ? <div className="errorBanner">{err}</div> : null}

        {!loggedIn ? (
          <EmptyState
            title="Bitte einloggen"
            subtitle="Ohne Login werden keine Inhalte geladen. Logge dich oben rechts ein, um Darsteller und Filme zu sehen."
            action={<Pill>Project1337 • Private Library</Pill>}
          />
        ) : loading ? (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">Lade Inhalte…</div>
                <div className="sectionMeta">
                  Supabase-Abfragen werden ausgeführt.
                </div>
              </div>
              <Pill>Bitte warten</Pill>
            </div>
            <SkeletonRow />
            <div style={{ height: 16 }} />
            <SkeletonRow />
          </>
        ) : selectedMovieId ? (
          selectedMovie ? (
            <MovieDetailView movie={selectedMovie} onBack={handleCloseMovie} />
          ) : (
            <EmptyState
              title="Film nicht gefunden"
              subtitle="Der Film konnte nicht geladen werden oder existiert nicht mehr."
              action={
                <button type="button" className="btn" onClick={handleCloseMovie}>
                  Zurück
                </button>
              }
            />
          )
        ) : showMovies ? (
          <>
            {selectedActor ? (
              <ActorHero actor={selectedActor} movieCount={movieList.length} movies={movieList} />
            ) : null}

            <div className="sectionHead">
              {selectedActor ? (
                <>
                  <div />
                  <SortControl />
                </>
              ) : (
                <>
                  <div>
                    <div className="sectionTitle">{moviesTitle}</div>
                    <div className="sectionMeta">
                      {moviesSubtitle || `${movieList.length} Film(e)`}
                    </div>
                  </div>
                  <ViewToggle />
                </>
              )}
            </div>

            {movieList.length === 0 ? (
              <EmptyState
                title="Keine Filme gefunden"
                subtitle="Passe Suche/Filter an oder gehe zurück zur Darsteller-Ansicht."
              />
            ) : (
              <div className="movieGrid">
                {movieList.map((m) => {
                  const icon = getResolutionIcon(m.resolution);
                  return (
                    <div
                      key={m.id}
                      className="movieCard movieCard--clickable"
                      onClick={() => handleOpenMovie(m)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenMovie(m);
                        }
                      }}
                    >
                      {m.thumbnailUrl ? (
                        <div className="movieCard__thumb">
                          <img
                            src={m.thumbnailUrl}
                            alt={m.title || "Thumbnail"}
                            loading="lazy"
                          />

                          {icon ? (
                            <div
                              className="movieCard__resIcon"
                              title={icon.title}
                              aria-label={icon.title}
                            >
                              <img src={icon.src} alt={icon.alt} />
                            </div>
                          ) : null}
                        </div>
                      ) : icon ? (
                        <div
                          className="movieCard__resIcon movieCard__resIcon--noThumb"
                          title={icon.title}
                          aria-label={icon.title}
                        >
                          <img src={icon.src} alt={icon.alt} />
                        </div>
                      ) : null}

                      <div className="movieCard__top">
                        <div
                          className="movieCard__title"
                          title={m.title || "Unbenannt"}
                        >
                          {m.title || "Unbenannt"}
                        </div>
                        <div className="movieCard__year">{m.year || ""}</div>
                      </div>

                      <div className="movieCard__meta">
                        <div className="kv">
                          <div className="kv__k">Studio</div>
                          <div className="kv__v">{m.studio || "-"}</div>
                        </div>

                        <div className="kv">
                          <div className="kv__k">Darsteller</div>
                          <div className="kv__v">
                            {m.actors && m.actors.length
                              ? m.actors.join(", ")
                              : "-"}
                          </div>
                        </div>

                        <div className="kv">
                          <div className="kv__k">Tags</div>
                          <div className={`kv__v movieCard__tags`}>
                            {m.tags && m.tags.length
                              ? [...m.tags]
                                  .sort((a, b) =>
                                    a.localeCompare(b, "de", {
                                      sensitivity: "base",
                                    })
                                  )
                                  .join(", ")
                              : "-"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="sectionHead">
              <div>
                <div className="sectionTitle">Hauptdarsteller</div>
                <div className="sectionMeta">{actors.length} Darsteller</div>
              </div>
              <ViewToggle />
            </div>

            {actors.length === 0 ? (
              <EmptyState
                title="Keine Hauptdarsteller verfügbar"
                subtitle="Entweder sind noch keine Filme mit main_actor_ids hinterlegt oder es fehlen Datensätze."
              />
            ) : (
              <div className="row">
                {actors.map((a) => (
                  <div
                    key={a.id}
                    className="card"
                    onClick={() =>
                      handleShowMoviesForActor(a.id, a.name, a.slug)
                    }
                    title={`${a.name} öffnen`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        handleShowMoviesForActor(a.id, a.name, a.slug);
                    }}
                  >
                    <div className="card__img">
                      {a.profileImage ? (
                        <img src={a.profileImage} alt={a.name} />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: "rgba(255,255,255,0.55)",
                            fontWeight: 800,
                            letterSpacing: "0.02em",
                          }}
                        >
                          NO IMAGE
                        </div>
                      )}

                      <div className="card__badge">{a.movieCount}</div>
                    </div>

                    <div className="card__body">
                      <AutoFitActorTitle text={a.name} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
