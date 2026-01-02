import GameManager from '../game/GameManager';
import { MapGenerator } from '../game/MapGenerator';

class ShopManager {
    constructor() {
        this.elements = {};
    }

    init() {
        this.elements = {
            shopScreen: document.getElementById('shop-screen'),
            dayText: document.getElementById('shop-day'),
            cashText: document.getElementById('shop-cash'),
            heatText: document.getElementById('shop-heat'),
            buyIntelBtn: document.getElementById('buy-intel-btn'),
            launderBtn: document.getElementById('launder-btn')
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
    }

    open() {
        // Core visibility is now handled by the 'switchView' in renderer.js
        this.updateUI();
    }

    updateUI() {
        const { meta, resources } = GameManager.gameState;
        if (this.elements.dayText) this.elements.dayText.innerText = `DAY: ${meta.currentDay}`;
        if (this.elements.cashText) this.elements.cashText.innerText = `CASH: $${meta.cash}`;

        // Remove redundant Heat Text updating (handled by HUD bar)
        if (this.elements.heatText) this.elements.heatText.style.display = 'none';

        if (this.elements.buyIntelBtn) this.elements.buyIntelBtn.disabled = meta.cash < 200;
        if (this.elements.launderBtn) this.elements.launderBtn.disabled = meta.cash < 500;
    }

    startDay() {
        // Only advance if we haven't already won/lost the campaign logic separately
        // Check if we are already AT max days (meaning we just finished Day 4, now starting Day 5)
        const diff = GameManager.gameState.meta.difficultyModifier + 1;

        // If currentDay is 4, we are about to start Day 5 (Grand Heist)
        // If currentDay is 5, we are somehow looping? (Shouldn't happen in 5 day structure)

        const isGrand = GameManager.gameState.meta.currentDay === (GameManager.maxDays - 1);

        // Generate Next Day Map
        const newMap = MapGenerator.generateStaticLevel(diff, window.innerHeight, isGrand);
        GameManager.startNextDay(newMap);

        window.dispatchEvent(new CustomEvent('nextDayStarted'));
        this.updateUI();
    }
}

export const shopManager = new ShopManager();
