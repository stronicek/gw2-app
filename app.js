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

async function loadCharacterInventory() {
    const apiKey = localStorage.getItem('gw2_api_key');
    const selectedChar = document.getElementById('charSelect').value;
    const resultsDiv = document.getElementById('results');
    const controlsDiv = document.getElementById('inventory-controls');

    document.getElementById('searchInput').value = '';
    document.getElementById('rarityFilter').value = '';

    if (!selectedChar) {
        controlsDiv.style.display = 'none';
        return;
    }
    
    controlsDiv.style.display = 'none';
    resultsDiv.innerHTML = `<em>Načítám batohy pro postavu <strong>${selectedChar}</strong>...</em>`;

    try {
        const invResponse = await fetch(`https://api.guildwars2.com/v2/characters/${selectedChar}/inventory?access_token=${apiKey}`);
        if (!invResponse.ok) throw new Error("Chyba při stahování inventáře.");
        
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
        if (!itemsResponse.ok) throw new Error("Chyba při načítání detailů předmětů.");
        
        const itemDetailsArray = await itemsResponse.json();
        const itemDetailsMap = {};
        itemDetailsArray.forEach(detail => {
            itemDetailsMap[detail.id] = detail;
        });

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

        if (currentInventoryData.length === 0) throw new Error("Předměty se nepodařilo spárovat s databází API.");

        controlsDiv.style.display = 'flex';
        renderInventory();

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<span style="color:red">Došlo k chybě: ${error.message}</span>`;
    }
}

// LOKÁLNÍ AI ASISTENT PRO HERNÍ RADY
function getSmartAdvice(item) {
    const name = item.name.toLowerCase();
    
    if (item.type === "Junk") return "Vendor trash. Prodej u jakéhokoliv obchodníka přes tlačítko 'Sell Junk'.";
    if (item.type === "CraftingMaterial") return "Materiál k výrobě. V inventáři klikni na ozubené kolečko a dej 'Deposit All Materials'.";
    
    if (name.includes("unidentified gear")) {
        if (item.rarity === "Rare") return "Klikni pravým -> 'Use All'. Získané žluté věci rozeber Master's nebo Mystic kitem kvůli Ectoplasmům.";
        return "Klikni pravým -> 'Use All'. Získané věci rozeber obyčejným (Basic) kitem na suroviny.";
    }
    
    if (item.type === "Container") return "Dvojklikem rozbal a podívej se na loot uvnitř.";
    if (item.type === "Consumable") return "Dočasný buff (jídlo/potion), teleport, nebo odemčení. Přečti si popisek a zkonzumuj, nebo prodej na Trading Postu.";
    if (item.type === "UpgradeComponent") return "Vylepšení do zbroje/zbraně. Schovej si ho, nebo zkontroluj cenu na Trading Postu (často se dají dobře prodat).";
    
    if (item.type === "Armor" || item.type === "Weapon") {
        if (item.rarity === "Ascended" || item.rarity === "Legendary") return "Nejsilnější výbava! Určitě si to schovej v bance na později.";
        if (item.rarity === "Exotic") return "Pokud to nevyužiješ, zkontroluj cenu na Trading Postu. Pokud je levná, rozeber ji.";
        return "Rozeber příslušným Salvage kitem, abys získal suroviny a uvolnil místo.";
    }
    
    if (item.type === "Trophy") return "Často součást příběhu nebo sbírky (Collection). Pokud už je sbírka hotová, můžeš bezpečně zničit.";
    
    return "Neznámý předmět. Schovej ho do banky a zjisti víc pomocí tlačítka Wiki.";
}

function renderInventory() {
    const resultsDiv = document.getElementById('results');
    
    const searchInput = document.getElementById('searchInput');
    const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const raritySelect = document.getElementById('rarityFilter');
    const rarityFilter = raritySelect ? raritySelect.value : "";
    
    const filteredItems = currentInventoryData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery);
        const matchesRarity = rarityFilter === "" || item.rarity === rarityFilter;
        return matchesSearch && matchesRarity;
    });

    if (filteredItems.length === 0) {
        resultsDiv.innerHTML = "<p style='color: #666; padding: 20px 0;'>Žádné předměty neodpovídají filtru.</p>";
        return;
    }

    // Začátek HTML Tabulky
    let tableHTML = `
        <table class="inventory-table">
            <thead>
                <tr>
                    <th colspan="2">Předmět</th>
                    <th>Typ</th>
                    <th>Rarita</th>
                    <th>K čemu slouží</th>
                    <th>Co s tím (Chytrá rada)</th>
                    <th>Wiki</th>
                </tr>
            </thead>
            <tbody>
    `;

    filteredItems.forEach((item, index) => {
        const wikiLink = `https://wiki.guildwars2.com/wiki/${item.name.replace(/ /g, '_')}`;
        const safeNameForFetch = encodeURIComponent(item.name);
        const wikiTextId = `wiki-response-${index}`;
        
        // Získáme automatickou radu
        const advice = getSmartAdvice(item);

        tableHTML += `
            <tr>
                <td class="td-icon"><img src="${item.icon}" alt="icon"></td>
                <td>
                    <strong>${item.name}</strong><br>
                    <span style="color:#666; font-size:12px;">Množství: ${item.count}</span>
                </td>
                <td>${item.type}</td>
                <td class="rarity-${item.rarity}">${item.rarity}</td>
                <td style="max-width: 200px;">
                    <button class="btn btn-small" onclick="getWikiSummary('${safeNameForFetch}', '${wikiTextId}')">📖 Zjistit z Wiki</button>
                    <div id="${wikiTextId}" class="wiki-result"></div>
                </td>
                <td style="color: #1565C0; font-weight: 500; max-width: 250px;">💡 ${advice}</td>
                <td><a href="${wikiLink}" target="_blank" style="color: var(--gw2-red); font-weight: bold; text-decoration: none;">Odkaz ↗</a></td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    resultsDiv.innerHTML = tableHTML;
}

function exportToCSV() {
    if (currentInventoryData.length === 0) return alert("Není co exportovat.");

    const searchQuery = document.getElementById('searchInput').value.trim().toLowerCase();
    const rarityFilter = document.getElementById('rarityFilter').value;
    
    const filteredItems = currentInventoryData.filter(item => {
        return item.name.toLowerCase().includes(searchQuery) && (rarityFilter === "" || item.rarity === rarityFilter);
    });

    let csvContent = "Název,Typ,Rarita,Množství\n";
    filteredItems.forEach(item => {
        let name = item.name.replace(/"/g, '""');
        csvContent += `"${name}","${item.type}","${item.rarity}",${item.count}\n`;
    });

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "gw2_inventar.csv");
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function getWikiSummary(encodedItemName, elementId) {
    const summaryDiv = document.getElementById(elementId);
    summaryDiv.style.display = "block";
    summaryDiv.innerHTML = "<em>Stahuji... ⏳</em>";

    const wikiUrl = `https://wiki.guildwars2.com/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodedItemName}&format=json&origin=*`;

    try {
        const wikiResponse = await fetch(wikiUrl);
        const wikiData = await wikiResponse.json();
        
        const pages = wikiData.query.pages;
        const pageId = Object.keys(pages)[0];

        if (pageId === "-1" || !pages[pageId].extract) {
            summaryDiv.innerHTML = "<em>Nenalezeno.</em>";
            return;
        }

        let englishText = pages[pageId].extract;
        if (englishText.length > 200) englishText = englishText.substring(0, 200) + "...";

        const translateUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(englishText)}&langpair=en|cs`;
        const translateResponse = await fetch(translateUrl);
        const translateData = await translateResponse.json();

        let czechText = "Chyba překladu.";
        if (translateData && translateData.responseData && translateData.responseData.translatedText) {
            czechText = translateData.responseData.translatedText;
        }

        summaryDiv.innerHTML = czechText;

    } catch (error) {
        summaryDiv.innerHTML = "<span style='color:red'>Chyba spojení.</span>";
    }
}
