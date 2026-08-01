"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./experience.module.css";

function Icon({ name, className = "" }) {
  const paths = {
    arrow: <path d="m9 18 6-6-6-6" />,
    back: <path d="m15 18-6-6 6-6" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    play: <path d="m9 7 9 5-9 5V7Z" />,
    pause: (
      <>
        <path d="M9 7v10" />
        <path d="M15 7v10" />
      </>
    ),
    volume: (
      <>
        <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
        <path d="M15 9.5c.8.7 1.2 1.5 1.2 2.5s-.4 1.8-1.2 2.5" />
        <path d="M17.5 7c1.5 1.4 2.3 3 2.3 5s-.8 3.6-2.3 5" />
      </>
    ),
    muted: (
      <>
        <path d="M5 10v4h3l4 3V7l-4 3H5Z" />
        <path d="m16 10 4 4M20 10l-4 4" />
      </>
    ),
    fullscreen: (
      <>
        <path d="M9 4H4v5M15 4h5v5M20 15v5h-5M4 15v5h5" />
      </>
    ),
    fullscreenExit: (
      <>
        <path d="M4 9h5V4M20 9h-5V4M15 20v-5h5M9 20v-5H4" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    spark: <path d="M12 3l1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Zm6 13 .6 2.4L21 19l-2.4.6L18 22l-.6-2.4L15 19l2.4-.6L18 16Z" />,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3Z" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21c.7-4.3 3-6.5 7-6.5s6.3 2.2 7 6.5" />
      </>
    ),
  };

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MediaImage({ src, alt, priority = false, sizes = "100vw" }) {
  if (!src) {
    return (
      <div className={styles.mediaFallback} aria-hidden="true">
        <span>1337</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      unoptimized
    />
  );
}

function formatDate(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE").format(Math.max(0, Number(value) || 0));
}

function formatRating(value) {
  return Number(value).toFixed(1).replace(".", ",");
}

function getAge(value) {
  if (!value) return null;
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function getVideoMimeType(url) {
  const clean = String(url || "").split("?")[0].toLowerCase();
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function formatMediaTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ModernVideoPlayer({ src, poster, title, quality, onPlay }) {
  const frameRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const clearHideControlsTimer = () => {
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  };

  const queueControlsHide = () => {
    clearHideControlsTimer();
    hideControlsTimerRef.current = window.setTimeout(() => setShowControls(false), 2800);
  };

  const revealControls = () => {
    setShowControls(true);
    if (videoRef.current && !videoRef.current.paused) queueControlsHide();
  };

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      clearHideControlsTimer();
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const seekTo = (value) => {
    const video = videoRef.current;
    if (!video) return;
    const nextTime = Math.min(Math.max(Number(value) || 0, 0), duration || 0);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const changeVolume = (value) => {
    const video = videoRef.current;
    if (!video) return;
    const nextVolume = Math.min(Math.max(Number(value) || 0, 0), 1);
    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = 0.7;
      video.muted = false;
    } else {
      video.muted = true;
    }
  };

  const toggleFullscreen = () => {
    const frame = frameRef.current;
    const video = videoRef.current;
    if (!frame || !video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }

    if (frame.requestFullscreen) {
      frame.requestFullscreen();
    } else if (frame.webkitRequestFullscreen) {
      frame.webkitRequestFullscreen();
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  };

  const handleKeyDown = (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;

    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekTo(currentTime - 10);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(currentTime + 10);
    } else if (event.key.toLowerCase() === "m") {
      toggleMute();
    } else if (event.key.toLowerCase() === "f") {
      toggleFullscreen();
    }
  };

  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0;
  const audibleVolume = muted ? 0 : volume;

  return (
    <div
      ref={frameRef}
      className={`${styles.videoFrame}${showControls || !playing ? ` ${styles.videoFrameActive}` : ""}`}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onMouseLeave={() => {
        if (playing) setShowControls(false);
      }}
      onFocusCapture={revealControls}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={`Videoplayer: ${title || "Film"}`}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={poster || undefined}
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0);
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          setShowControls(true);
          queueControlsHide();
          onPlay?.();
        }}
        onPause={() => {
          clearHideControlsTimer();
          setPlaying(false);
          setShowControls(true);
        }}
        onEnded={() => {
          clearHideControlsTimer();
          setPlaying(false);
          setShowControls(true);
        }}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
      >
        <source src={src} type={getVideoMimeType(src)} />
        Dein Browser unterstützt dieses Videoformat nicht.
      </video>

      <div className={styles.playerTopbar} aria-hidden="true">
        <div>
          <span>Now screening</span>
          <strong>{title || "Unbenannt"}</strong>
        </div>
        <small>{quality || "1337"}</small>
      </div>

      {!playing ? (
        <button type="button" className={styles.playerCenterButton} onClick={togglePlay} aria-label="Video abspielen">
          <span><Icon name="play" /></span>
          <small>Film starten</small>
        </button>
      ) : null}

      <div className={styles.playerChrome}>
        <input
          className={`${styles.playerRange} ${styles.playerProgress}`}
          type="range"
          min="0"
          max={Math.max(duration, 0.01)}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seekTo(event.target.value)}
          style={{ "--player-progress": `${progress}%` }}
          aria-label="Wiedergabeposition"
        />
        <div className={styles.playerControlBar}>
          <button type="button" onClick={togglePlay} aria-label={playing ? "Video pausieren" : "Video abspielen"}>
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <span className={styles.playerTime}>{formatMediaTime(currentTime)} <i>/</i> {formatMediaTime(duration)}</span>
          <div className={styles.playerControlSpacer} />
          <div className={styles.playerVolume}>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Ton einschalten" : "Ton ausschalten"}>
              <Icon name={muted || volume === 0 ? "muted" : "volume"} />
            </button>
            <input
              className={`${styles.playerRange} ${styles.playerVolumeRange}`}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={audibleVolume}
              onChange={(event) => changeVolume(event.target.value)}
              style={{ "--player-volume": `${audibleVolume * 100}%` }}
              aria-label="Lautstärke"
            />
          </div>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Vollbild verlassen" : "Vollbild öffnen"}>
            <Icon name={fullscreen ? "fullscreenExit" : "fullscreen"} />
          </button>
        </div>
      </div>
    </div>
  );
}

function qualityTone(quality) {
  const value = String(quality || "").toLowerCase();
  if (value.includes("4k")) return styles.qualityUltra;
  if (value.includes("full")) return styles.qualityFull;
  if (value.includes("retro")) return styles.qualityRetro;
  return "";
}

function pickRandomMovies(movies, limit) {
  const pool = movies.filter(
    (movie) => !String(movie.resolution || "").toLowerCase().includes("retro")
  );

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
  }

  return pool.slice(0, limit);
}

function spotlightTitleClass(title) {
  const length = String(title || "").trim().length;

  if (length > 80) return styles.spotlightTitleExtreme;
  if (length > 52) return styles.spotlightTitleVeryLong;
  if (length > 32) return styles.spotlightTitleLong;
  return "";
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
  "Anal Creampie",
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
  return HAIR_COLOR_TAGS.includes(normalizeStatValue(tag));
}

function isFinishTag(tag) {
  return FINISH_TAGS.includes(normalizeStatValue(tag));
}

function countStatValues(values) {
  const counts = new Map();

  values
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) =>
      b.count - a.count ||
      a.value.localeCompare(b.value, "de", { sensitivity: "base" })
    );
}

function withStatPercent(items, total) {
  return items.map((item) => ({
    ...item,
    percent: total ? Math.round((item.count / total) * 100) : 0,
  }));
}

function buildActorStats(movies) {
  const list = Array.isArray(movies) ? movies : [];
  const years = list
    .map((movie) => Number.parseInt(movie.year, 10))
    .filter(Number.isFinite);
  const minYear = years.length ? Math.min(...years) : null;
  const maxYear = years.length ? Math.max(...years) : null;
  const yearRange = minYear && maxYear
    ? minYear === maxYear
      ? String(minYear)
      : `${minYear}–${maxYear}`
    : "–";
  const allTags = list.flatMap((movie) =>
    Array.isArray(movie.tags) ? movie.tags : []
  );
  const hairTags = allTags.filter(isHairColorTag);
  const finishTags = allTags.filter(isFinishTag);
  const regularTags = allTags.filter(
    (tag) => !isHairColorTag(tag) && !isFinishTag(tag)
  );
  const resolutions = list.map((movie) => movie.resolution).filter(Boolean);
  const ratings = list
    .map((movie) => Number(movie.rating))
    .filter((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 10);
  const totalViews = list.reduce(
    (sum, movie) => sum + Math.max(0, Number(movie.viewCount) || 0),
    0
  );

  return {
    yearRange,
    averageRating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null,
    ratedMovies: ratings.length,
    totalViews,
    hairColors: withStatPercent(countStatValues(hairTags).slice(0, 5), hairTags.length),
    qualities: withStatPercent(countStatValues(resolutions), resolutions.length),
    studios: countStatValues(list.map((movie) => movie.studio)).slice(0, 5),
    supportingActors: countStatValues(
      list.flatMap((movie) =>
        Array.isArray(movie.supportingActorNames)
          ? movie.supportingActorNames
          : []
      )
    ).slice(0, 5),
    tags: countStatValues(regularTags).slice(0, 5),
    finishes: countStatValues(finishTags).slice(0, 5),
  };
}

function MovieCard({ movie, onOpen, large = false, index }) {
  return (
    <button
      type="button"
      className={`${styles.movieCard} ${large ? styles.movieCardLarge : ""}`}
      onClick={() => onOpen(movie)}
      aria-label={`${movie.title || "Film"} öffnen`}
    >
      <span className={styles.movieVisual}>
        <MediaImage
          src={movie.thumbnailUrl}
          alt={movie.title || "Filmcover"}
          sizes={large ? "(max-width: 760px) 90vw, 48vw" : "(max-width: 760px) 78vw, 24vw"}
        />
        <span className={styles.movieShade} />
        {typeof index === "number" ? (
          <span className={styles.movieIndex}>{String(index + 1).padStart(2, "0")}</span>
        ) : null}
        <span className={`${styles.quality} ${qualityTone(movie.resolution)}`}>
          {movie.resolution || "HD"}
        </span>
        <span className={styles.moviePlay}>
          <Icon name="play" />
        </span>
      </span>
      <span className={styles.movieCopy}>
        <span className={styles.movieTitle}>{movie.title || "Unbenannt"}</span>
        <span className={styles.movieMeta}>
          {movie.studio || "Independent"}
          <i />
          {movie.year || "–"}
        </span>
      </span>
    </button>
  );
}

function ActorCard({ actor, onOpen, feature = false }) {
  return (
    <button
      type="button"
      className={`${styles.actorCard} ${feature ? styles.actorCardFeature : ""}`}
      onClick={() => onOpen(actor.id, actor.name, actor.slug)}
      aria-label={`${actor.name} öffnen`}
    >
      <span className={styles.actorVisual}>
        <MediaImage
          src={actor.profileImage}
          alt={actor.name}
          sizes={feature ? "(max-width: 760px) 90vw, 38vw" : "(max-width: 760px) 45vw, 18vw"}
        />
        <span className={styles.actorShade} />
      </span>
      <span className={styles.actorNumber}>{String(actor.movieCount).padStart(2, "0")}</span>
      <span className={styles.actorCopy}>
        <strong>{actor.name}</strong>
        <small>{actor.origin || "1337 Collection"}</small>
      </span>
      <span className={styles.actorArrow}><Icon name="arrow" /></span>
    </button>
  );
}

function SectionHeading({ index, eyebrow, title, action, onAction }) {
  return (
    <div className={styles.sectionHeading}>
      <div className={styles.sectionHeadingIndex}>{index}</div>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}<Icon name="arrow" />
        </button>
      ) : null}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className={styles.loadingScreen}>
      <div className={styles.loadingMark}>1337</div>
      <div className={styles.loadingLine}><span /></div>
      <p>Private Library wird kuratiert</p>
    </div>
  );
}

function LoginGate({
  loginUser,
  loginPassword,
  loginLoading,
  loginError,
  setLoginUser,
  setLoginPassword,
  onLogin,
}) {
  return (
    <div className={styles.loginGate}>
      <header className={styles.gateHeader}>
        <Image src="/logo.png" alt="Project1337" width={128} height={62} priority />
        <span>Private Preview · 03</span>
      </header>

      <div className={styles.gateStage}>
        <div className={styles.gateArt} aria-hidden="true">
          <div className={styles.gateMonogram}>13<br />37</div>
          <div className={styles.gateRing} />
          <div className={styles.gateGrain} />
          <span className={styles.gateEdition}>KH7 / CURATED ARCHIVE</span>
        </div>

        <section className={styles.gatePanel}>
          <div className={styles.gateKicker}><i /> Members only</div>
          <h1>Enter your<br /><em>private cinema.</em></h1>
          <p>
            Ein persönliches Filmarchiv, neu gedacht als digitale Screening
            Collection.
          </p>

          <form className={styles.loginForm} onSubmit={onLogin}>
            <label>
              <span>Username</span>
              <input
                value={loginUser}
                onChange={(event) => setLoginUser(event.target.value)}
                autoComplete="username"
                placeholder="Username"
              />
            </label>
            <label>
              <span>Passwort</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
              />
            </label>
            {loginError ? <div className={styles.formError}>{loginError}</div> : null}
            <button type="submit" disabled={loginLoading}>
              <span>{loginLoading ? "Zugang wird geprüft…" : "Library betreten"}</span>
              <Icon name="arrow" />
            </button>
          </form>

          <div className={styles.gateFooter}>
            <span>Private</span><i /><span>Encrypted</span><i /><span>Personal</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function AppHeader({
  viewMode,
  selectedActor,
  selectedMovieId,
  search,
  loginUser,
  onSearch,
  onDiscover,
  onShowActors,
  onShowMovies,
  onDashboard,
  onLogout,
  onOpenFilters,
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  const discoverActive = viewMode === "actors" && !selectedActor && !selectedMovieId;
  const moviesActive = viewMode === "movies" && !selectedActor && !selectedMovieId;
  const actorsActive = viewMode === "actors_all" && !selectedActor && !selectedMovieId;

  return (
    <header className={styles.header}>
      <button type="button" className={styles.brand} onClick={onDiscover} aria-label="Entdecken">
        <Image src="/logo.png" alt="Project1337" width={112} height={52} priority />
        <span>BETA / 03</span>
      </button>

      <nav className={styles.nav} aria-label="Hauptnavigation">
        <button className={discoverActive ? styles.navActive : ""} onClick={onDiscover}>Entdecken</button>
        <button className={moviesActive ? styles.navActive : ""} onClick={onShowMovies}>Filme</button>
        <button className={actorsActive ? styles.navActive : ""} onClick={onShowActors}>Darsteller</button>
      </nav>

      <div className={styles.headerTools}>
        <label className={styles.searchBox}>
          <Icon name="search" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Library durchsuchen"
            aria-label="Library durchsuchen"
          />
        </label>
        <button type="button" className={styles.toolButton} onClick={onOpenFilters} aria-label="Filter öffnen">
          <Icon name="filter" />
        </button>
        <div className={styles.account}>
          <button
            type="button"
            className={styles.accountButton}
            onClick={() => setAccountOpen((value) => !value)}
            aria-expanded={accountOpen}
          >
            <span>{String(loginUser || "KH").slice(0, 2).toUpperCase()}</span>
          </button>
          {accountOpen ? (
            <div className={styles.accountMenu}>
              <strong>{loginUser}</strong>
              <button type="button" onClick={onDashboard}>Dashboard</button>
              <button type="button" onClick={onLogout}>Abmelden</button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function FilterDrawer({
  open,
  onClose,
  hasAnyFilter,
  onApply,
  onReset,
  allTags,
  allStudios,
  allResolutions,
  mainActorOptions,
  supportingActorOptions,
  selectedTags,
  selectedStudio,
  selectedResolution,
  yearFrom,
  yearTo,
  selectedMainActors,
  selectedSupportingActors,
  setSelectedStudio,
  setSelectedResolution,
  setYearFrom,
  setYearTo,
  onToggleTag,
  onToggleMainActor,
  onToggleSupportingActor,
}) {
  if (!open) return null;

  return (
    <div className={styles.drawerLayer} role="dialog" aria-modal="true" aria-label="Filmfilter">
      <button type="button" className={styles.drawerBackdrop} onClick={onClose} aria-label="Filter schließen" />
      <aside className={styles.drawer}>
        <div className={styles.drawerHead}>
          <div>
            <span>Archive tools</span>
            <h2>Filter</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen"><Icon name="close" /></button>
        </div>

        <div className={styles.drawerBody}>
          <section className={styles.filterSection}>
            <h3>Basis</h3>
            <div className={styles.filterColumns}>
              <label>
                <span>Studio</span>
                <select value={selectedStudio} onChange={(event) => setSelectedStudio(event.target.value)}>
                  <option value="">Alle Studios</option>
                  {allStudios.map((studio) => <option key={studio} value={studio}>{studio}</option>)}
                </select>
              </label>
              <label>
                <span>Qualität</span>
                <select value={selectedResolution} onChange={(event) => setSelectedResolution(event.target.value)}>
                  <option value="">Alle Qualitäten</option>
                  {allResolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}
                </select>
              </label>
            </div>
            <div className={styles.yearFields}>
              <label><span>Jahr von</span><input inputMode="numeric" value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} placeholder="1990" /></label>
              <label><span>Jahr bis</span><input inputMode="numeric" value={yearTo} onChange={(event) => setYearTo(event.target.value)} placeholder="2026" /></label>
            </div>
          </section>

          <section className={styles.filterSection}>
            <h3>Tags <small>{selectedTags.length || ""}</small></h3>
            <div className={styles.choiceCloud}>
              {allTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={selectedTags.includes(tag) ? styles.choiceActive : ""}
                  onClick={() => onToggleTag(tag)}
                >{tag}</button>
              ))}
            </div>
          </section>

          <section className={styles.filterSection}>
            <h3>Hauptdarsteller <small>{selectedMainActors.length || ""}</small></h3>
            <div className={styles.choiceCloud}>
              {mainActorOptions.map((actor) => {
                const active = selectedMainActors.map(String).includes(String(actor.id));
                return <button type="button" key={actor.id} className={active ? styles.choiceActive : ""} onClick={() => onToggleMainActor(actor.id)}>{actor.name}</button>;
              })}
            </div>
          </section>

          <section className={styles.filterSection}>
            <h3>Nebendarsteller <small>{selectedSupportingActors.length || ""}</small></h3>
            <div className={styles.choiceCloud}>
              {supportingActorOptions.map((actor) => (
                <button
                  type="button"
                  key={actor}
                  className={selectedSupportingActors.includes(actor) ? styles.choiceActive : ""}
                  onClick={() => onToggleSupportingActor(actor)}
                >{actor}</button>
              ))}
            </div>
          </section>
        </div>

        <div className={styles.drawerFoot}>
          <button type="button" className={styles.resetButton} onClick={onReset} disabled={!hasAnyFilter}>Alles löschen</button>
          <button type="button" className={styles.applyButton} onClick={onApply}>Auswahl anwenden <Icon name="arrow" /></button>
        </div>
      </aside>
    </div>
  );
}

function Discovery({ movies, actors, onOpenMovie, onShowMovies, onShowActors, onShowActor }) {
  const sortedMovies = useMemo(
    () => [...movies].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0)),
    [movies]
  );
  const featuredMovies = useMemo(() => pickRandomMovies(movies, 5), [movies]);
  const [activeFeature, setActiveFeature] = useState(0);
  const [previousFeature, setPreviousFeature] = useState(-1);
  const featured = featuredMovies[activeFeature] || featuredMovies[0];
  const recent = sortedMovies.slice(0, 9);
  const topActors = useMemo(
    () => [...actors].sort((a, b) => b.movieCount - a.movieCount).slice(0, 7),
    [actors]
  );
  const studioCount = new Set(movies.map((movie) => movie.studio).filter(Boolean)).size;
  const yearValues = movies.map((movie) => Number(movie.year)).filter(Boolean);
  const yearRange = yearValues.length ? `${Math.min(...yearValues)}—${Math.max(...yearValues)}` : "CURATED";

  useEffect(() => {
    setActiveFeature(0);
    setPreviousFeature(-1);
  }, [featuredMovies]);

  useEffect(() => {
    if (featuredMovies.length <= 1) return undefined;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setPreviousFeature(activeFeature);
      setActiveFeature((activeFeature + 1) % featuredMovies.length);
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [activeFeature, featuredMovies.length]);

  const showFeature = (index) => {
    if (index === activeFeature) return;
    setPreviousFeature(activeFeature);
    setActiveFeature(index);
  };

  return (
    <main>
      <section className={styles.spotlight}>
        <div className={styles.spotlightMedia}>
          {featuredMovies.length ? (
            featuredMovies.map((movie, index) => (
              <div
                className={`${styles.spotlightSlide} ${
                  index === activeFeature ? styles.spotlightSlideActive : ""
                } ${
                  index === previousFeature ? styles.spotlightSlidePrevious : ""
                }`}
                key={movie.id}
                aria-hidden={index !== activeFeature}
              >
                <div className={styles.spotlightBackdrop} aria-hidden="true">
                  <MediaImage src={movie.thumbnailUrl} alt="" />
                </div>
                <div className={styles.spotlightFrame}>
                  <MediaImage
                    src={movie.thumbnailUrl}
                    alt={index === activeFeature ? movie.title || "Featured Film" : ""}
                    priority={index === 0}
                    sizes="(max-width: 900px) 100vw, 78vw"
                  />
                </div>
              </div>
            ))
          ) : (
            <MediaImage src={null} alt="Project1337" priority />
          )}
        </div>
        <div className={styles.spotlightWash} />
        <div className={styles.spotlightCount}>
          {String(activeFeature + 1).padStart(2, "0")} / {String(Math.max(featuredMovies.length, 1)).padStart(2, "0")}
        </div>
        <div className={styles.spotlightCopy} key={featured?.id || "empty-feature"}>
          <div className={styles.kicker}><Icon name="spark" /> Aus dem Archiv</div>
          <h1 className={spotlightTitleClass(featured?.title)}>
            {featured?.title || "Your private cinema"}
          </h1>
          <div className={styles.spotlightMeta}>
            <span>{featured?.year || "2026"}</span><i />
            <span>{featured?.studio || "Project1337"}</span><i />
            <span>{featured?.resolution || "Private Edition"}</span>
          </div>
          <p>
            {featured?.actors?.length
              ? featured.actors.slice(0, 3).join(" · ")
              : "Eine persönlich kuratierte Screening Collection."}
          </p>
          <div className={styles.spotlightActions}>
            {featured ? <button type="button" className={styles.primaryAction} onClick={() => onOpenMovie(featured)}><Icon name="play" /> Film öffnen</button> : null}
            <button type="button" className={styles.secondaryAction} onClick={onShowMovies}>Gesamtes Archiv <Icon name="arrow" /></button>
          </div>
        </div>
        {featuredMovies.length > 1 ? (
          <div className={styles.spotlightControls} aria-label="Cinema Showcase">
            {featuredMovies.map((movie, index) => (
              <button
                type="button"
                key={`feature-control-${movie.id}`}
                className={index === activeFeature ? styles.spotlightControlActive : ""}
                onClick={() => showFeature(index)}
                aria-label={`${movie.title || `Film ${index + 1}`} anzeigen`}
                aria-current={index === activeFeature ? "true" : undefined}
              >
                <span />
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.libraryStrip}>
          <div><strong>{movies.length}</strong><span>Filme im Archiv</span></div>
          <div><strong>{actors.length}</strong><span>Featured Talents</span></div>
          <div><strong>{studioCount}</strong><span>Studios</span></div>
          <div><strong>{yearRange}</strong><span>Collection Range</span></div>
        </div>
      </section>

      <section className={styles.contentSection}>
        <SectionHeading index="01" eyebrow="Just added" title="Neu im Archiv" action="Alle Filme" onAction={onShowMovies} />
        <div className={styles.movieRail}>
          {recent.map((movie, index) => <MovieCard key={movie.id} movie={movie} index={index} onOpen={onOpenMovie} large={index === 0} />)}
        </div>
      </section>

      <section className={`${styles.contentSection} ${styles.talentSection}`} id="beta-actors">
        <SectionHeading index="02" eyebrow="The faces" title="Talents der Collection" action="Alle Darsteller" onAction={onShowActors} />
        <div className={styles.actorMosaic}>
          {topActors.map((actor, index) => <ActorCard key={actor.id} actor={actor} onOpen={onShowActor} feature={index === 0} />)}
        </div>
      </section>

      <section className={styles.manifesto}>
        <span>03 / THE ARCHIVE</span>
        <h2>Not streaming.<br /><em>Collecting.</em></h2>
        <p>Eine private Library ohne Algorithmus – persönlich ausgewählt, sauber organisiert und jederzeit abspielbar.</p>
        <button type="button" onClick={onShowMovies}>Collection öffnen <Icon name="arrow" /></button>
      </section>
    </main>
  );
}

function MovieArchive({ movies, title, subtitle, movieSort, setMovieSort, onOpenMovie, onOpenFilters, hasAnyFilter }) {
  return (
    <main className={styles.archivePage}>
      <section className={styles.archiveIntro}>
        <span>Complete catalogue / {new Date().getFullYear()}</span>
        <h1>Film<br /><em>Archive</em></h1>
        <p>{subtitle || `${movies.length} Filme`} · persönlich kuratiert und sofort verfügbar.</p>
        <div className={styles.archiveNumber}>{String(movies.length).padStart(3, "0")}</div>
      </section>

      <div className={styles.archiveToolbar}>
        <div><span>Ansicht</span><strong>{title || "Alle Filme"}</strong></div>
        <div className={styles.archiveControls}>
          <select value={movieSort} onChange={(event) => setMovieSort(event.target.value)} aria-label="Filme sortieren">
            <option value="added_desc">Zuletzt hinzugefügt</option>
            <option value="year_desc">Erscheinungsdatum</option>
            <option value="quality_desc">Qualität</option>
          </select>
          <button type="button" className={hasAnyFilter ? styles.filterActive : ""} onClick={onOpenFilters}>
            <Icon name="filter" /> Filter {hasAnyFilter ? "aktiv" : ""}
          </button>
        </div>
      </div>

      {movies.length ? (
        <div className={styles.archiveGrid}>
          {movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} onOpen={onOpenMovie} large={index % 9 === 0} index={index} />)}
        </div>
      ) : (
        <div className={styles.emptyState}><strong>Keine Filme gefunden.</strong><span>Ändere Suche oder Filter und versuche es erneut.</span></div>
      )}
    </main>
  );
}

function ActorArchive({ actors, onShowActor }) {
  const [actorSearch, setActorSearch] = useState("");
  const [actorSort, setActorSort] = useState("films_desc");

  const visibleActors = useMemo(() => {
    const query = actorSearch.trim().toLocaleLowerCase("de");
    const list = query
      ? actors.filter((actor) =>
          [actor.name, actor.origin]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("de")
            .includes(query)
        )
      : [...actors];

    list.sort((a, b) => {
      if (actorSort === "name_asc") {
        return String(a.name || "").localeCompare(String(b.name || ""), "de", {
          sensitivity: "base",
        });
      }

      if (actorSort === "name_desc") {
        return String(b.name || "").localeCompare(String(a.name || ""), "de", {
          sensitivity: "base",
        });
      }

      return (
        Number(b.movieCount || 0) - Number(a.movieCount || 0) ||
        String(a.name || "").localeCompare(String(b.name || ""), "de", {
          sensitivity: "base",
        })
      );
    });

    return list;
  }, [actors, actorSearch, actorSort]);

  const movieTotal = actors.reduce(
    (sum, actor) => sum + Number(actor.movieCount || 0),
    0
  );

  return (
    <main className={styles.actorArchivePage}>
      <section className={styles.actorArchiveIntro}>
        <div className={styles.actorArchiveLabel}>Complete talent directory / 1337</div>
        <h1>
          Talent
          <em>Index</em>
        </h1>
        <p>
          Alle Hauptdarsteller der Collection – vollständig, durchsuchbar und
          nach Name oder Filmanzahl sortierbar.
        </p>
        <div className={styles.actorArchiveStats}>
          <div><strong>{String(actors.length).padStart(2, "0")}</strong><span>Darsteller</span></div>
          <div><strong>{String(movieTotal).padStart(3, "0")}</strong><span>Filmzuordnungen</span></div>
        </div>
        <div className={styles.actorArchiveWord} aria-hidden="true">FACES</div>
      </section>

      <div className={styles.actorArchiveToolbar}>
        <label className={styles.actorArchiveSearch}>
          <Icon name="search" />
          <input
            value={actorSearch}
            onChange={(event) => setActorSearch(event.target.value)}
            placeholder="Darsteller oder Herkunft suchen"
            aria-label="Darsteller suchen"
          />
        </label>
        <div className={styles.actorArchiveResult}>
          <span>Directory</span>
          <strong>{visibleActors.length} von {actors.length}</strong>
        </div>
        <select
          value={actorSort}
          onChange={(event) => setActorSort(event.target.value)}
          aria-label="Darsteller sortieren"
        >
          <option value="films_desc">Meiste Filme</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
      </div>

      {visibleActors.length ? (
        <div className={styles.actorArchiveGrid}>
          {visibleActors.map((actor, index) => (
            <div className={styles.actorArchiveItem} key={actor.id}>
              <div className={styles.actorArchivePosition}>
                {String(index + 1).padStart(2, "0")}
              </div>
              <ActorCard actor={actor} onOpen={onShowActor} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.actorArchiveEmpty}>
          <strong>Keine Darsteller gefunden.</strong>
          <span>Versuche einen anderen Namen oder lösche die Suche.</span>
          <button type="button" onClick={() => setActorSearch("")}>Suche löschen</button>
        </div>
      )}
    </main>
  );
}

function StatsGroup({ index, title, items, percentage = false }) {
  return (
    <section className={styles.statsCard}>
      <header className={styles.statsCardHeader}>
        <span>{index}</span>
        <h3>{title}</h3>
      </header>

      {items.length ? (
        <div className={styles.statsList}>
          {items.map((item, position) => (
            <div className={styles.statsItem} key={`${item.value}-${position}`}>
              <div className={styles.statsItemLine}>
                <span className={styles.statsRank}>{String(position + 1).padStart(2, "0")}</span>
                <strong>{item.value}</strong>
                <em>{percentage ? `${item.percent}%` : String(item.count).padStart(2, "0")}</em>
              </div>
              {percentage ? (
                <div className={styles.statsBar} aria-hidden="true">
                  <span style={{ width: `${item.percent}%` }} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.statsEmpty}>Keine Daten hinterlegt</div>
      )}
    </section>
  );
}

function ActorStatsModal({ actor, movies, stats, onClose }) {
  return (
    <div
      className={styles.statsLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="actor-stats-title"
    >
      <button
        type="button"
        className={styles.statsBackdrop}
        onClick={onClose}
        aria-label="Statistiken schließen"
      />

      <div className={styles.statsPanel}>
        <header className={styles.statsHeader}>
          <div className={styles.statsHeaderIndex}>1337 / DATA</div>
          <div>
            <span>Collection intelligence</span>
            <h2 id="actor-stats-title">{actor.name}</h2>
            <p>
              {movies.length} Filme · {stats.yearRange} · {formatNumber(stats.totalViews)} Aufrufe
            </p>
          </div>
          <button
            type="button"
            className={styles.statsClose}
            onClick={onClose}
            aria-label="Statistiken schließen"
            autoFocus
          >
            <Icon name="close" />
          </button>
        </header>

        <div className={styles.statsGrid}>
          <StatsGroup index="01" title="Haarfarbe" items={stats.hairColors} percentage />
          <StatsGroup index="02" title="Qualität" items={stats.qualities} percentage />
          <StatsGroup index="03" title="Top 5 Studios" items={stats.studios} />
          <StatsGroup index="04" title="Top 5 Nebendarsteller" items={stats.supportingActors} />
          <StatsGroup index="05" title="Top 5 Tags" items={stats.tags} />
          <StatsGroup index="06" title="Top 5 Finish" items={stats.finishes} />
        </div>
      </div>
    </div>
  );
}

function ActorProfile({ actor, movies, movieSort, setMovieSort, onBack, onOpenMovie }) {
  const age = getAge(actor.birthDate);
  const [statsOpen, setStatsOpen] = useState(false);
  const stats = useMemo(() => buildActorStats(movies), [movies]);

  useEffect(() => {
    if (!statsOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setStatsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [statsOpen]);

  return (
    <main className={styles.profilePage}>
      <section className={styles.profileHero}>
        <div className={styles.profileImage}>
          <MediaImage src={actor.profileImage} alt={actor.name} priority sizes="(max-width: 760px) 100vw, 54vw" />
          <div className={styles.profileImageShade} />
        </div>
        <button type="button" className={styles.backButton} onClick={onBack}><Icon name="back" /> Collection</button>
        <div className={styles.profileCounter}>{String(movies.length).padStart(2, "0")} FILMS</div>
        <div className={styles.profileCopy}>
          <span>Featured talent / 1337</span>
          <h1>{actor.name}</h1>
          <div className={styles.profileFacts}>
            <div><small>Herkunft</small><strong>{actor.origin || "–"}</strong></div>
            <div><small>Geboren</small><strong>{formatDate(actor.birthDate)}{age ? ` · ${age}` : ""}</strong></div>
            <div><small>Collection</small><strong>{movies.length} Filme</strong></div>
          </div>
          <div className={styles.profileMetrics}>
            <div>
              <Icon name="star" />
              <span>
                <small>Ø Bewertung</small>
                <strong>
                  {stats.averageRating != null ? formatRating(stats.averageRating) : "–"}
                  <em>/10</em>
                </strong>
              </span>
              <i>
                {stats.ratedMovies
                  ? `${stats.ratedMovies} bewertet`
                  : "Noch keine Bewertung"}
              </i>
            </div>
            <div>
              <Icon name="play" />
              <span>
                <small>Gesamtaufrufe</small>
                <strong>{formatNumber(stats.totalViews)}</strong>
              </span>
              <i>{movies.length} Filme</i>
            </div>
          </div>
          <div className={styles.profileLinks}>
            <button
              type="button"
              className={styles.profileStatsButton}
              onClick={() => setStatsOpen(true)}
            >
              <Icon name="spark" /> Alle Statistiken
            </button>
            {actor.iafdUrl ? <a href={actor.iafdUrl} target="_blank" rel="noreferrer">IAFD <Icon name="arrow" /></a> : null}
            {actor.planetsuzyUrl ? <a href={actor.planetsuzyUrl} target="_blank" rel="noreferrer">PlanetSuzy <Icon name="arrow" /></a> : null}
          </div>
        </div>
      </section>

      <section className={styles.profileCollection}>
        <div className={styles.profileCollectionHead}>
          <div><span>Selected works</span><h2>Filmographie</h2></div>
          <select value={movieSort} onChange={(event) => setMovieSort(event.target.value)}>
            <option value="added_desc">Zuletzt hinzugefügt</option>
            <option value="year_desc">Erscheinungsdatum</option>
            <option value="quality_desc">Qualität</option>
          </select>
        </div>
        <div className={styles.profileMovieGrid}>
          {movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} onOpen={onOpenMovie} index={index} />)}
        </div>
      </section>

      {statsOpen ? (
        <ActorStatsModal
          actor={actor}
          movies={movies}
          stats={stats}
          onClose={() => setStatsOpen(false)}
        />
      ) : null}
    </main>
  );
}

function MovieDetail({ movie, onBack, onShowActor, onRateMovie, onRecordView }) {
  const mainCast = Array.isArray(movie.mainCast) ? movie.mainCast : [];
  const supportCast = Array.isArray(movie.supportCast) ? movie.supportCast : [];
  const castCount = mainCast.length + supportCast.length;
  const [draftRating, setDraftRating] = useState(Number(movie.rating) || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [metricError, setMetricError] = useState("");
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    setDraftRating(Number(movie.rating) || 0);
  }, [movie.rating]);

  useEffect(() => {
    viewRecordedRef.current = false;
    setHoverRating(0);
    setMetricError("");
  }, [movie.id]);

  const saveRating = async (rating) => {
    if (ratingSaving || rating === draftRating) return;

    const previousRating = draftRating;
    setDraftRating(rating);
    setRatingSaving(true);
    setMetricError("");

    try {
      await onRateMovie(movie.id, rating);
    } catch (error) {
      setDraftRating(previousRating);
      setMetricError(error?.message || "Bewertung konnte nicht gespeichert werden.");
    } finally {
      setRatingSaving(false);
    }
  };

  const recordView = () => {
    if (viewRecordedRef.current || !movie.fileUrl) return;
    viewRecordedRef.current = true;
    setMetricError("");

    void onRecordView(movie.id).catch((error) => {
      setMetricError(error?.message || "Aufruf konnte nicht gespeichert werden.");
    });
  };

  const visibleRating = hoverRating || draftRating;

  return (
    <main className={styles.detailPage}>
      <section className={styles.theater}>
        <button type="button" className={styles.theaterBack} onClick={onBack}><Icon name="back" /> Zurück</button>
        {movie.fileUrl ? (
          <ModernVideoPlayer
            key={movie.id}
            src={movie.fileUrl}
            poster={movie.thumbnailUrl}
            title={movie.title}
            quality={movie.resolution}
            onPlay={recordView}
          />
        ) : (
          <div className={styles.videoFrame}>
            <div className={styles.noVideo}><Icon name="play" /><span>Keine Videodatei hinterlegt</span></div>
          </div>
        )}
        <div className={styles.theaterLabel}>PRIVATE SCREENING / 1337</div>
      </section>

      <section className={`${styles.detailDashboard}${castCount ? "" : ` ${styles.detailDashboardSolo}`}`}>
        <div className={styles.detailInfo}>
          <div className={styles.detailTitleBlock}>
            <span>
              {[movie.studio || "Project1337", movie.year || "–", movie.resolution || "–"].join(" · ")}
            </span>
            <h1>{movie.title || "Unbenannt"}</h1>
          </div>
          {movie.tags?.length ? <div className={styles.detailTags}>{movie.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
          <aside className={styles.compactRating}>
            <div className={styles.ratingHeader}>
              <span>Personal score</span>
              <strong>{visibleRating ? `${visibleRating}/10` : "–/10"}</strong>
              <small>{draftRating ? "Deine Bewertung" : "Noch nicht bewertet"}</small>
            </div>
            <div
              className={styles.ratingStars}
              onMouseLeave={() => setHoverRating(0)}
              aria-label="Film von 1 bis 10 bewerten"
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                <button
                  type="button"
                  key={rating}
                  className={rating <= visibleRating ? styles.ratingStarActive : ""}
                  onMouseEnter={() => setHoverRating(rating)}
                  onFocus={() => setHoverRating(rating)}
                  onBlur={() => setHoverRating(0)}
                  onClick={() => saveRating(rating)}
                  aria-label={`${rating} von 10 Sternen`}
                  aria-pressed={draftRating === rating}
                  disabled={ratingSaving}
                >
                  <Icon name="star" />
                </button>
              ))}
            </div>
            <div className={styles.ratingMeta}>
              <span>{ratingSaving ? "Speichert…" : "Stern auswählen"}</span>
              <span><Icon name="play" /> {formatNumber(movie.viewCount)} Aufrufe</span>
            </div>
            {metricError ? <div className={styles.metricError}>{metricError}</div> : null}
          </aside>
        </div>

        {mainCast.length || supportCast.length ? (
          <div className={styles.detailCast}>
            <div className={styles.detailCastHeader}>
              <div><span>On screen</span><h2>Cast</h2></div>
              <small>{castCount} Personen</small>
            </div>
            <div className={styles.castRail}>
              {mainCast.map((person) => (
                <button type="button" key={`main-${person.id}`} onClick={() => onShowActor(person.id, person.name, person.slug)}>
                  <span><MediaImage src={person.profileImage} alt={person.name} sizes="200px" /></span>
                  <strong>{person.name}</strong><small>Main</small>
                </button>
              ))}
              {supportCast.map((person) => (
                <div key={`support-${person.id}`}>
                  <span><MediaImage src={person.profileImage} alt={person.name} sizes="200px" /></span>
                  <strong>{person.name}</strong><small>Supporting</small>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function BetaExperience({
  movies,
  actors,
  selectedActor,
  selectedMovie,
  selectedMovieId,
  movieList,
  viewMode,
  moviesTitle,
  moviesSubtitle,
  movieSort,
  setMovieSort,
  search,
  loggedIn,
  loading,
  error,
  loginError,
  loginUser,
  loginPassword,
  loginLoading,
  setLoginUser,
  setLoginPassword,
  onLogin,
  onLogout,
  onDiscover,
  onShowActors,
  onShowMovies,
  onShowActor,
  onOpenMovie,
  onCloseMovie,
  onRateMovie,
  onRecordMovieView,
  onSearch,
  onDashboard,
  filtersOpen,
  setFiltersOpen,
  hasAnyFilter,
  onApplyFilters,
  onResetFilters,
  allTags,
  allStudios,
  allResolutions,
  mainActorOptions,
  supportingActorOptions,
  selectedTags,
  selectedStudio,
  selectedResolution,
  yearFrom,
  yearTo,
  selectedMainActors,
  selectedSupportingActors,
  setSelectedStudio,
  setSelectedResolution,
  setYearFrom,
  setYearTo,
  onToggleTag,
  onToggleMainActor,
  onToggleSupportingActor,
}) {
  const [actorBackTarget, setActorBackTarget] = useState("discover");

  const openActorFromDiscover = (id, name, slug) => {
    setActorBackTarget("discover");
    onShowActor(id, name, slug);
  };

  const openActorFromArchive = (id, name, slug) => {
    setActorBackTarget("archive");
    onShowActor(id, name, slug);
  };

  if (!loggedIn) {
    return (
      <div className={styles.experience}>
        <LoginGate
          loginUser={loginUser}
          loginPassword={loginPassword}
          loginLoading={loginLoading}
          loginError={loginError}
          setLoginUser={setLoginUser}
          setLoginPassword={setLoginPassword}
          onLogin={onLogin}
        />
      </div>
    );
  }

  return (
    <div className={styles.experience}>
      <AppHeader
        viewMode={viewMode}
        selectedActor={selectedActor}
        selectedMovieId={selectedMovieId}
        search={search}
        loginUser={loginUser}
        onSearch={onSearch}
        onDiscover={onDiscover}
        onShowActors={() => {
          setActorBackTarget("archive");
          onShowActors();
        }}
        onShowMovies={onShowMovies}
        onDashboard={onDashboard}
        onLogout={onLogout}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {error ? <div className={styles.globalError}>{error}</div> : null}

      {loading ? (
        <LoadingScreen />
      ) : selectedMovieId ? (
        selectedMovie ? (
          <MovieDetail
            movie={selectedMovie}
            onBack={onCloseMovie}
            onShowActor={openActorFromDiscover}
            onRateMovie={onRateMovie}
            onRecordView={onRecordMovieView}
          />
        ) : <div className={styles.emptyState}><strong>Film nicht gefunden.</strong><button type="button" onClick={onCloseMovie}>Zurück</button></div>
      ) : selectedActor ? (
        <ActorProfile actor={selectedActor} movies={movieList} movieSort={movieSort} setMovieSort={setMovieSort} onBack={actorBackTarget === "archive" ? onShowActors : onDiscover} onOpenMovie={onOpenMovie} />
      ) : viewMode === "actors_all" ? (
        <ActorArchive actors={actors} onShowActor={openActorFromArchive} />
      ) : viewMode === "movies" ? (
        <MovieArchive movies={movieList} title={moviesTitle} subtitle={moviesSubtitle} movieSort={movieSort} setMovieSort={setMovieSort} onOpenMovie={onOpenMovie} onOpenFilters={() => setFiltersOpen(true)} hasAnyFilter={hasAnyFilter} />
      ) : (
        <Discovery movies={movies} actors={actors} onOpenMovie={onOpenMovie} onShowMovies={onShowMovies} onShowActors={onShowActors} onShowActor={openActorFromDiscover} />
      )}

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        hasAnyFilter={hasAnyFilter}
        onApply={onApplyFilters}
        onReset={onResetFilters}
        allTags={allTags}
        allStudios={allStudios}
        allResolutions={allResolutions}
        mainActorOptions={mainActorOptions}
        supportingActorOptions={supportingActorOptions}
        selectedTags={selectedTags}
        selectedStudio={selectedStudio}
        selectedResolution={selectedResolution}
        yearFrom={yearFrom}
        yearTo={yearTo}
        selectedMainActors={selectedMainActors}
        selectedSupportingActors={selectedSupportingActors}
        setSelectedStudio={setSelectedStudio}
        setSelectedResolution={setSelectedResolution}
        setYearFrom={setYearFrom}
        setYearTo={setYearTo}
        onToggleTag={onToggleTag}
        onToggleMainActor={onToggleMainActor}
        onToggleSupportingActor={onToggleSupportingActor}
      />
    </div>
  );
}
