import { ROSTER_POOL } from '../data/CrewLibrary';
import GameManager from '../game/GameManager';

class CommandCenterUI {
    constructor() {
        this.selectedIds = new Set();
        this.maxSize = 4;
        this.elements = {};
        this.isLocked = false;
        this.selectedItemInstanceId = null;
    }

    init() {
        console.log("Command Center (Deck) UI Initialized");
        this.elements = {
            panel: document.getElementById('command-deck'),
            activePanel: document.getElementById('active-list-panel'),
            rosterPanel: document.getElementById('roster-list-panel'),
            stashPanel: document.getElementById('stash-list-panel'),
            intelBrief: document.getElementById('intel-brief-mini'),
            hudLayer: document.getElementById('hud-layer')
        };

        this.setupListeners();
        this.syncWithState();
        this.renderCrew();
        this.renderInventory();
        this.updateIntelBrief();
        this.updateEquipStatus('READY');
    }

    setupListeners() {
        // Listen for heist events to lock/unlock
        window.addEventListener('startHeist', () => this.setLocked(true));
        window.addEventListener('nextDayStarted', () => {
            this.setLocked(false);
            if (this.elements.hudLayer) this.elements.hudLayer.style.display = 'flex';
            this.updateIntelBrief();
        });

        // Outside click to deselect
        document.addEventListener('click', (e) => {
            if (this.selectedItemInstanceId && !e.target.closest('.stash-item') && !e.target.closest('.equip-slot')) {
                this.selectedItemInstanceId = null;
                this.renderInventory();
                this.renderCrew();
            }
        });

        // Event Hub Listeners
        GameManager.events.on('crew-updated', () => this.renderCrew());
        GameManager.events.on('inventory-updated', () => this.renderInventory());
    }

    syncWithState() {
        const activeCrew = GameManager.gameState.crew.activeStack || [];
        this.selectedIds = new Set(activeCrew.map(c => c.id));
    }

    renderCrew() {
        if (!this.elements.activePanel || !this.elements.rosterPanel) return;

        this.elements.activePanel.innerHTML = '';
        this.elements.rosterPanel.innerHTML = '';

        const roster = GameManager.gameState.crew.roster;

        roster.forEach(char => {
            const isSelected = this.selectedIds.has(char.id);
            const card = this.createCompactCard(char, isSelected);

            if (isSelected) {
                this.elements.activePanel.appendChild(card);
            } else {
                this.elements.rosterPanel.appendChild(card);
            }
        });
    }

    renderInventory() {
        if (!this.elements.stashPanel) return;
        this.elements.stashPanel.innerHTML = '';

        const { inventory } = GameManager.gameState;
        inventory.forEach(item => {
            const el = document.createElement('div');
            el.className = `stash-item ${this.selectedItemInstanceId === item.instanceId ? 'selected' : ''}`;
            el.innerHTML = `
                <span class="stash-icon">${item.type === 'PASSIVE' ? '⚙️' : '💊'}</span>
                <span class="stash-name">${item.name}</span>
            `;

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedItemInstanceId === item.instanceId) {
                    this.selectedItemInstanceId = null;
                } else {
                    this.selectedItemInstanceId = item.instanceId;
                }
                this.renderInventory();
                this.renderCrew();
            });

            this.elements.stashPanel.appendChild(el);
        });
    }

    // Helper to calculate Role & Description
    // In a real app, this logic should be centralized or pulled from a Role definition
    getRoleInfo(char) {
        const s = char.stats || { force: 0, tech: 0, stealth: 0, face: 0 };
        let role = 'FACE';
        if (s.force >= s.tech && s.force >= s.stealth && s.force >= s.face) role = 'MUSCLE';
        else if (s.tech >= s.force && s.tech >= s.stealth && s.tech >= s.face) role = 'HACKER';
        else if (s.stealth >= s.force && s.stealth >= s.tech && s.stealth >= s.face) role = 'STEALTH';

        const abilities = {
            MUSCLE: { name: "Second Wind", icon: "💪", desc: "50% chance to re-roll Force failures." },
            HACKER: { name: "Patch", icon: "🔌", desc: "-2 Heat on successful Tech checks." },
            STEALTH: { name: "Shadow", icon: "👥", desc: "50% chance to dodge Heat on Stealth fails." },
            FACE: { name: "Skimming", icon: "💰", desc: "+50% Cash from Side Loot." }
        };

        return { role, ability: abilities[role] };
    }

    createCompactCard(char, isSelected) {
        const div = document.createElement('div');
        div.className = `crew-card-compact ${isSelected ? 'selected' : ''} ${this.isLocked ? 'locked' : ''}`;

        const { role, ability } = this.getRoleInfo(char);

        // Equipment Rendering
        let equipHtml = '';
        (char.equipment || [null, null]).forEach((item, idx) => {
            if (item) {
                const icon = item.type === 'PASSIVE' ? '⚙️' : '💊';
                equipHtml += `<div class="equip-slot occupied" data-slot="${idx}" title="${item.name}: ${item.description || ''}">${icon}</div>`;
            } else {
                equipHtml += `<div class="equip-slot ${this.selectedItemInstanceId ? 'highlight' : ''}" data-slot="${idx}">+</div>`;
            }
        });

        div.innerHTML = `
            <div class="card-header">
                <span class="card-name">${char.name}</span>
                <span class="card-role">${role}</span>
            </div>
            <div class="card-stats">
                <div class="${role === 'MUSCLE' ? 'highlight' : ''}">⚔️ FORCE ${char.stats.force}</div>
                <div class="${role === 'HACKER' ? 'highlight' : ''}">💻 TECH ${char.stats.tech}</div>
                <div class="${role === 'STEALTH' ? 'highlight' : ''}">👁️ STEALTH ${char.stats.stealth}</div>
                <div class="${role === 'FACE' ? 'highlight' : ''}">💬 FACE ${char.stats.face}</div>
            </div>
            <div class="card-footer">
                <div class="equip-row-mini">${equipHtml}</div>
                <div class="ability-badge">
                   <span class="ability-icon">${ability.icon}</span>
                   <span class="ability-name">${ability.name}</span>
                </div>
            </div>
        `;

        // Click Handler for Selection
        if (!this.isLocked) {
            div.addEventListener('click', (e) => {
                // If clicking an equip slot or ability, don't trigger selection
                if (e.target.closest('.equip-slot') || e.target.closest('.ability-badge')) return;

                if (isSelected) {
                    this.deselect(char.id);
                } else {
                    this.select(char.id);
                }
            });

            // Ability Hover
            const badge = div.querySelector('.ability-badge');
            badge.addEventListener('mouseenter', () => {
                this.updateEquipStatus(`${ability.name.toUpperCase()}: ${ability.desc}`);
            });
            badge.addEventListener('mouseleave', () => {
                this.updateEquipStatus('READY');
            });

            // Slot Interaction
            div.querySelectorAll('.equip-slot').forEach(slot => {
                slot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(slot.dataset.slot);

                    if (char.equipment[idx]) {
                        // Unequip
                        GameManager.unequipItem(char.id, idx);
                        this.updateEquipStatus('READY');
                    } else if (this.selectedItemInstanceId) {
                        // Equip to the clicked slot
                        if (GameManager.equipItem(char.id, this.selectedItemInstanceId, idx)) {
                            this.selectedItemInstanceId = null;
                            this.updateEquipStatus('EQUIPPED');
                        }
                    }
                    this.renderCrew();
                    this.renderInventory();
                });

                // Hover Tooltip logic
                slot.addEventListener('mouseenter', () => {
                    const slotIdx = parseInt(slot.dataset.slot);
                    const item = char.equipment[slotIdx];
                    if (item) {
                        this.updateEquipStatus(`${item.name.toUpperCase()}: ${item.description}`);
                    } else if (this.selectedItemInstanceId) {
                        this.updateEquipStatus('CLICK SLOT TO EQUIP');
                    }
                });

                slot.addEventListener('mouseleave', () => {
                    this.updateEquipStatus('READY');
                });
            });
        }

        return div;
    }

    select(id) {
        if (this.selectedIds.size >= this.maxSize) return;
        this.selectedIds.add(id);
        this.updateState();
        this.renderCrew();
    }

    deselect(id) {
        this.selectedIds.delete(id);
        this.updateState();
        this.renderCrew();
    }

    updateState() {
        const roster = GameManager.gameState.crew.roster;
        const activeCrew = roster.filter(c => this.selectedIds.has(c.id));
        GameManager.gameState.crew.activeStack = activeCrew;
        GameManager.events.emit('crew-updated');
    }

    setLocked(locked) {
        this.isLocked = locked;
        this.renderCrew();
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

    updateEquipStatus(text) {
        if (!this.elements.intelBrief) return;
        // Reuse the intel brief area or add a new one? 
        // Let's create a dedicated status bar later if needed, but for now, the recon bar is fine.
        // Actually, let's just make it a temporary override if text isn't 'READY'.
        if (text === 'READY') {
            this.updateIntelBrief();
        } else {
            this.elements.intelBrief.innerText = text;
            this.elements.intelBrief.style.color = '#ffcc00';
        }
    }
}

export const commandCenterUI = new CommandCenterUI();
