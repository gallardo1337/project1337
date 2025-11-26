let allMovies = [];
let allActors = [];

// DOM-Elemente
const els = {
  globalSearch: document.getElementById("globalSearch"),
  actorSection: document.getElementById("actorSection"),
  actorGrid: document.getElementById("actorGrid"),
  moviesSection: document.getElementById("moviesSection"),
  moviesTitle: document.getElementById("moviesTitle"),
  moviesSubtitle: document.getElementById("moviesSubtitle"),
  movieList: document.getElementById("movieList"),
  backToActors: document.getElementById("backToActors")
};

async function loadMovies() {
  const resp = await fetch("movies.json");
  allMovies = await resp.json();
  buildActors();
  renderActors();
}

function buildActors() {
  const map = new Map();

  allMovies.forEach(m => {
    const actors = m.actors || [];
    actors.forEach(name => {
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, { name, movieCount: 0 });
      }
      map.get(name).movieCount += 1;
    });
  });

  allActors = Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function renderActors() {
  els.actorGrid.innerHTML = "";

  allActors.forEach(actor => {
    const card = document.createElement("article");
    card.className = "actor-card";

    const nameEl = document.createElement("div");
    nameEl.className = "actor-name";
    nameEl.textContent = actor.name;

    const countEl = document.createElement("div");
    countEl.className = "actor-count";
    countEl.textContent =
      actor.movieCount === 1 ? "1 Film" : `${actor.movieCount} Filme`;

    card.appendChild(nameEl);
    card.appendChild(countEl);

    card.addEventListener("click", () => {
      showMoviesForActor(actor.name);
    });

    els.actorGrid.appendChild(card);
  });
}

// Filme für einen bestimmten Darsteller
function showMoviesForActor(actorName) {
  const movies = allMovies.filter(m =>
    (m.actors || []).includes(actorName)
  );

  els.moviesTitle.textContent = actorName;
  els.moviesSubtitle.textContent = `${movies.length} Film(e) mit diesem Darsteller`;

  renderMovieList(movies);

  els.actorSection.classList.add("hidden");
  els.moviesSection.classList.remove("hidden");
}

// Filme anhand der Suche
function showMoviesForSearch(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    els.moviesSection.classList.add("hidden");
    els.actorSection.classList.remove("hidden");
    return;
  }

  const movies = allMovies.filter(m => {
    const haystack = [
      m.title || "",
      m.studio || "",
      (m.actors || []).join(" "),
      (m.tags || []).join(" ")
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });

  els.moviesTitle.textContent = `Suchergebnis für "${query}"`;
  els.moviesSubtitle.textContent = `${movies.length} Treffer`;

  renderMovieList(movies);

  els.actorSection.classList.add("hidden");
  els.moviesSection.classList.remove("hidden");
}

// Film-Liste rendern
function renderMovieList(movies) {
  els.movieList.innerHTML = "";

  movies.forEach(m => {
    const card = document.createElement("article");
    card.className = "movie-card";

    const titleEl = document.createElement("div");
    titleEl.className = "movie-title";
    titleEl.textContent = m.title || "Ohne Titel";

    const metaEl = document.createElement("div");
    metaEl.className = "movie-meta";
    const parts = [];
    if (m.year) parts.push(m.year);
    if (m.studio) parts.push(m.studio);
    if (m.actors && m.actors.length > 0) {
      parts.push(m.actors.join(", "));
    }
    metaEl.textContent = parts.join(" • ");

    const tagList = document.createElement("div");
    tagList.className = "tag-list";
    (m.tags || []).forEach(t => {
      const span = document.createElement("span");
      span.className = "tag-pill";
      span.textContent = t;
      tagList.appendChild(span);
    });

    const actions = document.createElement("div");
    actions.className = "movie-actions";
    const playBtn = document.createElement("button");
    playBtn.className = "play-btn";
    playBtn.textContent = "Abspielen";
    playBtn.addEventListener("click", () => {
      if (!m.fileUrl) {
        alert("Kein Dateipfad hinterlegt.");
        return;
      }
      // Direkt auf den Film-Link gehen – Browser/Apple TV übernimmt
      window.location.href = m.fileUrl;
    });
    actions.appendChild(playBtn);

    card.appendChild(titleEl);
    card.appendChild(metaEl);
    card.appendChild(tagList);
    card.appendChild(actions);

    els.movieList.appendChild(card);
  });
}

// Events

let searchDebounce;
els.globalSearch.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    showMoviesForSearch(els.globalSearch.value);
  }, 200);
});

els.backToActors.addEventListener("click", () => {
  els.moviesSection.classList.add("hidden");
  els.actorSection.classList.remove("hidden");
  // Suche optional leeren:
  // els.globalSearch.value = "";
});

loadMovies().catch(err => {
  console.error("Fehler beim Laden von movies.json", err);
  els.movieList.textContent = "Fehler beim Laden der Filmliste.";
});
