window.onload = () => {
    const savedGW2Key = localStorage.getItem('gw2_api_key');
    const gw2Input = document.getElementById('apiKey');

    gw2Input.addEventListener('input', (e) => {
        const newKey = e.target.value;
        localStorage.setItem('gw2_api_key', newKey);
        
        const statusMsg = document.getElementById('saveStatusGW2');
        statusMsg.style.display = 'inline';
        setTimeout(() => { statusMsg.style.display = 'none'; }, 2000);
        
        if (newKey.length > 20) loadCharacterList(newKey);
    });

    if (savedGW2Key) {
        gw2Input.value = savedGW2Key;
        loadCharacterList(savedGW2Key);
        switchView('inventory');
    } else {
        switchView('settings');
    }
};

function switchView(viewName) {
    // Přepínání obsahu
    document.getElementById('view-inventory').style.display = (viewName === 'inventory') ? 'block' : 'none';
    document.getElementById('view-settings').style.display = (viewName === 'settings') ? 'block' : 'none';
    
    // Zvýraznění aktivního tlačítka v menu
    document.getElementById('nav-inventory').style.color = (viewName === 'inventory') ? 'white' : '#ccc';
    document.getElementById('nav-inventory').style.borderBottomColor = (viewName === 'inventory') ? 'var(--gw2-red)' : 'transparent';
    document.getElementById('nav-settings').style.color = (viewName === 'settings') ? 'white' : '#ccc';
    document.getElementById('nav-settings').style.borderBottomColor = (viewName === 'settings') ? 'var(--gw2-red)' : 'transparent';
}

async function loadCharacterList(apiKey) {
    const select = document.getElementById('charSelect');
    try {
        const response = await fetch(`https://api.guildwars2.com/v2/characters?access_token=${apiKey}`);
        if (!response.ok) return;
        
        const characters = await response.json();
        select.innerHTML = '<option value="">-- Zvolte postavu --</option>';
        characters.forEach(charName => {
            select.innerHTML += `<option value="${charName}">${charName}</option>`;
        });
    } catch (error) {
        console.error("Chyba při načítání postav:", error);
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

    resultsDiv.innerHTML = `<p style="color:#666;"><em>Načítám batohy pro postavu <strong>${selectedChar}</strong>...</em></p>`;

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

        resultsDiv.innerHTML = ``; // Vyčistíme text o načítání
        
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

            // Zde je aktualizované HTML pro moderní design karet
            resultsDiv.innerHTML += `
                <div class="item ${cssClass}">
                    <img src="${details.icon}" alt="${details.name}">
                    <div class="item-content">
                        <div class="item-title">${details.name}</div>
                        <div class="item-meta">Rarita: <strong>${details.rarity}</strong> &nbsp;|&nbsp; Množství: <strong>${itemData.count}</strong></div>
                        <a href="${wikiLink}" class="wiki-link" target="_blank">Zobrazit na anglické GW2 Wiki ↗</a><br>
                        
                        <button class="btn-action" onclick="getWikiSummary('${safeNameForFetch}', '${wikiTextId}')">
                            📖 Přeložit shrnutí do češtiny
                        </button>
                        <div id="${wikiTextId}" class="wiki-summary"></div>
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        resultsDiv.innerHTML = `<p style="color:var(--gw2-red); font-weight:bold;">Došlo k chybě: ${error.message}</p>`;
    }
}

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
            summaryDiv.innerHTML = "<em>Shrnutí pro tento předmět nebylo nalezeno.</em>";
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
        summaryDiv.innerHTML = "<span style='color:var(--gw2-red)'>Nepodařilo se připojit k Wiki nebo překladači.</span>";
    }
}
