import GameManager from '../game/GameManager';
import { MapGenerator } from '../game/MapGenerator';

class ShopManager {
    constructor() {
        this.elements = {};
    }

    init() {
        this.elements = {
            shopScreen: document.getElementById('shop-screen'),
            dayText: document.getElementById('day-display'), // GLOBAL ID
            cashText: document.getElementById('cash-display'), // GLOBAL ID
            heatText: document.getElementById('shop-heat'),
            buyIntelBtn: document.getElementById('buy-intel-btn'),
            launderBtn: document.getElementById('launder-btn'),
            // New containers
            recruitList: document.getElementById('recruit-list'),
            gearList: document.getElementById('gear-list')
        };

        this.elements.buyIntelBtn?.addEventListener('click', () => {
            if (GameManager.buyIntel()) {
                this.updateUI();
                // We dispatch this so the Map can update its Intel text too
                window.dispatchEvent(new CustomEvent('intelPurchased'));
            }
        });

        this.elements.launderBtn?.addEventListener('click', () => {
            if (GameManager.launderMoney()) {
                this.updateUI();
                window.dispatchEvent(new CustomEvent('heatLaundered'));
            }
        });

        window.addEventListener('shopRefreshed', () => this.updateUI());
    }

    open() {
        // Core visibility is now handled by the 'switchView' in renderer.js
        this.updateUI();
    }

    updateUI() {
        const { meta, shop } = GameManager.gameState;
        if (this.elements.dayText) this.elements.dayText.innerText = `DAY: ${meta.currentDay}`;
        if (this.elements.cashText) this.elements.cashText.innerText = `CASH: $${meta.cash}`;

        if (this.elements.heatText) this.elements.heatText.style.display = 'none';

        if (this.elements.buyIntelBtn) this.elements.buyIntelBtn.disabled = meta.cash < 200;
        if (this.elements.launderBtn) this.elements.launderBtn.disabled = meta.cash < 500;

        this.renderRecruits(shop?.hires || []);
        this.renderGear(shop?.items || []);
    }

    renderRecruits(recruits) {
        if (!this.elements.recruitList) return;
        this.elements.recruitList.innerHTML = '';

        recruits.forEach(crew => {
            const card = document.createElement('div');
            card.className = 'shop-card';

            let statString = '';
            for (const [key, val] of Object.entries(crew.stats)) {
                statString += `<div class="shop-stat"><span>${key.toUpperCase()}</span><span>${val}</span></div>`;
            }

            card.innerHTML = `
                <div class="shop-card-header">${crew.name}</div>
                <div class="shop-card-role">${crew.role}</div>
                <div class="shop-card-content">${statString}</div>
                <button class="shop-buy-btn">HIRE $${crew.wage}</button>
            `;

            const btn = card.querySelector('button');
            if (GameManager.gameState.meta.cash < crew.wage) btn.disabled = true;

            btn.addEventListener('click', () => {
                if (GameManager.hireCrew(crew)) {
                    btn.innerText = 'HIRED';
                    btn.disabled = true;
                    btn.style.backgroundColor = '#222';
                    btn.style.color = '#666';
                    window.dispatchEvent(new CustomEvent('intelPurchased'));
                }
            });

            this.elements.recruitList.appendChild(card);
        });
    }

    renderGear(items) {
        if (!this.elements.gearList) return;
        this.elements.gearList.innerHTML = '';

        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.innerHTML = `
                <div class="shop-card-header">${item.name}</div>
                <div class="shop-card-role">${item.type}</div>
                <div class="shop-card-desc">${item.description}</div>
                <button class="shop-buy-btn">BUY $${item.cost}</button>
            `;

            const btn = card.querySelector('button');
            if (GameManager.gameState.meta.cash < item.cost) btn.disabled = true;

            btn.addEventListener('click', () => {
                if (GameManager.buyItem(item)) {
                    btn.innerText = 'BOUGHT';
                    btn.disabled = true;
                    btn.style.backgroundColor = '#222';
                    btn.style.color = '#666';
                    window.dispatchEvent(new CustomEvent('intelPurchased'));
                }
            });

            this.elements.gearList.appendChild(card);
        });
    }

    startDay() {
        GameManager.startNextDay(null);
        window.dispatchEvent(new CustomEvent('nextDayStarted'));
        this.updateUI();
    }
}

export const shopManager = new ShopManager();
