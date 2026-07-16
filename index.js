// ============ CONSTANTS ============
const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FAVORITES_KEY = "wordly_favorites";
const THEME_KEY = "wordly_theme";

// ============ ELEMENT REFERENCES ============
const searchForm = document.getElementById("searchForm");
const wordInput = document.getElementById("wordInput");
const searchBtn = document.getElementById("searchBtn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("errorMessage");
const resultsEl = document.getElementById("results");
const resultsEmptyEl = document.getElementById("resultsEmpty");
const themeToggleBtn = document.getElementById("themeToggle");
const favoritesListEl = document.getElementById("favoritesList");
const favoritesEmptyEl = document.getElementById("favoritesEmpty");

// The word currently on screen (so the save button knows what to save)
let currentEntry = null;

// ============ STARTUP ============
document.addEventListener("DOMContentLoaded", function () {
  displayFavorites();
  restoreTheme();
});

searchForm.addEventListener("submit", handleSearch);
themeToggleBtn.addEventListener("click", toggleTheme);

// One click listener on the whole results box handles both buttons
// inside it (event delegation), since those buttons get created later.
resultsEl.addEventListener("click", function (event) {
  if (event.target.closest(".save-btn")) {
    handleSaveToggle();
  }
  const audioBtn = event.target.closest(".audio-btn");
  if (audioBtn && !audioBtn.disabled) {
    playAudio(audioBtn.dataset.audioUrl);
  }
});

// Same idea for the favorites list: search-again buttons and remove buttons.
favoritesListEl.addEventListener("click", function (event) {
  const searchAgainBtn = event.target.closest(".favorite-word-btn");
  if (searchAgainBtn) {
    wordInput.value = searchAgainBtn.dataset.word;
    fetchWord(searchAgainBtn.dataset.word);
  }
  const removeBtn = event.target.closest(".favorite-remove-btn");
  if (removeBtn) {
    removeFavorite(removeBtn.dataset.word);
  }
});

// ============ SEARCH ============
function handleSearch(event) {
  event.preventDefault();
  const word = wordInput.value.trim().toLowerCase();

  hideError();
  if (word === "") {
    showError("Please enter a word.");
    return;
  }
  fetchWord(word);
}

// Fetches a word from the Free Dictionary API and renders the result.
async function fetchWord(word) {
  setLoading(true);
  hideError();
  resultsEl.classList.add("hidden");

  try {
    const response = await fetch(API_BASE + encodeURIComponent(word));

    if (response.status === 404) {
      showError("We could not find that word. Check the spelling and try again.");
      return;
    }
    if (!response.ok) {
      showError("Something went wrong. Please try again.");
      return;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      showError("Something went wrong. Please try again.");
      return;
    }

    renderWord(data[0]);
  } catch (error) {
    showError("Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  loadingEl.classList.toggle("hidden", !isLoading);
  searchBtn.disabled = isLoading;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function hideError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

// ============ RENDERING THE DEFINITION ============
function renderWord(entry) {
  currentEntry = entry;

  const phonetic = getPhonetic(entry);
  const audioUrl = getAudioUrl(entry);
  const saved = isFavorite(entry.word);

  // Build the meanings HTML first, one part-of-speech block at a time.
  let meaningsHtml = "";
  for (let m = 0; m < entry.meanings.length; m++) {
    meaningsHtml += renderMeaning(entry.meanings[m]);
  }

  resultsEl.innerHTML = `
    <h3 class="entry-word">${entry.word}</h3>
    ${phonetic ? `<p class="entry-phonetic">${phonetic}</p>` : ""}
    <div class="entry-actions">
      <button type="button" class="icon-btn audio-btn" ${audioUrl ? `data-audio-url="${audioUrl}"` : "disabled"}>
        🔊 Play
      </button>
      <button type="button" class="icon-btn save-btn ${saved ? "saved" : ""}">
        ${saved ? "★ Saved" : "☆ Save"}
      </button>
    </div>
    ${meaningsHtml}
  `;

  resultsEl.classList.remove("hidden");
  resultsEmptyEl.classList.add("hidden");
}

function renderMeaning(meaning) {
  let itemsHtml = "";
  const maxDefs = Math.min(meaning.definitions.length, 3);

  for (let d = 0; d < maxDefs; d++) {
    const def = meaning.definitions[d];
    const example = def.example ? `<div class="example">"${def.example}"</div>` : "";
    itemsHtml += `<li><div>${def.definition}</div>${example}</li>`;
  }

  return `
    <h4 class="part-of-speech">${meaning.partOfSpeech}</h4>
    <ol class="definition-list">${itemsHtml}</ol>
  `;
}

// Picks a phonetic spelling: top-level field first, else the first one found.
function getPhonetic(entry) {
  if (entry.phonetic) {
    return entry.phonetic;
  }
  for (let i = 0; i < entry.phonetics.length; i++) {
    if (entry.phonetics[i].text) {
      return entry.phonetics[i].text;
    }
  }
  return "";
}

// Finds the first phonetics entry that actually has an audio clip.
function getAudioUrl(entry) {
  for (let i = 0; i < entry.phonetics.length; i++) {
    if (entry.phonetics[i].audio) {
      return entry.phonetics[i].audio;
    }
  }
  return "";
}

function playAudio(url) {
  if (!url) {
    return;
  }
  const audio = new Audio(url);
  audio.play().catch(function () {
    showError("Audio could not be played right now.");
  });
}

// ============ FAVORITES (saved in localStorage) ============
function getFavorites() {
  const raw = localStorage.getItem(FAVORITES_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function isFavorite(word) {
  const favorites = getFavorites();
  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].word.toLowerCase() === word.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function handleSaveToggle() {
  if (!currentEntry) {
    return;
  }
  if (isFavorite(currentEntry.word)) {
    removeFavorite(currentEntry.word);
  } else {
    const favorites = getFavorites();
    favorites.push({ word: currentEntry.word, phonetic: getPhonetic(currentEntry) });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    displayFavorites();
  }
  renderWord(currentEntry); // refresh the save button on screen
}

function removeFavorite(word) {
  const favorites = getFavorites();
  const updated = [];
  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].word.toLowerCase() !== word.toLowerCase()) {
      updated.push(favorites[i]);
    }
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  displayFavorites();

  if (currentEntry && currentEntry.word.toLowerCase() === word.toLowerCase()) {
    renderWord(currentEntry);
  }
}

function displayFavorites() {
  const favorites = getFavorites();

  if (favorites.length === 0) {
    favoritesListEl.innerHTML = "";
    favoritesEmptyEl.classList.remove("hidden");
    return;
  }
  favoritesEmptyEl.classList.add("hidden");

  let itemsHtml = "";
  for (let i = 0; i < favorites.length; i++) {
    const favorite = favorites[i];
    itemsHtml += `
      <li class="favorite-item">
        <button type="button" class="favorite-word-btn" data-word="${favorite.word}">
          <span>${favorite.word}</span>
          ${favorite.phonetic ? `<small>${favorite.phonetic}</small>` : ""}
        </button>
        <button type="button" class="favorite-remove-btn" data-word="${favorite.word}" aria-label="Remove ${favorite.word}">✕</button>
      </li>
    `;
  }
  favoritesListEl.innerHTML = itemsHtml;
}

// ============ THEME ============
function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  themeToggleBtn.textContent = isDark ? "☀️ Mwanga mode" : "🌙 Giza mode";
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function restoreTheme() {
  if (localStorage.getItem(THEME_KEY) === "dark") {
    document.body.classList.add("dark-theme");
    themeToggleBtn.textContent = "☀️ Mwanga mode";
  }
}