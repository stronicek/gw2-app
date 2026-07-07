// Globální proměnná pro uchování načtených dat z API
let currentInventoryData = [];

window.onload = () => {
    const savedKey = localStorage.getItem('gw2_api_key');
    if (savedKey) {
        document.getElementById('apiKey').value = savedKey;
        loadCharacterList(savedKey);
    }
};

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewId).classList.add('active');
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    
    const activeNavBtn = document.getElementById('nav-' + viewId);
    if(activeNavBtn) activeNavBtn.classList.add('active');
}

function saveKey() {
    const newKey = document.getElementById('apiKey').value.trim();
    if (newKey === "") return alert("Před uložením vložte klíč.");
    
    localStorage.setItem('gw2_api_key', newKey);
    const statusMsg = document.getElementById('saveStatus');
    statusMsg.style.display = 'inline';
    setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
    loadCharacterList(newKey);
}

function deleteKey() {
    if (confirm("Opravdu chceš smazat API klíč?")) {
        localStorage.removeItem('gw2_api_key');
        document.getElementById('apiKey').value = '';
        document.getElementById('charSelect').innerHTML = '<option value="">-- Nejdříve uložte API klíč --</option>';
        document.getElementById('results').innerHTML = '<p style="color: #666;">Vyber postavu z menu pro načtení batohů.</p>';
        document.getElementById('inventory-controls').style.display = 'none';
        alert('Klíč byl smazán.');
    }
}

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
        select.innerHTML = '<option value="">-- Chybný klíč --</option>';
    }
}

// Stáhne data a uloží je do paměti
async function loadCharacterInventory() {
    const apiKey = localStorage.getItem('gw2_api_key');
    const selectedChar = document.getElementById('charSelect').value;
    const resultsDiv = document.getElementById('results');
    const controlsDiv = document.getElementById('inventory-controls');

    if (!selectedChar) {
        controlsDiv.style.display = 'none';
        return;
    }
    
    controlsDiv.style.display = 'none';
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

        // Vyčistíme stará data a uložíme nová, rozšířená o detaily
        currentInventoryData = [];
        allItems.forEach((itemData) => {
            const details = itemDetailsMap[itemData.id];
            if (details) {
                currentInventoryData.push({
                    id: details.id,
                    name: details.name,
                    count: itemData.count,
                    type: details.type,
                    rarity: details.rarity,
                    icon: details.icon
                });
            }
        });

        controlsDiv.style.display = 'flex'; // Zobrazí filtry
        renderInventory(); // Vykreslí seznam

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<span style="color:red">Došlo k chybě připojení.</span>`;
    }
}

// Vykreslování dat na základě vybraných filtrů
function renderInventory() {
    const resultsDiv = document.getElementById('results');
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const rarityFilter = document.getElementById('rarityFilter').value;
    
    resultsDiv.innerHTML = '';
    
    // Vyfiltrování aktuálních dat
    const filteredItems = currentInventoryData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery);
        const matchesRarity = rarityFilter === "" || item.rarity === rarityFilter;
        return matchesSearch && matchesRarity;
    });

    if (filteredItems.length === 0) {
        resultsDiv.innerHTML = "<p style='color: #666;'>Žádné předměty neodpovídají filtru.</p>";
        return;
    }

    // Vykreslení výsledků
    filteredItems.forEach((item, index) => {
        const wikiLink = `https://wiki.guildwars2.com/wiki/${item.name.replace(/ /g, '_')}`;
        
        let cssClass = "";
        if (item.type === "Junk") cssClass = "junk";
        else if (item.type === "CraftingMaterial") cssClass = "material";
        else if (item.rarity === "Rare") cssClass = "rare";
        else if (item.rarity === "Ascended") cssClass = "ascended";
        else if (item.rarity === "Legendary") cssClass = "legendary";

        const wikiTextId = `wiki-response-${index}`;
        const safeNameForFetch = encodeURIComponent(item.name);

        resultsDiv.innerHTML += `
            <div class="item ${cssClass}">
                <img src="${item.icon}" alt="ikona">
                <div>
                    <strong style="font-size: 1.1em;">${item.name}</strong><br>
                    <span style="color: #444; font-size: 0.9em;">
                        Typ: <strong>${item.type}</strong> | Rarita: <strong>${item.rarity}</strong> | Množství: <strong>${item.count}</strong>
                    </span><br>
                    <a href="${wikiLink}" target="_blank" style="color: #0055ff; text-decoration: none; font-size: 0.9em;">Otevřít na GW2 Wiki</a><br>
                    
                    <button class="btn" style="font-size: 12px; padding: 5px 10px; margin-top: 8px;" onclick="getWikiSummary('${safeNameForFetch}', '${wikiTextId}')">
                        📖 Načíst a přeložit shrnutí
                    </button>
                    <div id="${wikiTextId}" class="wiki-summary"></div>
                </div>
            </div>
        `;
    });
}

// Vygenerování a stažení dat ve formátu CSV
function exportToCSV() {
    if (currentInventoryData.length === 0) {
        alert("Není co exportovat.");
        return;
    }

    // Exportujeme jen to, co má uživatel aktuálně vyfiltrované na obrazovce
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    const rarityFilter = document.getElementById('rarityFilter').value;
    
    const filteredItems = currentInventoryData.filter(item => {
        return item.name.toLowerCase().includes(searchQuery) && 
               (rarityFilter === "" || item.rarity === rarityFilter);
    });

    // Vytvoření hlavičky
    let csvContent = "Název,Typ,Rarita,Množství\n";
    
    filteredItems.forEach(item => {
        // Zpracování názvu pro případ, že obsahuje čárku
        let name = item.name.replace(/"/g, '""');
        csvContent += `"${name}","${item.type}","${item.rarity}",${item.count}\n`;
    });

    // Zápis do UTF-8 souboru, aby se správně četly háčky a čárky (BOM marker)
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Virtuální kliknutí pro stažení
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "gw2_inventar.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Stažení z Wiki
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
        if (englishText.length > 250) englishText = englishText.substring(0, 250) + "...";

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
