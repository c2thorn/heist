/**
 * HUDController - Handles HUD resource displays (heat, cash, intel)
 * Extracted from renderer.js for maintainability
 */
import GameManager from '../game/GameManager.js';

/**
 * Update the heat bar display with dynamic color
 */
export function updateGlobalHeat() {
    const heat = Math.min(100, Math.max(0, GameManager.gameState.resources.heat));
    const fill = document.getElementById('heat-bar-fill');
    const label = document.getElementById('heat-label');

    if (fill) {
        fill.style.width = `${heat}%`;

        // Dynamic Color Interpolation: Blue -> Purple -> Red
        let color = '';

        if (heat < 50) {
            // Cool Blue to Purple
            const ratio = heat / 50;
            const r = Math.floor(0 + 200 * ratio);
            const g = Math.floor(100 * (1 - ratio));
            const b = Math.floor(255 * (1 - ratio * 0.2));
            color = `rgb(${r}, ${g}, ${b})`;
        } else {
            // Purple to Hot Red
            const ratio = (heat - 50) / 50;
            const r = Math.floor(200 + 55 * ratio);
            const g = Math.floor(50 * ratio);
            const b = Math.floor(200 * (1 - ratio));
            color = `rgb(${r}, ${g}, ${b})`;
        }

        fill.style.backgroundColor = color;

        // Use CSS classes for the pulsing/glow animation effects
        fill.className = '';
        if (heat >= 80) fill.classList.add('high-heat');
        else if (heat >= 50) fill.classList.add('med-heat');
    }

    if (label) {
        label.innerText = `SYSTEM HEAT: ${Math.round(heat)}%`;
        if (heat >= 80) label.style.color = '#ff4444';
        else if (heat >= 50) label.style.color = '#ffcc00';
        else label.style.color = '#888';
    }
}

/**
 * Update cash and intel displays
 */
export function updateGlobalResources() {
    const intel = GameManager.gameState.meta.intel;
    const cash = GameManager.gameState.meta.cash;

    const intelLabel = document.getElementById('intel-display');
    if (intelLabel) intelLabel.innerText = `INTEL: ${intel}`;

    const cashLabel = document.getElementById('cash-display');
    if (cashLabel) cashLabel.innerText = `CASH: $${cash}`;
}

/**
 * Initialize HUD event listeners and initial state
 */
export function initHUDController() {
    // Listen for resource changes
    window.addEventListener('resourcesChanged', updateGlobalResources);
    window.addEventListener('intelPurchased', updateGlobalResources); // Legacy compat
    window.addEventListener('nextDayStarted', updateGlobalResources);

    // Listen for heat changes
    window.addEventListener('heatLaundered', () => updateGlobalHeat());
    window.addEventListener('heistEventLog', () => updateGlobalHeat()); // Live updates during heist
    window.addEventListener('heatChanged', () => updateGlobalHeat());   // Heat from zones, captures, alarms

    // Initial render
    updateGlobalHeat();
    updateGlobalResources();
}
