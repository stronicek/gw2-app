// INICIALIZACE PŘI NAČTENÍ APLIKACE
window.onload = () => {
    // Načtení uložených preferencí
    const savedKey = localStorage.getItem('gw2_api_key');
    const savedTheme = localStorage.getItem('gw2_theme') || 'light';
    const savedLang = localStorage.getItem('gw2_lang') || 'cs';

    // Aplikace preferencí do formulářů
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        loadCharacterList(savedKey); // Dotáhne postavy do inventáře
    }
    
    document.getElementById('themeSelect').value = savedTheme;
    document.getElementById('langSelect').value = savedLang;
    
    // Aplikace tématu
    document.body.setAttribute('data-theme', savedTheme);
};

// 1. OVLÁDÁNÍ MENU A BOČNÍHO PANELU
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('expanded');
}

function switchView(viewName) {
    // Skryje všechny sekce a zobrazí jen tu vybranou
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    // Zvýrazní aktivní tlačítko v bočním menu
    document.querySelectorAll('#sidebar button').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewName}`).classList.add('active');
}

// 2. FUNKCE PRO NASTAVENÍ (Ukládání)
function saveApiKey() {
    const keyInput = document.getElementById('apiKey').value.trim();
    if (keyInput.length < 20) {
        alert("Zadaný klíč je příliš krátký nebo neplatný.");
        return;
    }
    localStorage.setItem('gw2_api_key', keyInput);
    alert("API klíč úspěšně uložen!");
    loadCharacterList(keyInput); // Rovnou aktualizuje seznam postav v inventáři
}

function deleteApiKey() {
    if(confirm("Opravdu chcete smazat API klíč z tohoto zařízení?")) {
        localStorage.removeItem('gw2_api_key');
        document.getElementById('apiKey').value = '';
        document.getElementById('charSelect').innerHTML = '<option value="">-- Nejdříve uložte API klíč --</option>';
        document.getElementById('results').innerHTML = '<p class="text-muted">Inventář se zobrazí zde...</p>';
        alert("API klíč byl smazán.");
    }
}

function saveTheme() {
    const theme = document.getElementById('themeSelect').value;
    localStorage.setItem('gw2_theme', theme);
    document.body.setAttribute('data-theme', theme);
}

function saveLang() {
    const lang = document.getElementById('langSelect').value;
    localStorage.setItem('gw2_lang', lang);
}

// 3. LOGIKA INVENTÁŘE
async function loadCharacterList(apiKey) {
    const select = document.getElementById('charSelect');
    try {
        const response = await fetch(`https://api.guildwars2.com/v2/characters?access_token=${apiKey}`);
        if (!response.ok) throw new Error("Neplatný klíč");
        
        const characters = await response.json();
        select.innerHTML = '<option value="">-- Zvolte postavu --</option>';
        characters.forEach(charName => {
            select.innerHTML += `<option value="${charName}">${charName}</option>`;
        });
    } catch (error) {
        select.innerHTML = '<option value="">-- Chyba načítání (Zkontrolujte API klíč) --</option>';
    }
}

async function loadCharacterInventory() {
    const apiKey = localStorage.getItem('gw2_api_key');
    const selectedChar = document.getElementById('charSelect').value;
    const resultsDiv = document.getElementById('results');

    if (!selectedChar) return;

    resultsDiv.innerHTML = `<p><em>Načítám batohy pro postavu <strong>${selectedChar}</strong>...</em></p>`;

    try {
        const invResponse = await fetch(`https://api.guildwars2.com/v2/characters/${selectedChar}/inventory?access_token=${apiKey}`);
        const inventoryData = await invResponse.json();

        let allItems = [];
        inventoryData.bags.forEach(bag => {
            if (bag && bag.inventory) {
                const validItems = bag.inventory.filter(item => item !== null);
                allItems.push(...validItems);
            }
        });

        if (allItems.length === 0) {
            resultsDiv.innerHTML = "<p>Inventář je prázdný.</p>";
            return;
        }

        const uniqueIds = [...new Set(allItems.map(item => item.id))].slice(0, 200);
        const idsString = uniqueIds.join(',');
        
        const itemsResponse = await fetch(`https://api.guildwars2.com/v2/items?ids=${idsString}`);
        const itemDetailsArray = await itemsResponse.json();
        
        const itemDetailsMap = {};
        itemDetailsArray.forEach(detail => {
            itemDetailsMap[detail.id] = detail;
        });

        resultsDiv.innerHTML = ``;
        
        allItems.forEach((itemData, index) => {
            const details = itemDetailsMap[itemData.id];
            if (!details) return;

            const wikiLink = `https://wiki.guildwars2.com/wiki/${details.name.replace(/ /g, '_')}`;
            let cssClass = "";
            if (details.type === "Junk") cssClass = "junk";
            else if (details.type === "CraftingMaterial") cssClass = "material";
            else if (details.rarity === "Rare") cssClass = "rare";
            else if (details.rarity === "Ascended") cssClass = "ascended";
            else if (details.rarity === "Legendary") cssClass = "legendary";

            const wikiTextId = `wiki-response-${index}`;
            const safeNameForFetch = encodeURIComponent(details.name);

            // Tlačítko se přizpůsobí podle zvoleného jazyka
            const lang = localStorage.getItem('gw2_lang') || 'cs';
            const btnText = lang === 'cs' ? '📖 Přeložit shrnutí z Wiki' : '📖 Načíst z Wiki (EN)';

            resultsDiv.innerHTML += `
                <div class="item ${cssClass}">
                    <img src="${details.icon}" alt="${details.name}">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 1.1rem; margin-bottom: 2px;">${details.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Rarita: <strong>${details.rarity}</strong> &nbsp;|&nbsp; Množství: <strong>${itemData.count}</strong></div>
                        <a href="${wikiLink}" class="wiki-link" target="_blank">Otevřít Wiki ↗</a><br>
                        
                        <button class="btn-action" style="margin-top: 10px; font-size: 13px; padding: 5px 10px;" onclick="getWikiSummary('${safeNameForFetch}', '${wikiTextId}')">
                            ${btnText}
                        </button>
                        <div id="${wikiTextId}" class="wiki-summary"></div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<p style="color:var(--gw2-red); font-weight:bold;">Došlo k chybě připojení.</p>`;
    }
}

// 4. STAŽENÍ WIKI A VOLITELNÝ PŘEKLAD
async function getWikiSummary(encodedItemName, elementId) {
    const summaryDiv = document.getElementById(elementId);
    const lang = localStorage.getItem('gw2_lang') || 'cs';
    
    summaryDiv.style.display = "block";
    summaryDiv.innerHTML = lang === 'cs' ? "<em>Stahuji a překládám... ⏳</em>" : "<em>Loading from Wiki... ⏳</em>";

    const wikiUrl = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodedItemName}&format=json&origin=*`;

    try {
        const wikiResponse = await fetch(wikiUrl);
        const wikiData = await wikiResponse.json();
        
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pageId === "-1" || !pages[pageId].extract) {
            summaryDiv.innerHTML = lang === 'cs' ? "<em>Shrnutí pro tento předmět nebylo nalezeno.</em>" : "<em>Summary not found on Wiki.</em>";
            return;
        }

        let extractText = pages[pageId].extract;
        if (extractText.length > 250) {
            extractText = extractText.substring(0, 250) + "...";
        }

        // Pokud je jazyk nastaven na EN, rovnou vypíšeme anglický text a skončíme
        if (lang === 'en') {
            summaryDiv.innerHTML = `<strong>Summary:</strong> ${extractText}`;
            return;
        }

        // Pokud je jazyk CZ, pošleme text do překladače
        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(extractText)}&langpair=en|cs`;
        const translateResponse = await fetch(translateUrl);
        const translateData = await translateResponse.json();

        let finalCzText = "Nepodařilo se přeložit.";
        if (translateData && translateData.responseData && translateData.responseData.translatedText) {
            finalCzText = translateData.responseData.translatedText;
        }

        summaryDiv.innerHTML = `<strong>O čem to je:</strong> ${finalCzText}`;

    } catch (error) {
        console.error(error);
        summaryDiv.innerHTML = "<span style='color:var(--gw2-red)'>Chyba spojení.</span>";
    }
}
