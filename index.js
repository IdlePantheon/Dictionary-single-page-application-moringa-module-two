// CONSTANTS
const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FAVORITES_KEY = "wordly_favorites";
const THEME_KEY = "wordly_theme";

// GET ELEMENTS FROM THE PAGE
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

// Keeps track of the word that is currently on screen
let currentEntry = null;


// RUN ON PAGE LOAD
document.addEventListener("DOMContentLoaded", function () {
  restoreTheme();
  displayFavorites();
});


// MAIN EVENT LISTENERS
searchForm.addEventListener("submit", handleSearch);
themeToggleBtn.addEventListener("click", toggleTheme);


// SEARCH HANDLING
function handleSearch(event) {
  event.preventDefault();

  const word = wordInput.value.trim().toLowerCase();

  hideError();

    if (word === "") 
        {
            clearResults();
            showError("Please enter a word.");
            return;
        }

  fetchWord(word);
}


// FETCH THE WORD FROM THE API
async function fetchWord(word) {
  setLoading(true);
  hideError();
  clearResults();

  try {
    const response = await fetch(API_BASE + word);

    if (response.status === 404) {
      showError("We could not find that word. Check the spelling and try again.");
      return;
    }

    if (!response.ok) {
      showError("Something went wrong. Please try again.");
      return;
    }

    const data = await response.json();

    if (data.length === 0) {
      showError("Something went wrong. Please try again.");
      return;
    }

    // The API gives back a list of entries — we just use the first one
    renderWord(data[0]);

  } catch (error) {
    console.error(error);
    showError("Unable to connect. Please check your internet connection.");
  } finally {
    setLoading(false);
  }
}


// SMALL HELPER FUNCTIONS FOR LOADING
function setLoading(isLoading) {
    if (isLoading) 
        {
            loadingEl.classList.remove("hidden");
            searchBtn.disabled = true;
        } 
    else 
        {
            loadingEl.classList.add("hidden");
             searchBtn.disabled = false;
        }
}

//ERROR FUCTIONS
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function hideError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function clearResults() {
  resultsEl.innerHTML = "";
  resultsEl.classList.add("hidden");
  resultsEmptyEl.classList.remove("hidden");
  currentEntry = null;
}


// FIND THE PHONETIC TEXT (e.g. "/heˈloʊ/")

function getPhonetic(entry) {
  if (entry.phonetic) {
    return entry.phonetic;
  }

  if (!entry.phonetics) {
    return "";
  }

  for (let i = 0; i < entry.phonetics.length; i++) {
    if (entry.phonetics[i].text) {
      return entry.phonetics[i].text;
    }
  }

  return "";
}


// FIND AN AUDIO LINK, IF ONE EXISTS

function getAudioUrl(entry) {
  if (!entry.phonetics) {
    return "";
  }

  for (let i = 0; i < entry.phonetics.length; i++) {
    if (entry.phonetics[i].audio) {
      return entry.phonetics[i].audio;
    }
  }

  return "";
}


// BUILD THE HTML FOR ONE MEANING (e.g. "noun")

function buildMeaningHtml(meaning) {
  let definitionsHtml = "";

  const maxDefinitions = Math.min(meaning.definitions.length, 3);

  for (let i = 0; i < maxDefinitions; i++) {
    const definition = meaning.definitions[i];

    definitionsHtml += "<li><div>" + definition.definition + "</div>";

    if (definition.example) {
      definitionsHtml += '<div class="example">"' + definition.example + '"</div>';
    }

    definitionsHtml += "</li>";
  }

  let meaningHtml = '<h4 class="part-of-speech">' + meaning.partOfSpeech + "</h4>";
  meaningHtml += '<ol class="definition-list">' + definitionsHtml + "</ol>";

  return meaningHtml;
}


// SHOW THE WORD ON THE PAGE
function renderWord(entry) 
{
  currentEntry = entry;

  const phonetic = getPhonetic(entry);
  const audioUrl = getAudioUrl(entry);
  const saved = isFavorite(entry.word);

  // Build the meanings section
  let meaningsHtml = "";
  for (let i = 0; i < entry.meanings.length; i++) {
    meaningsHtml += buildMeaningHtml(entry.meanings[i]);
  }

  // Build the phonetic line (only if we found one)
  let phoneticHtml = "";
  if (phonetic !== "") {
    phoneticHtml = '<p class="entry-phonetic">' + phonetic + "</p>";
  }

  // Build the save button label
  let saveLabel = "☆ Save";
  let saveClass = "icon-btn save-btn";
  if (saved) {
    saveLabel = "★ Saved";
    saveClass = "icon-btn save-btn saved";
  }

  // Build the audio button — disabled if there is no audio
  let audioButtonHtml;
  if (audioUrl !== "") {
    audioButtonHtml = '<button type="button" id="audioBtn" class="icon-btn">Voice</button>';
  } else {
    audioButtonHtml = '<button type="button" id="audioBtn" class="icon-btn" disabled>Voice</button>';
  }

  resultsEl.innerHTML =
    '<h3 class="entry-word">' + entry.word + "</h3>" +
    phoneticHtml +
    '<div class="entry-actions">' +
      audioButtonHtml +
      '<button type="button" id="saveBtn" class="' + saveClass + '">' + saveLabel + "</button>" +
    "</div>" +
    meaningsHtml;

  resultsEl.classList.remove("hidden");
  resultsEmptyEl.classList.add("hidden");

  // Now that the buttons exist on the page, connect them to their functions
  const audioBtn = document.getElementById("audioBtn");
  audioBtn.addEventListener("click", function () {
    playAudio(audioUrl);
  });

  const saveBtn = document.getElementById("saveBtn");
  saveBtn.addEventListener("click", function () {
    handleSaveToggle();
  });
}


// PLAY THE AUDIO

function playAudio(url) {
  if (url === "") {
    return;
  }

  const audio = new Audio(url);
  audio.play().catch(function () {
    showError("Audio could not be played right now.");
  });
}


// FAVORITES — READ FROM LOCAL STORAGE

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


// SAVE OR REMOVE THE CURRENT WORD

function handleSaveToggle() {
  if (!currentEntry) {
    return;
  }

  if (isFavorite(currentEntry.word)) {
    removeFavorite(currentEntry.word);
  } else {
    const favorites = getFavorites();
    favorites.push({
      word: currentEntry.word,
      phonetic: getPhonetic(currentEntry)
    });
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    displayFavorites();
  }

  // Re-draw the word so the save button updates too
  renderWord(currentEntry);
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


// SHOW THE SAVED WORDS LIST

function displayFavorites() 
{
    const favorites = getFavorites();

    if (favorites.length === 0) 
        {
            favoritesListEl.innerHTML = "";
            favoritesEmptyEl.classList.remove("hidden");
            return;
        }

  favoritesEmptyEl.classList.add("hidden");

  let html = "";
  for (let i = 0; i < favorites.length; i++) 
    {
        const favorite = favorites[i];

        let phoneticHtml = "";
        if (favorite.phonetic) 
            {
                phoneticHtml = "<small>" + favorite.phonetic + "</small>";
            }

        html +=
                '<li class="favorite-item">' +
                '<button type="button" class="favorite-word-btn">' +
                "<span>" 
                + favorite.word + 
                "</span>" +
          phoneticHtml +
        "</button>" +
        '<button type="button" class="favorite-remove-btn">✕</button>' +
      "</li>";
    }

  favoritesListEl.innerHTML = html;

  // Connect each word button and each remove button to its function.
  // Using "let" in the loop means each button remembers its own word.
  const wordButtons = favoritesListEl.querySelectorAll(".favorite-word-btn");
  const removeButtons = favoritesListEl.querySelectorAll(".favorite-remove-btn");

  for (let i = 0; i < favorites.length; i++) {
    const word = favorites[i].word;

    wordButtons[i].addEventListener
    ("click", function () 
        {
            wordInput.value = word;
            fetchWord(word);
        }
    );

    removeButtons[i].addEventListener
    ("click", function () 
        {
            removeFavorite(word);
        }
    );
  }
}


// DARK / LIGHT THEME
function toggleTheme() 
{
    document.body.classList.toggle("dark-theme");

    const isDark = document.body.classList.contains("dark-theme");

        
    if (isDark) 
        {
            themeToggleBtn.textContent = "Giza";
        } 
    else 
        {
            themeToggleBtn.textContent = "Naona";
        }

  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
}

function restoreTheme() 
{
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark") 
        {
            document.body.classList.add("dark-theme");
            themeToggleBtn.textContent = "Giza";
        } 
    else 
        {
            document.body.classList.remove("dark-theme");
            themeToggleBtn.textContent = "Naona";
        }
}