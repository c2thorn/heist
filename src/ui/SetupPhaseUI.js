/**
 * SetupPhaseUI - Manages the pre-heist preparation screen
 * Displays Intel purchasing and Asset arrangements
 */

import GameManager from '../game/GameManager';
import { arrangementEngine } from '../game/grid/index.js';

export class SetupPhaseUI {
    constructor() {
        this.container = null;
        this.isVisible = false;
    }

    /**
     * Initialize the UI
     */
    init() {
        // Target Setup Page in Command Deck
        this.container = document.getElementById('deck-page-planning');

        if (this.container) {
            this.bindEvents();
            console.log('[SetupPhaseUI] Initialized attached to #deck-page-planning');
        } else {
            console.error('[SetupPhaseUI] #deck-page-planning missing from DOM');
        }
    }

    /**
     * Show the Setup Phase UI
     */
    show() {
        if (!this.container) this.init();
        if (this.container) {
            // Note: Renderer handles Tab switching.
            // SetupPhase just populates the content.
            this.isVisible = true;
            this.refresh();
            console.log('[SetupPhaseUI] Populated');
        }
    }

    /**
     * Hide the Setup Phase UI
     */
    hide() {
        // We don't hide the container manually, we let the Tab system handle visibility
        this.isVisible = false;
    }

    /**
     * Create the base HTML structure
     */
    renderStructure() {
        // Container exists in HTML, we just populate content if needed.
        // But renderSupportTray handles content. So this might be empty.
    }

    /**
     * Bind global event listeners
     */
    bindEvents() {
        // Listen for data updates to auto-refresh
        window.addEventListener('sectorRevealed', () => this.refresh());
        window.addEventListener('arrangementPurchased', () => this.refresh());

        // Listen for phase change to hide
        window.addEventListener('startHeist', () => this.hide());
    }

    /**
     * Refresh all data views
     */
    refresh() {
        if (!this.isVisible) return;

        this.updateHeader();
        this.renderSupportTray();
    }

    /**
     * Update resource header (Main HUD)
     */
    updateHeader() {
        // Target existing HUD elements from index.html
        const intelEl = document.getElementById('intel-display');
        const cashEl = document.getElementById('cash-display');

        if (intelEl && window.sectorManager) {
            intelEl.textContent = `INTEL: ${window.sectorManager.getIntel()}`;
        }
        if (cashEl && window.arrangementEngine) {
            cashEl.textContent = `CASH: $${window.arrangementEngine.getCash()}`;
        }
    }

    /**
     * Render the support tray with all assets
     */
    renderSupportTray() {
        const list = this.container; // The container IS the tray now
        if (!list) return;

        list.innerHTML = '';

        // 1. RENDER ACTIVE CREW SELECTOR
        const crewContainer = document.createElement('div');
        crewContainer.className = 'planning-crew-list';
        crewContainer.style.display = 'flex';
        crewContainer.style.gap = '10px';
        crewContainer.style.marginBottom = '20px';
        crewContainer.style.overflowX = 'auto';
        crewContainer.style.padding = '10px';
        crewContainer.style.borderBottom = '1px solid #333';

        const activeCrew = GameManager.gameState.crew.activeStack;

        // Ensure we have a selection
        if (!window.planningUnitId && activeCrew.length > 0) {
            window.planningUnitId = activeCrew[0].id;
        }

        activeCrew.forEach(member => {
            const el = document.createElement('div');
            const isSelected = window.planningUnitId === member.id;

            el.className = `crew-card-compact ${isSelected ? 'selected' : ''}`;
            el.style.width = '80px';
            el.style.cursor = 'pointer';

            // Get Plan Count
            const plan = GameManager.gameState.simulation.plan;
            const taskCount = plan[member.id] ? plan[member.id].length : 0;

            el.innerHTML = `
                <div class="card-header">
                    <div class="card-name" style="font-size:10px;">${member.name}</div>
                </div>
                <div style="text-align:center; margin:5px;">
                    <span style="font-size:20px;">👤</span>
                </div>
                <div class="card-footer" style="justify-content:center;">
                    <span style="font-size:10px; color:${taskCount > 0 ? '#00ff88' : '#666'}">${taskCount} TASKS</span>
                </div>
            `;

            el.addEventListener('click', () => {
                window.planningUnitId = member.id;
                this.refresh(); // Re-render to update highlight
                console.log(`Planning for: ${member.name}`);
            });

            crewContainer.appendChild(el);
        });

        list.appendChild(crewContainer);

        // 2. RENDER ASSETS TRAY (Existing Logic, wrapped in div)
        const assetsHeader = document.createElement('div');
        assetsHeader.innerText = "SUPPORT ASSETS";
        assetsHeader.className = "section-label";
        list.appendChild(assetsHeader);

        const assetsContainer = document.createElement('div');
        assetsContainer.style.display = 'flex';
        assetsContainer.style.flexWrap = 'wrap';
        assetsContainer.style.gap = '10px';
        list.appendChild(assetsContainer);

        const assets = arrangementEngine.available; // Get all assets

        assets.forEach(asset => {
            // Determine state
            const isRevealed = !asset.reqSector || (window.sectorManager && window.sectorManager.isSectorRevealed(asset.reqSector));
            const isPurchased = asset.purchased;
            const canAfford = arrangementEngine.getCash() >= asset.cost;

            // Start with card styling matching Command Deck
            const el = document.createElement('div');
            el.className = `crew-card-compact ${isPurchased ? 'purchased' : ''} ${!isRevealed ? 'locked' : ''}`;
            el.style.width = "100px"; // Fixed width for asset cards

            // Icon selection
            let icon = '📦';
            if (asset.id.includes('phone')) icon = '📞';
            if (asset.id.includes('power')) icon = '⚡';
            if (asset.id.includes('vault')) icon = '🔢';
            if (asset.id.includes('bribe')) icon = '🤝';

            el.innerHTML = `
                <div class="card-header">
                    <div class="card-name" style="font-size:11px;">${asset.name}</div>
                </div>
                <div style="font-size: 24px; text-align: center; margin: 5px 0;">${icon}</div>
                <div class="card-footer" style="justify-content: center; border-color: ${isPurchased ? '#00ff88' : '#333'}">
                    <div style="font-size: 11px; font-weight: bold; color: ${isPurchased ? '#fff' : (isRevealed ? '#00ff88' : '#666')}">
                        ${isPurchased ? 'OWNED' : (isRevealed ? '$' + asset.cost : 'LOCKED')}
                    </div>
                </div>
            `;

            // Interaction
            if (isRevealed) {
                el.addEventListener('click', () => {
                    if (!isPurchased && canAfford) {
                        arrangementEngine.purchase(asset.id);
                    } else if (isPurchased && asset.payload && asset.payload.x) {
                        // Pan to asset
                        if (window.gridRenderer) {
                            window.gridRenderer.panTo(asset.payload.x, asset.payload.y);
                        }
                    }
                });

                // Hover effects
                el.addEventListener('mouseenter', () => {
                    // Dispatch hover event for GridRenderer to pick up
                    window.dispatchEvent(new CustomEvent('assetHover', { detail: { assetId: asset.id, hovering: true } }));
                });

                el.addEventListener('mouseleave', () => {
                    window.dispatchEvent(new CustomEvent('assetHover', { detail: { assetId: asset.id, hovering: false } }));
                });
            }

            list.appendChild(el);
        });
    }

    // executeHeist() removed - handled by index.html button
}

export const setupPhaseUI = new SetupPhaseUI();
