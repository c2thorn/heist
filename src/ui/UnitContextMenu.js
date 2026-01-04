/**
 * UnitContextMenu - Floating UI for programming Crew Goals
 * Attached to the selected unit in World Space.
 */
import { GoalDiscoveryService } from '../game/plan/GoalDiscoveryService.js';
import GameManager from '../game/GameManager.js';

export class UnitContextMenu {
    constructor(containerId) {
        this.parentId = containerId || 'game-ui-layer'; // Target the UI overlay
        this.element = null;
        this.unit = null;
        this.isVisible = false;

        this.render();
    }

    getIconForType(type) {
        switch (type) {
            case 'MOVE': return '📍';
            case 'INTERACT': return '⚡';
            case 'WAIT': return '⏱️';
            case 'SIGNAL': return '📡';
            default: return '❓';
        }
    }

    render() {
        const parent = document.getElementById(this.parentId) || document.body;

        this.element = document.createElement('div');
        this.element.className = 'unit-context-menu';
        this.element.style.position = 'absolute';
        this.element.style.display = 'none';
        this.element.style.pointerEvents = 'auto'; // Ensure clicks work
        this.element.style.zIndex = '1000';

        parent.appendChild(this.element);
    }

    /**
     * Set the unit to track
     */
    setUnit(unit) {
        this.unit = unit;
        if (unit) {
            this.show();
            this.refresh();
        } else {
            this.hide();
        }
    }

    show() {
        this.isVisible = true;
        this.element.style.display = 'flex';
        // Start update loop ensuring position sync
        this.updatePosition();
    }

    hide() {
        this.isVisible = false;
        this.element.style.display = 'none';
    }

    /**
     * Update screen position to follow unit
     * Called by Renderer loop ideally, or we can use requestAnimationFrame internally
     */
    updatePosition() {
        if (!this.isVisible || !this.unit || !window.gridRenderer) return;

        const screenPos = window.gridRenderer.worldToScreen(this.unit.worldPos.x, this.unit.worldPos.y);

        // Position below unit (offset down from center)
        this.element.style.left = `${screenPos.x}px`;
        this.element.style.top = `${screenPos.y + 40}px`;
    }

    refresh() {
        if (!this.unit) return;

        // Read from Unit's Plan
        const plan = GameManager.gameState.simulation.plan[this.unit.id] || [];

        let html = '<div class="goal-strip">';

        // Start Node
        html += `<div class="goal-node start">🚀 START</div>`;

        // Arrow
        html += `<div class="goal-arrow">→</div>`;

        // Render Existing Goals
        plan.forEach((task, index) => {
            const icon = this.getIconForType(task.type);
            const label = task.label || task.type;
            const cssClass = task.type.toLowerCase();

            html += `<div class="goal-node ${cssClass}" data-index="${index}">
                        ${icon} ${label}
                     </div>`;

            // Arrow between nodes
            html += `<div class="goal-arrow">→</div>`;
        });

        // Add Button
        html += `<div class="goal-node add-btn" id="add-goal-btn">+ ADD</div>`;

        html += '</div>';

        this.element.innerHTML = html;

        // Bind Events
        const addBtn = this.element.querySelector('#add-goal-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't click map
                this.showGoalSelector();
            });
        }
    }

    showGoalSelector() {
        console.log('Open Objective Selector');
        this.renderCategoryMenu();
    }

    renderCategoryMenu() {
        // Remove existing popup if present
        const existing = document.querySelector('.goal-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.className = 'goal-popup';

        // Get categories
        const categories = GoalDiscoveryService.getObjectiveCategories();

        let html = '<div class="goal-category">What should they do?</div>';
        categories.forEach(cat => {
            html += `<div class="goal-item category-item" data-category="${cat.id}" data-type="${cat.type}" ${cat.role ? `data-role="${cat.role}"` : ''}>
                <span class="goal-label">${cat.label}</span>
            </div>`;
        });

        popup.innerHTML = html;

        // Append to the ADD button so it positions relative to it
        const addBtn = this.element.querySelector('#add-goal-btn');
        if (addBtn) {
            addBtn.style.position = 'relative'; // Ensure positioning context
            addBtn.appendChild(popup);
        } else {
            this.element.appendChild(popup);
        }

        // Handle category selection
        popup.addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (!item) return;
            e.stopPropagation();

            const category = item.dataset.category;
            const type = item.dataset.type;
            const role = item.dataset.role || null;

            // Get targets for this category
            const targets = GoalDiscoveryService.getTargetsForCategory(category);

            if (targets.length === 0) {
                console.log(`No targets available for ${category}`);
                popup.remove();
                return;
            }

            // Show target selection
            this.renderTargetMenu(popup, type, role, targets);
        });

        // Close on click outside
        const closeHandler = () => {
            popup.remove();
            window.removeEventListener('click', closeHandler);
        };
        setTimeout(() => window.addEventListener('click', closeHandler), 10);
    }

    renderTargetMenu(popup, type, role, targets) {
        const triggers = GoalDiscoveryService.getAvailableTriggers();
        const isHold = type === 'HOLD';
        const triggerLabel = isHold ? 'Release when:' : 'Trigger:';

        let html = `<div class="goal-category">Select Target</div>`;

        targets.forEach(target => {
            const triggerOptions = triggers.map(t =>
                `<option value="${t.id}">${t.label}</option>`
            ).join('');

            html += `
                <div class="goal-item target-item" 
                     data-type="${type}" 
                     data-target="${target.id}" 
                     data-label="${target.label}"
                     ${role ? `data-role="${role}"` : ''}
                     ${target.verb ? `data-verb="${target.verb}"` : ''}
                     ${target.priority ? `data-priority="${target.priority}"` : ''}>
                    <span class="goal-label">${target.icon || '📍'} ${target.label}</span>
                    <div class="trigger-row">
                        <span class="trigger-label">${triggerLabel}</span>
                        <select class="trigger-select">
                            ${triggerOptions}
                        </select>
                    </div>
                </div>
            `;
        });

        // Back button
        html += `<div class="goal-item back-btn">← Back</div>`;

        popup.innerHTML = html;

        // Handle target selection
        popup.addEventListener('click', (e) => {
            const backBtn = e.target.closest('.back-btn');
            if (backBtn) {
                e.stopPropagation();
                this.renderCategoryMenu();
                return;
            }

            const item = e.target.closest('.target-item');
            if (!item) return;
            e.stopPropagation();

            const triggerSelect = item.querySelector('.trigger-select');
            const selectedTrigger = triggerSelect ? triggerSelect.value : null;

            const objective = {
                id: `obj_${Date.now()}`,
                type: item.dataset.type,
                target: item.dataset.target,
                label: item.dataset.label,
                status: 'PENDING',
                trigger: selectedTrigger === 'null' ? null : selectedTrigger
            };

            // Copy optional fields
            if (item.dataset.verb) objective.verb = item.dataset.verb;
            if (item.dataset.role) objective.role = item.dataset.role;
            if (item.dataset.priority) objective.priority = item.dataset.priority;

            this.addGoalToQueue(objective);
            popup.remove();
        });

        // Prevent trigger dropdown from bubbling
        popup.querySelectorAll('.trigger-select').forEach(sel => {
            sel.addEventListener('click', e => e.stopPropagation());
        });
    }

    renderObjectiveItem(obj, triggers, isHold = false) {
        const triggerLabel = isHold ? 'Release when:' : 'Trigger:';
        const triggerOptions = triggers.map(t =>
            `<option value="${t.id}" ${obj.trigger === t.id ? 'selected' : ''}>${t.label}</option>`
        ).join('');

        return `
            <div class="goal-item" 
                 data-type="${obj.type}" 
                 data-target="${obj.target}" 
                 data-label="${obj.label}"
                 ${obj.verb ? `data-verb="${obj.verb}"` : ''}
                 ${obj.role ? `data-role="${obj.role}"` : ''}
                 ${obj.priority ? `data-priority="${obj.priority}"` : ''}>
                <span class="goal-label">${obj.icon} ${obj.label}</span>
                <div class="trigger-row">
                    <span class="trigger-label">${triggerLabel}</span>
                    <select class="trigger-select">
                        ${triggerOptions}
                    </select>
                </div>
            </div>
        `;
    }

    addGoalToQueue(goal) {
        if (!this.unit) return;

        // Ensure plan array exists
        if (!GameManager.gameState.simulation.plan[this.unit.id]) {
            GameManager.gameState.simulation.plan[this.unit.id] = [];
        }

        // Push to State
        GameManager.gameState.simulation.plan[this.unit.id].push(goal);
        console.log(`[UnitContextMenu] Added Goal to ${this.unit.id}:`, goal);

        // Refresh UI
        this.refresh();

        // Sync Sidebar if open
        if (window.setupPhaseUI) window.setupPhaseUI.refresh();
    }
}
