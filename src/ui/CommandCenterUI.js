import { ROSTER_POOL } from '../data/CrewLibrary';
import GameManager from '../game/GameManager';

class CommandCenterUI {
    constructor() {
        this.selectedIds = new Set();
        this.maxSize = 4;
        this.elements = {};
        this.isLocked = false;
    }

    init() {
        console.log("Command Center (Deck) UI Initialized");
        this.elements = {
            panel: document.getElementById('command-deck'),
            activePanel: document.getElementById('active-list-panel'),
            rosterPanel: document.getElementById('roster-list-panel'),
            intelBrief: document.getElementById('intel-brief-mini'),
            hudLayer: document.getElementById('hud-layer')
        };

        this.setupListeners();
        this.syncWithState();
        this.renderAll();
        this.updateIntelBrief();
    }

    setupListeners() {
        // Listen for heist events to lock/unlock
        window.addEventListener('startHeist', () => this.setLocked(true));
        window.addEventListener('openShop', () => {
            this.setLocked(false);
        });
        window.addEventListener('nextDayStarted', () => {
            this.setLocked(false);
            if (this.elements.hudLayer) this.elements.hudLayer.style.display = 'flex';
            this.updateIntelBrief();
        });
    }

    syncWithState() {
        const activeCrew = GameManager.gameState.crew.activeStack || [];
        this.selectedIds = new Set(activeCrew.map(c => c.id));
    }

    renderAll() {
        if (!this.elements.activePanel || !this.elements.rosterPanel) return;

        this.elements.activePanel.innerHTML = '';
        this.elements.rosterPanel.innerHTML = '';

        ROSTER_POOL.forEach(char => {
            const isSelected = this.selectedIds.has(char.id);
            const card = this.createCompactCard(char, isSelected);

            if (isSelected) {
                this.elements.activePanel.appendChild(card);
            } else {
                this.elements.rosterPanel.appendChild(card);
            }
        });
    }

    createCompactCard(char, isSelected) {
        const card = document.createElement('div');
        card.className = `char-card ${isSelected ? 'selected' : ''}`;
        if (this.isLocked) card.classList.add('locked');
        card.dataset.id = char.id;

        card.innerHTML = `
            <div class="card-header">
                <h3>${char.name}</h3>
                <span class="role">${char.role}</span>
            </div>
            <div class="stats">
                <span>FOR: ${char.stats.force}</span>
                <span>TEC: ${char.stats.tech}</span>
                <span>STE: ${char.stats.stealth}</span>
                <span>FAC: ${char.stats.face}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            if (this.isLocked) return;
            if (this.selectedIds.has(char.id)) {
                this.deselect(char.id);
            } else {
                this.select(char.id);
            }
        });

        return card;
    }

    select(id) {
        if (this.selectedIds.size >= this.maxSize) return;
        this.selectedIds.add(id);
        this.updateState();
        this.renderAll();
    }

    deselect(id) {
        this.selectedIds.delete(id);
        this.updateState();
        this.renderAll();
    }

    updateState() {
        const activeCrew = ROSTER_POOL.filter(c => this.selectedIds.has(c.id));
        GameManager.gameState.crew.activeStack = activeCrew;
    }

    setLocked(locked) {
        this.isLocked = locked;
        this.renderAll();
    }

    updateIntelBrief() {
        const map = GameManager.gameState.map;
        if (!map || !this.elements.intelBrief) return;

        const stats = map.nodes.map(n => n.properties?.statCheck).filter(s => s && s !== 'NONE');
        const counts = {};
        stats.forEach(s => counts[s] = (counts[s] || 0) + 1);
        const topStat = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "UNKNOWN");

        this.elements.intelBrief.innerText = `RECON: High ${topStat} activity detected.`;
    }
}

export const commandCenterUI = new CommandCenterUI();
