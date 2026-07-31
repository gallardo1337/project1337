"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
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
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    spark: <path d="M12 3l1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Zm6 13 .6 2.4L21 19l-2.4.6L18 22l-.6-2.4L15 19l2.4-.6L18 16Z" />,
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

function qualityTone(quality) {
  const value = String(quality || "").toLowerCase();
  if (value.includes("4k")) return styles.qualityUltra;
  if (value.includes("full")) return styles.qualityFull;
  if (value.includes("retro")) return styles.qualityRetro;
  return "";
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
  onShowMovies,
  onDashboard,
  onLogout,
  onOpenFilters,
}) {
  const [accountOpen, setAccountOpen] = useState(false);

  const scrollToActors = () => {
    onDiscover();
    window.setTimeout(() => {
      document.getElementById("beta-actors")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const discoverActive = viewMode === "actors" && !selectedActor && !selectedMovieId;
  const moviesActive = viewMode === "movies" && !selectedActor && !selectedMovieId;

  return (
    <header className={styles.header}>
      <button type="button" className={styles.brand} onClick={onDiscover} aria-label="Entdecken">
        <Image src="/logo.png" alt="Project1337" width={112} height={52} priority />
        <span>BETA / 03</span>
      </button>

      <nav className={styles.nav} aria-label="Hauptnavigation">
        <button className={discoverActive ? styles.navActive : ""} onClick={onDiscover}>Entdecken</button>
        <button className={moviesActive ? styles.navActive : ""} onClick={onShowMovies}>Filme</button>
        <button onClick={scrollToActors}>Darsteller</button>
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

function Discovery({ movies, actors, onOpenMovie, onShowMovies, onShowActor }) {
  const sortedMovies = useMemo(
    () => [...movies].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0)),
    [movies]
  );
  const featured = sortedMovies.find((movie) => movie.thumbnailUrl) || sortedMovies[0];
  const recent = sortedMovies.slice(0, 9);
  const topActors = useMemo(
    () => [...actors].sort((a, b) => b.movieCount - a.movieCount).slice(0, 7),
    [actors]
  );
  const studioCount = new Set(movies.map((movie) => movie.studio).filter(Boolean)).size;
  const yearValues = movies.map((movie) => Number(movie.year)).filter(Boolean);
  const yearRange = yearValues.length ? `${Math.min(...yearValues)}—${Math.max(...yearValues)}` : "CURATED";

  return (
    <main>
      <section className={styles.spotlight}>
        <div className={styles.spotlightMedia}>
          <MediaImage src={featured?.thumbnailUrl} alt={featured?.title || "Featured Film"} priority />
        </div>
        <div className={styles.spotlightWash} />
        <div className={styles.spotlightCount}>01 / FEATURED</div>
        <div className={styles.spotlightCopy}>
          <div className={styles.kicker}><Icon name="spark" /> Neu in der Collection</div>
          <h1>{featured?.title || "Your private cinema"}</h1>
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
        <SectionHeading index="02" eyebrow="The faces" title="Talents der Collection" />
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

function ActorProfile({ actor, movies, movieSort, setMovieSort, onBack, onOpenMovie }) {
  const age = getAge(actor.birthDate);
  const studios = useMemo(() => {
    const counts = new Map();
    movies.forEach((movie) => {
      if (movie.studio) counts.set(movie.studio, (counts.get(movie.studio) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [movies]);

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
          <div className={styles.profileLinks}>
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
        {studios.length ? (
          <div className={styles.profileStudioLine}>
            <span>Top Studios</span>
            {studios.map(([studio, count]) => <div key={studio}><strong>{studio}</strong><small>{count}</small></div>)}
          </div>
        ) : null}
        <div className={styles.profileMovieGrid}>
          {movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} onOpen={onOpenMovie} index={index} />)}
        </div>
      </section>
    </main>
  );
}

function MovieDetail({ movie, onBack, onShowActor }) {
  const mainCast = Array.isArray(movie.mainCast) ? movie.mainCast : [];
  const supportCast = Array.isArray(movie.supportCast) ? movie.supportCast : [];

  return (
    <main className={styles.detailPage}>
      <section className={styles.theater}>
        <button type="button" className={styles.theaterBack} onClick={onBack}><Icon name="back" /> Zurück</button>
        <div className={styles.videoFrame}>
          {movie.fileUrl ? (
            <video controls playsInline preload="metadata" poster={movie.thumbnailUrl || undefined}>
              <source src={movie.fileUrl} type={getVideoMimeType(movie.fileUrl)} />
              Dein Browser unterstützt dieses Videoformat nicht.
            </video>
          ) : (
            <div className={styles.noVideo}><Icon name="play" /><span>Keine Videodatei hinterlegt</span></div>
          )}
        </div>
        <div className={styles.theaterLabel}>PRIVATE SCREENING / 1337</div>
      </section>

      <section className={styles.detailInfo}>
        <div className={styles.detailTitleBlock}>
          <span>{movie.studio || "Project1337"} · {movie.year || "–"}</span>
          <h1>{movie.title || "Unbenannt"}</h1>
        </div>
        <div className={styles.detailFacts}>
          <div><small>Qualität</small><strong>{movie.resolution || "–"}</strong></div>
          <div><small>Jahr</small><strong>{movie.year || "–"}</strong></div>
          <div><small>Studio</small><strong>{movie.studio || "–"}</strong></div>
        </div>
        {movie.tags?.length ? <div className={styles.detailTags}>{movie.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
      </section>

      {mainCast.length || supportCast.length ? (
        <section className={styles.castSection}>
          <SectionHeading index="01" eyebrow="On screen" title="Cast" />
          <div className={styles.castRail}>
            {mainCast.map((person) => (
              <button type="button" key={`main-${person.id}`} onClick={() => onShowActor(person.id, person.name, person.slug)}>
                <span><MediaImage src={person.profileImage} alt={person.name} sizes="160px" /></span>
                <strong>{person.name}</strong><small>Main</small>
              </button>
            ))}
            {supportCast.map((person) => (
              <div key={`support-${person.id}`}>
                <span><MediaImage src={person.profileImage} alt={person.name} sizes="160px" /></span>
                <strong>{person.name}</strong><small>Supporting</small>
              </div>
            ))}
          </div>
        </section>
      ) : null}
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
  onShowMovies,
  onShowActor,
  onOpenMovie,
  onCloseMovie,
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
        onShowMovies={onShowMovies}
        onDashboard={onDashboard}
        onLogout={onLogout}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {error ? <div className={styles.globalError}>{error}</div> : null}

      {loading ? (
        <LoadingScreen />
      ) : selectedMovieId ? (
        selectedMovie ? <MovieDetail movie={selectedMovie} onBack={onCloseMovie} onShowActor={onShowActor} /> : <div className={styles.emptyState}><strong>Film nicht gefunden.</strong><button type="button" onClick={onCloseMovie}>Zurück</button></div>
      ) : selectedActor ? (
        <ActorProfile actor={selectedActor} movies={movieList} movieSort={movieSort} setMovieSort={setMovieSort} onBack={onDiscover} onOpenMovie={onOpenMovie} />
      ) : viewMode === "movies" ? (
        <MovieArchive movies={movieList} title={moviesTitle} subtitle={moviesSubtitle} movieSort={movieSort} setMovieSort={setMovieSort} onOpenMovie={onOpenMovie} onOpenFilters={() => setFiltersOpen(true)} hasAnyFilter={hasAnyFilter} />
      ) : (
        <Discovery movies={movies} actors={actors} onOpenMovie={onOpenMovie} onShowMovies={onShowMovies} onShowActor={onShowActor} />
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
