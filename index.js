//CONSTANTS 
const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";
const FAVORITES_KEY = "wordly_favorites";
const THEME_KEY = "wordly_theme";

//GetElementByid
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

// Holds the currently displayed dictionary entry
let currentEntry = null;

//STARTUP 
document.addEventListener("DOMContentLoaded", function () 
{
    restoreTheme();
    displayFavorites();
});


//EventListeners
// Search form
searchForm.addEventListener("submit", handleSearch);

// Dark mode button
themeToggleBtn.addEventListener("click", toggleTheme);

// Handle buttons created dynamically inside the results
resultsEl.addEventListener("click", function (event) 
{

    if (event.target.closest(".save-btn")) 
    {
        handleSaveToggle();
    }

    const audioBtn = event.target.closest(".audio-btn");

    if (audioBtn && !audioBtn.disabled) 
    {
        playAudio(audioBtn.dataset.audioUrl);
    }

}
);

// Handle buttons inside Saved Words
favoritesListEl.addEventListener("click", function (event) 
{

    const searchAgainBtn =
        event.target.closest(".favorite-word-btn");

         if (searchAgainBtn) 
            {

              wordInput.value = searchAgainBtn.dataset.word;
              fetchWord(searchAgainBtn.dataset.word);

            }

    const removeBtn =
        event.target.closest(".favorite-remove-btn");

    if (removeBtn) {

        removeFavorite(removeBtn.dataset.word);

    }

});

//SEARCH
function handleSearch(event) {

    event.preventDefault();

    const word =
        wordInput.value.trim().toLowerCase();

    hideError();

    if (word === "") {

        // FIX: clear any previous result instead of stacking the
        // error message on top of an old definition
        clearResults();

        showError("Please enter a word.");

        return;

    }

    fetchWord(word);

}

//API 

async function fetchWord(word) {

    setLoading(true);

    hideError();

    clearResults();

    try {

        const response = await fetch(
            API_BASE + encodeURIComponent(word)
        );

        if (response.status === 404) {

            showError(
                "We could not find that word. Check the spelling and try again."
            );

            return;

        }

        if (!response.ok) {

            showError(
                "Something went wrong. Please try again."
            );

            return;

        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {

            showError(
                "Something went wrong. Please try again."
            );

            return;

        }

        renderWord(data[0]);

    }

    catch (error) {

        console.error(error);

        showError(
            "Unable to connect. Please check your internet connection."
        );

    }

    finally 
    {
        setLoading(false);
    }

}

//UI HELPERS
function setLoading(isLoading) {

    loadingEl.classList.toggle(
        "hidden",
        !isLoading
    );

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

// FIX: new helper so both handleSearch and fetchWord can reset the
// results panel back to its empty state consistently
function clearResults() {

    resultsEl.innerHTML = "";

    resultsEl.classList.add("hidden");

    resultsEmptyEl.classList.remove("hidden");

    currentEntry = null;

}


//RENDER WORD

function renderWord(entry) {

    currentEntry = entry;

    const phonetic = getPhonetic(entry);
    const audioUrl = getAudioUrl(entry);
    const saved = isFavorite(entry.word);

    let meaningsHtml = "";

    const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];

    for (let i = 0; i < meanings.length; i++) {

        meaningsHtml += renderMeaning(meanings[i]);

    }

    resultsEl.innerHTML = `
        <h3 class="entry-word">${entry.word}</h3>

        ${phonetic
            ? `<p class="entry-phonetic">${phonetic}</p>`
            : ""
        }

        <div class="entry-actions">

            <button
                type="button"
                class="icon-btn audio-btn"
                ${
                    audioUrl
                        ? `data-audio-url="${audioUrl}"`
                        : "disabled"
                }>
                Voice
            </button>

            <button
                type="button"
                class="icon-btn save-btn ${saved ? "saved" : ""}">
                ${saved ? "★ Saved" : "☆ Save"}
            </button>

        </div>

        ${meaningsHtml}
    `;

    resultsEl.classList.remove("hidden");
    resultsEmptyEl.classList.add("hidden");

}

//RENDER MEANING 

function renderMeaning(meaning) {

    const definitions = Array.isArray(meaning.definitions) ? meaning.definitions : [];

    let definitionsHtml = "";

    const maxDefinitions = Math.min(
        definitions.length,
        3
    );

    for (let i = 0; i < maxDefinitions; i++) {

        const definition = definitions[i];

        const example = definition.example
            ? `<div class="example">"${definition.example}"</div>`
            : "";

        definitionsHtml += `
            <li>
                <div>${definition.definition}</div>
                ${example}
            </li>
        `;

    }

    return `
        <h4 class="part-of-speech">
            ${meaning.partOfSpeech}
        </h4>

        <ol class="definition-list">
            ${definitionsHtml}
        </ol>
    `;

}

//PHONETIC 

function getPhonetic(entry) {

    if (entry.phonetic) {

        return entry.phonetic;

    }

    // FIX: guard against entries where "phonetics" is missing entirely
    if (!Array.isArray(entry.phonetics)) {

        return "";

    }

    for (let i = 0; i < entry.phonetics.length; i++) {

        if (entry.phonetics[i] && entry.phonetics[i].text) {

            return entry.phonetics[i].text;

        }

    }

    return "";

}

//AUDIO

function getAudioUrl(entry) {

    // FIX: same guard here — no phonetics array means no audio, not a crash
    if (!Array.isArray(entry.phonetics)) {

        return "";

    }

    for (let i = 0; i < entry.phonetics.length; i++) {

        if (entry.phonetics[i] && entry.phonetics[i].audio) {

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

        showError(
            "Audio could not be played right now."
        );

    });

}


// FAVORITES 
function getFavorites() {

    const raw = localStorage.getItem(FAVORITES_KEY);

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }

}

function isFavorite(word) {

    const favorites = getFavorites();

    for (let i = 0; i < favorites.length; i++) {

        if (
            favorites[i].word.toLowerCase() ===
            word.toLowerCase()
        ) {
            return true;
        }

    }

    return false;

}

function handleSaveToggle() {

    if (!currentEntry) 
        {
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

        localStorage.setItem(
            FAVORITES_KEY,
            JSON.stringify(favorites)
        );

        displayFavorites();

    }

    // Refresh save button
    renderWord(currentEntry);

}

function removeFavorite(word) {

    const favorites = getFavorites();

    const updated = favorites.filter(function (favorite) {

        return (
            favorite.word.toLowerCase() !==
            word.toLowerCase()
        );

    });

    localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(updated)
    );

    displayFavorites();

    if (
        currentEntry &&
        currentEntry.word.toLowerCase() ===
        word.toLowerCase()
    ) {

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

    let html = "";

    favorites.forEach(function (favorite) {

        html += `
            <li class="favorite-item">

                <button
                    type="button"
                    class="favorite-word-btn"
                    data-word="${favorite.word}">

                    <span>${favorite.word}</span>

                    ${
                        favorite.phonetic
                        ? `<small>${favorite.phonetic}</small>`
                        : ""
                    }

                </button>

                <button
                    type="button"
                    class="favorite-remove-btn"
                    data-word="${favorite.word}"
                    aria-label="Remove ${favorite.word}">

                    ✕
                </button>

            </li>
        `;

    });

    favoritesListEl.innerHTML = html;

}

//THEME
function toggleTheme() 
{
    document.body.classList.toggle("dark-theme");

    const isDark =
        document.body.classList.contains("dark-theme");

    themeToggleBtn.textContent =
        isDark ? "Naona" : "Giz Giz";

    localStorage.setItem(
        THEME_KEY,
        isDark ? "dark" : "light"
    );

}

function restoreTheme() 
{
    const savedTheme =
        localStorage.getItem(THEME_KEY);

    if (savedTheme === "dark") 
    {
        document.body.classList.add("dark-theme");
        themeToggleBtn.textContent = "Light mode";
    } 
    else 
    {
        document.body.classList.remove("dark-theme");
        themeToggleBtn.textContent = "Dark";
    }

};