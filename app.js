import { supabase } from "./supabaseClient.js";

let allMovies = [];
let allActors = [];

// DOM Elemente
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

// Hauptroutine
async function loadEverything() {
  const { data: movies, error } = await supabase
    .from("movies")
    .select(`
      id,
      title,
      file_url,
      year,
      studios ( name ),
      movie_actors (
        actors ( name )
      ),
      movie_tags (
        tags ( name )
      )
    `);

  if (error) {
    console.error("Supabase Fehler:", error);
    return;
  }

  // Umwandeln in saubere JS-Struktur
  allMovies = movies.map(m => ({
    id: m.id,
    title: m.title,
    fileUrl: m.file_url,
    year: m.year,
    studio: m.studios ? m.studios.name : null,
    actors: m.movie_actors?.map(a => a.actors.name) || [],
    tags: m.movie_tags?.map(t => t.tags.name) || []
  }));

  buildActors();
  renderActors();
}

function buildActors() {
  const map = new Map();

  allMovies.forEach(m => {
    m.actors.forEach(actor => {
      if (!map.has(actor)) map.set(actor, 0);
      map.set(actor, map.get(actor) + 1);
    });
  });

  allActors = Array.from(map.entries())
    .map(([name, count]) => ({ name, movieCount: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function renderActors() {
  els.actorGrid.innerHTML = "";

  allActors.forEach(actor => {
    const card = document.createElement("article");
    card.className = "actor-card";

    card.innerHTML = `
      <div class="actor-name">${actor.name}</div>
      <div class="actor-count">${actor.movieCount} Film(e)</div>
    `;

    card.addEventListener("click", () => {
      showMoviesForActor(actor.name);
    });

    els.actorGrid.appendChild(card);
  });
}

function showMoviesForActor(actorName) {
  const movies = allMovies.filter(m => m.actors.includes(actorName));

  els.moviesTitle.textContent = actorName;
  els.moviesSubtitle.textContent = `${movies.length} Film(e)`;
  renderMovieList(movies);

  els.actorSection.classList.add("hidden");
  els.moviesSection.classList.remove("hidden");
}

function showMoviesForSearch(query) {
  const q = query.toLowerCase();

  const movies = allMovies.filter(m => {
    const haystack = [
      m.title,
      m.studio,
      m.actors.join(" "),
      m.tags.join(" ")
    ]
      .filter(Boolean)
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

function renderMovieList(movies) {
  els.movieList.innerHTML = "";

  movies.forEach(m => {
    const card = document.createElement("article");
    card.className = "movie-card";

    card.innerHTML = `
      <div class="movie-title">${m.title}</div>
      <div class="movie-meta">
        ${m.year ? m.year : ""}
        ${m.studio ? " • " + m.studio : ""}
        ${m.actors.length > 0 ? " • " + m.actors.join(", ") : ""}
      </div>
      <div class="tag-list">
        ${m.tags.map(t => `<span class="tag-pill">${t}</span>`).join("")}
      </div>
      <div class="movie-actions">
        <button class="play-btn">Abspielen</button>
      </div>
    `;

    card.querySelector(".play-btn").addEventListener("click", () => {
      if (!m.fileUrl) {
        alert("Keine Dateipfad-URL vorhanden.");
        return;
      }
      window.location.href = m.fileUrl;
    });

    els.movieList.appendChild(card);
  });
}

// Events
let searchDebounce;
els.globalSearch.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = els.globalSearch.value.trim();
    if (q.length === 0) {
      els.actorSection.classList.remove("hidden");
      els.moviesSection.classList.add("hidden");
      return;
    }
    showMoviesForSearch(q);
  }, 200);
});

els.backToActors.addEventListener("click", () => {
  els.moviesSection.classList.add("hidden");
  els.actorSection.classList.remove("hidden");
});

// Start
loadEverything();
