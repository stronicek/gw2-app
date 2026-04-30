// 1. Spuštění po načtení stránky
window.onload = () => {
    const savedKey = localStorage.getItem('gw2_api_key');
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        loadCharacterList(savedKey);
    }
};

// 2. Logika pro Levé Menu a přepínání stránek
function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

function switchView(viewId) {
    // A. Skryje všechny hlavní sekce a ukáže pouze tu vybranou (home, inventory, settings)
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    
    // B. Zruší zvýraznění u všech tlačítek v levém menu
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    
    // C. Najde správné tlačítko v menu podle ID a zvýrazní ho (i když jsme klikli na dlaždici)
    const activeNavBtn = document.getElementById('nav-' + viewId);
    if(activeNavBtn) {
        activeNavBtn.classList.add('active');
    }
}

// 3. Logika pro Nastavení (Uložení / Smazání klíče)
function saveKey() {
    const newKey = document.getElementById('apiKey').value.trim();
    if (newKey === "") {
        alert("Před uložením vložte klíč.");
        return;
    }
    
    localStorage.setItem('gw2_api_key', newKey);
    
    // Zobrazení potvrzovací fajfky
    const statusMsg = document.getElementById('saveStatus');
    statusMsg.style.display = 'inline';
    setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
    
    // Automatické načtení postav do inventáře
    loadCharacterList(newKey);
}

function deleteKey() {
    if (confirm("Opravdu chceš smazat API klíč? Budeš ho muset zadat znovu.")) {
        localStorage.removeItem('gw2_api_key');
        document.getElementById('apiKey').value = '';
        document.getElementById('charSelect').innerHTML = '<option value="">-- Nejdříve uložte API klíč --</option>';
        document.getElementById('results').innerHTML = '<p style="color: #666;">Vyber postavu z rozbalovacího menu pro načtení batohů.</p>';
        alert('Klíč byl smazán.');
    }
}

// 4. Stahování dat z GW2 API
async function loadCharacterList(apiKey) {
    const select = document.getElementById('charSelect');
    try {
        const response = await fetch(`https://api.guildwars2.com/v2/characters?access_token=${apiKey}`);
        if (!response.ok) throw new Error("Chyba API klíče");
        
        const characters = await response.json();
        select.innerHTML = '<option value="">-- Zvolte postavu --</option>';
        characters.forEach(charName => {
            select.innerHTML += `<option value="${charName}">${charName}</option>`;
        });
    } catch (error) {
        console.error(error);
        select.innerHTML = '<option value="">-- Chybný klíč --</option>';
    }
}

async function loadCharacterInventory() {
    const apiKey = localStorage.getItem('gw2_api_key');
    const selectedChar = document.getElementById('charSelect').value;
    const resultsDiv = document.getElementById('results');

    if (!selectedChar) return;
    if (!apiKey) {
        alert("Chybí GW2 API klíč! Jdi do Nastavení.");
        return;
    }

    resultsDiv.innerHTML = `<em>Načítám batohy pro postavu <strong>${selectedChar}</strong>...</em>`;

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

            resultsDiv.innerHTML += `
                <div class="item ${cssClass}">
                    <img src="${details.icon}" alt="ikona">
                    <div>
                        <strong style="font-size: 1.1em;">${details.name}</strong><br>
                        <span style="color: #666; font-size: 0.9em;">Rarita: <strong>${details.rarity}</strong> | Množství: <strong>${itemData.count}</strong></span><br>
                        <a href="${wikiLink}" target="_blank" style="color: #0055ff; text-decoration: none; font-size: 0.9em;">Otevřít na GW2 Wiki</a><br>
                        
                        <button class="btn" style="font-size: 12px; padding: 5px 10px; margin-top: 5px;" onclick="getWikiSummary('${safeNameForFetch}', '${wikiTextId}')">
                            📖 Načíst a přeložit shrnutí z Wiki
                        </button>
                        <div id="${wikiTextId}" class="wiki-summary"></div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<span style="color:red">Došlo k chybě: ${error.message}</span>`;
    }
}

// 5. Stažení z Wiki a překlad do češtiny
async function getWikiSummary(encodedItemName, elementId) {
    const summaryDiv = document.getElementById(elementId);
    summaryDiv.style.display = "block";
    summaryDiv.innerHTML = "<em>Stahuji a překládám... ⏳</em>";

    const wikiUrl = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodedItemName}&format=json&origin=*`;

    try {
        const wikiResponse = await fetch(wikiUrl);
        const wikiData = await wikiResponse.json();
        
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pageId === "-1" || !pages[pageId].extract) {
            summaryDiv.innerHTML = "<em>Shrnutí pro tento předmět nebylo na Wiki nalezeno.</em>";
            return;
        }

        let englishText = pages[pageId].extract;
        if (englishText.length > 250) {
            englishText = englishText.substring(0, 250) + "...";
        }

        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishText)}&langpair=en|cs`;
        const translateResponse = await fetch(translateUrl);
        const translateData = await translateResponse.json();

        let czechText = "Nepodařilo se přeložit.";
        if (translateData && translateData.responseData && translateData.responseData.translatedText) {
            czechText = translateData.responseData.translatedText;
        }

        summaryDiv.innerHTML = `<strong>O čem to je:</strong> ${czechText}`;

    } catch (error) {
        console.error(error);
        summaryDiv.innerHTML = "<span style='color:red'>Nepodařilo se připojit k Wiki nebo překladači.</span>";
    }
}
