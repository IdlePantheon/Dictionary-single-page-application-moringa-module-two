// =========================================================
// CONSTANTS
// =========================================================
const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FAVORITES_KEY = "wordly_favorites";
const THEME_KEY = "wordly_theme";

// =========================================================
// ELEMENT REFERENCES
// =========================================================
const searchForm = document.getElementById("searchForm");
const wordInput = document.getElementById("wordInput");
const searchBtn = document.getElementById("searchBtn");
const loadingEl = document.getElementById("loading");
const errorEl = document.getElementById("errorMessage");
const resultsEl = document.getElementById("results");
const themeToggleBtn = document.getElementById("themeToggle");
const favoritesListEl = document.getElementById("favoritesList");
const favoritesEmptyEl = document.getElementById("favoritesEmpty");

// The word currently shown in the results panel (used by the save button)
let currentEntry = null;

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener("DOMContentLoaded", function () {
  displayFavorites();
  restoreTheme();
});

// =========================================================
// EVENT LISTENERS
// =========================================================
searchForm.addEventListener("submit", handleSearch);
themeToggleBtn.addEventListener("click", toggleTheme);

// Event delegation for buttons created dynamically inside the result card
resultsEl.addEventListener("click", function (event) {
  const saveBtn = event.target.closest(".save-btn");
  const audioBtn = event.target.closest(".audio-btn");

  if (saveBtn && currentEntry) {
    handleSaveToggle(currentEntry);
  }

  if (audioBtn && !audioBtn.disabled) {
    playAudio(audioBtn.getAttribute("data-audio-url"), audioBtn);
  }
});

// Event delegation for the favorites list (search-again + remove)
favoritesListEl.addEventListener("click", function (event) {
  const searchAgainBtn = event.target.closest(".favorite-word-btn");
  const removeBtn = event.target.closest(".favorite-remove-btn");

  if (searchAgainBtn) {
    const word = searchAgainBtn.getAttribute("data-word");
    wordInput.value = word;
    fetchWord(word);
  }

  if (removeBtn) {
    const word = removeBtn.getAttribute("data-word");
    removeFavorite(word);
  }
});

// =========================================================
// FUNCTION: handleSearch
// =========================================================
function handleSearch(event) {
  event.preventDefault();

  const rawValue = wordInput.value;
  const word = rawValue.trim().toLowerCase();

  clearError();

  if (word === "") {
    displayError("Please enter a word.");
    return;
  }

  clearResults();
  fetchWord(word);
}

// =========================================================
// FUNCTION: fetchWord
// Fetches data for a given word from the Free Dictionary API.
// =========================================================
async function fetchWord(word) {
  setLoading(true);
  clearError();

  try {
    const response = await fetch(API_BASE + encodeURIComponent(word));

    if (response.status === 404) {
      displayError("We could not find that word. Check the spelling and try again.");
      return;
    }

    if (!response.ok) {
      displayError("Something went wrong while loading the definition. Please try again.");
      return;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0 || !data[0]) {
      displayError("Something went wrong while loading the definition. Please try again.");
      return;
    }

    displayWord(data[0]);
  } catch (error) {
    displayError("Something went wrong while loading the definition. Please try again.");
  } finally {
    setLoading(false);
  }
}

// =========================================================
// FUNCTION: setLoading
// Toggles the loading indicator and disables the search button.
// =========================================================
function setLoading(isLoading) {
  if (isLoading) {
    loadingEl.classList.remove("hidden");
    searchBtn.disabled = true;
  } else {
    loadingEl.classList.add("hidden");
    searchBtn.disabled = false;
  }
}

// =========================================================
// FUNCTION: displayError / clearError
// =========================================================
function displayError(message) {
  resultsEl.classList.add("hidden");
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

// =========================================================
// FUNCTION: clearResults
// =========================================================
function clearResults() {
  resultsEl.innerHTML = "";
  resultsEl.classList.add("hidden");
  currentEntry = null;
}

// =========================================================
// FUNCTION: getAudioUrl
// Returns the first non-empty audio URL found in the phonetics array,
// or an empty string if none exists.
// =========================================================
function getAudioUrl(entry) {
  if (!entry.phonetics || !Array.isArray(entry.phonetics)) {
    return "";
  }
  for (let i = 0; i < entry.phonetics.length; i++) {
    if (entry.phonetics[i] && entry.phonetics[i].audio) {
      return entry.phonetics[i].audio;
    }
  }
  return "";
}

// =========================================================
// FUNCTION: getSynonyms
// Combines definition-level and meaning-level synonyms and removes
// duplicates (case-insensitive).
// =========================================================
function getSynonyms(definition, meaning) {
  const combined = [];

  if (definition.synonyms && Array.isArray(definition.synonyms)) {
    for (let i = 0; i < definition.synonyms.length; i++) {
      combined.push(definition.synonyms[i]);
    }
  }

  if (meaning.synonyms && Array.isArray(meaning.synonyms)) {
    for (let i = 0; i < meaning.synonyms.length; i++) {
      combined.push(meaning.synonyms[i]);
    }
  }

  // De-duplicate case-insensitively while keeping the original casing
  const seen = [];
  const unique = [];
  for (let i = 0; i < combined.length; i++) {
    const lower = combined[i].toLowerCase();
    if (seen.indexOf(lower) === -1) {
      seen.push(lower);
      unique.push(combined[i]);
    }
  }

  return unique;
}

// =========================================================
// FUNCTION: playAudio
// Plays a pronunciation clip and shows a friendly message if it fails.
// =========================================================
function playAudio(audioUrl, buttonEl) {
  if (!audioUrl) {
    return;
  }

  // Remove any previous playback error message
  const existingError = buttonEl.parentElement.querySelector(".audio-error");
  if (existingError) {
    existingError.remove();
  }

  const audio = new Audio(audioUrl);
  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(function () {
      const msg = document.createElement("p");
      msg.className = "audio-error";
      msg.textContent = "Audio could not be played right now.";
      buttonEl.parentElement.appendChild(msg);
    });
  }
}

// =========================================================
// FUNCTION: displayWord
// Builds and renders the DOM for a single dictionary entry.
// =========================================================
function displayWord(entry) {
  if (!entry || typeof entry !== "object" || !entry.word) {
    displayError("Something went wrong while loading the definition. Please try again.");
    return;
  }

  currentEntry = entry;
  resultsEl.innerHTML = "";

  // ---- Phonetic text: top-level field, else first non-empty phonetics[].text ----
  let phoneticText = entry.phonetic || "";
  if (!phoneticText && Array.isArray(entry.phonetics)) {
    for (let i = 0; i < entry.phonetics.length; i++) {
      if (entry.phonetics[i] && entry.phonetics[i].text) {
        phoneticText = entry.phonetics[i].text;
        break;
      }
    }
  }

  const audioUrl = getAudioUrl(entry);

  // ---- Card container ----
  const card = document.createElement("div");
  card.className = "entry-card";

  // ---- Header ----
  const head = document.createElement("div");
  head.className = "entry-head";

  const titleWrap = document.createElement("div");
  const titleEl = document.createElement("h2");
  titleEl.className = "entry-word";
  titleEl.textContent = entry.word;
  titleWrap.appendChild(titleEl);

  if (phoneticText) {
    const phoneticEl = document.createElement("p");
    phoneticEl.className = "entry-phonetic";
    phoneticEl.textContent = phoneticText;
    titleWrap.appendChild(phoneticEl);
  }

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  // Audio button — only created/enabled when an audio URL exists
  const audioBtn = document.createElement("button");
  audioBtn.type = "button";
  audioBtn.className = "icon-btn audio-btn";
  audioBtn.textContent = "🔊";
  if (audioUrl) {
    audioBtn.setAttribute("data-audio-url", audioUrl);
    audioBtn.setAttribute("aria-label", "Play pronunciation");
  } else {
    audioBtn.disabled = true;
    audioBtn.setAttribute("aria-label", "No audio available");
  }
  actions.appendChild(audioBtn);

  // Save button
  const isSaved = isFavorite(entry.word);
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "icon-btn save-btn" + (isSaved ? " saved" : "");
  saveBtn.textContent = isSaved ? "★ Saved" : "☆ Save";
  saveBtn.setAttribute("aria-label", isSaved ? "Remove from favorites" : "Save this word");
  actions.appendChild(saveBtn);

  head.appendChild(titleWrap);
  head.appendChild(actions);
  card.appendChild(head);

  // ---- Meanings ----
  if (Array.isArray(entry.meanings)) {
    for (let m = 0; m < entry.meanings.length; m++) {
      const meaning = entry.meanings[m];
      if (!meaning || !Array.isArray(meaning.definitions)) {
        continue;
      }

      const meaningBlock = document.createElement("div");
      meaningBlock.className = "meaning-block";

      const posTag = document.createElement("h3");
      posTag.className = "part-of-speech";
      posTag.textContent = meaning.partOfSpeech || "meaning";
      meaningBlock.appendChild(posTag);

      const defList = document.createElement("ol");
      defList.className = "definition-list";

      const maxDefs = Math.min(meaning.definitions.length, 3);
      for (let d = 0; d < maxDefs; d++) {
        const def = meaning.definitions[d];
        if (!def || !def.definition) {
          continue;
        }

        const li = document.createElement("li");

        const defText = document.createElement("div");
        defText.textContent = def.definition;
        li.appendChild(defText);

        // Example — only shown when it exists
        if (def.example) {
          const exampleText = document.createElement("div");
          exampleText.className = "example";
          exampleText.textContent = '"' + def.example + '"';
          li.appendChild(exampleText);
        }

        // Synonyms — combined + deduped, only shown when non-empty
        const synonyms = getSynonyms(def, meaning);
        if (synonyms.length > 0) {
          const synWrap = document.createElement("div");
          synWrap.className = "synonyms";

          const label = document.createElement("span");
          label.className = "label";
          label.textContent = "Synonyms: ";
          synWrap.appendChild(label);

          for (let s = 0; s < synonyms.length; s++) {
            const chip = document.createElement("span");
            chip.className = "synonym-chip";
            chip.textContent = synonyms[s];
            synWrap.appendChild(chip);
          }
          li.appendChild(synWrap);
        }

        defList.appendChild(li);
      }

      meaningBlock.appendChild(defList);
      card.appendChild(meaningBlock);
    }
  }

  // ---- Source link — only shown when a valid URL exists ----
  if (Array.isArray(entry.sourceUrls) && entry.sourceUrls.length > 0 && entry.sourceUrls[0]) {
    const sourceLine = document.createElement("div");
    sourceLine.className = "source-line";

    const sourceLabel = document.createTextNode("Source: ");
    const sourceLink = document.createElement("a");
    sourceLink.href = entry.sourceUrls[0];
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener";
    sourceLink.textContent = entry.sourceUrls[0];

    sourceLine.appendChild(sourceLabel);
    sourceLine.appendChild(sourceLink);
    card.appendChild(sourceLine);
  }

  resultsEl.appendChild(card);
  resultsEl.classList.remove("hidden");
}

// =========================================================
// FUNCTION: handleSaveToggle
// Adds or removes the current entry from favorites and refreshes the
// save button in the results panel.
// =========================================================
function handleSaveToggle(entry) {
  if (isFavorite(entry.word)) {
    removeFavorite(entry.word);
  } else {
    let phoneticText = entry.phonetic || "";
    if (!phoneticText && Array.isArray(entry.phonetics)) {
      for (let i = 0; i < entry.phonetics.length; i++) {
        if (entry.phonetics[i] && entry.phonetics[i].text) {
          phoneticText = entry.phonetics[i].text;
          break;
        }
      }
    }
    saveFavorite(entry.word, phoneticText);
  }

  // Refresh the save button in the current results view
  const saveBtn = resultsEl.querySelector(".save-btn");
  if (saveBtn) {
    const nowSaved = isFavorite(entry.word);
    saveBtn.classList.toggle("saved", nowSaved);
    saveBtn.textContent = nowSaved ? "★ Saved" : "☆ Save";
    saveBtn.setAttribute("aria-label", nowSaved ? "Remove from favorites" : "Save this word");
  }
}

// =========================================================
// FUNCTION: getFavorites
// Reads and parses the saved favorites array from localStorage.
// Returns an empty array if storage is missing, empty, or invalid.
// =========================================================
function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    return [];
  }
}

// =========================================================
// FUNCTION: isFavorite
// Case-insensitive check for whether a word is already saved.
// =========================================================
function isFavorite(word) {
  const favorites = getFavorites();
  const lowerWord = word.toLowerCase();
  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].word.toLowerCase() === lowerWord) {
      return true;
    }
  }
  return false;
}

// =========================================================
// FUNCTION: saveFavorite
// Stores a word (and its phonetic text) in localStorage, preventing
// case-insensitive duplicates.
// =========================================================
function saveFavorite(word, phonetic) {
  const favorites = getFavorites();
  const lowerWord = word.toLowerCase();

  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].word.toLowerCase() === lowerWord) {
      return; // already saved — do nothing
    }
  }

  favorites.push({ word: word, phonetic: phonetic || "" });
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  displayFavorites();
}

// =========================================================
// FUNCTION: removeFavorite
// Removes a word from localStorage (case-insensitive match).
// =========================================================
function removeFavorite(word) {
  const favorites = getFavorites();
  const lowerWord = word.toLowerCase();
  const updated = [];

  for (let i = 0; i < favorites.length; i++) {
    if (favorites[i].word.toLowerCase() !== lowerWord) {
      updated.push(favorites[i]);
    }
  }

  localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  displayFavorites();

  // Update the save button in the current result if it matches
  if (currentEntry && currentEntry.word.toLowerCase() === lowerWord) {
    const saveBtn = resultsEl.querySelector(".save-btn");
    if (saveBtn) {
      saveBtn.classList.remove("saved");
      saveBtn.textContent = "☆ Save";
      saveBtn.setAttribute("aria-label", "Save this word");
    }
  }
}

// =========================================================
// FUNCTION: displayFavorites
// Renders the favorites list from localStorage.
// =========================================================
function displayFavorites() {
  const favorites = getFavorites();
  favoritesListEl.innerHTML = "";

  if (favorites.length === 0) {
    favoritesEmptyEl.classList.remove("hidden");
    return;
  }

  favoritesEmptyEl.classList.add("hidden");

  for (let i = 0; i < favorites.length; i++) {
    const favorite = favorites[i];

    const li = document.createElement("li");
    li.className = "favorite-item";
    if (currentEntry && currentEntry.word.toLowerCase() === favorite.word.toLowerCase()) {
      li.classList.add("active");
    }

    const wordBtn = document.createElement("button");
    wordBtn.type = "button";
    wordBtn.className = "favorite-word-btn";
    wordBtn.setAttribute("data-word", favorite.word);
    wordBtn.setAttribute("aria-label", "Search saved word: " + favorite.word);

    const wordSpan = document.createElement("span");
    wordSpan.className = "favorite-word";
    wordSpan.textContent = favorite.word;
    wordBtn.appendChild(wordSpan);

    if (favorite.phonetic) {
      const phoneticSpan = document.createElement("span");
      phoneticSpan.className = "favorite-phonetic";
      phoneticSpan.textContent = favorite.phonetic;
      wordBtn.appendChild(phoneticSpan);
    }

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "favorite-remove-btn";
    removeBtn.setAttribute("data-word", favorite.word);
    removeBtn.setAttribute("aria-label", "Remove " + favorite.word + " from favorites");
    removeBtn.textContent = "✕";

    li.appendChild(wordBtn);
    li.appendChild(removeBtn);
    favoritesListEl.appendChild(li);
  }
}

// =========================================================
// FUNCTION: toggleTheme / restoreTheme
// =========================================================
function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  themeToggleBtn.textContent = isDark ? "☀️ Light mode" : "🌙 Dark mode";
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function restoreTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark") {
    document.body.classList.add("dark-theme");
    themeToggleBtn.textContent = "☀️ Light mode";
  }
}