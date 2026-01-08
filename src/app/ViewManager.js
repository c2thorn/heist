/**
 * ViewManager - Handles view/tab switching between Map and Safehouse
 * Extracted from renderer.js for maintainability
 */
import GameManager from '../game/GameManager.js';
import { shopManager } from '../ui/ShopManager.js';

// Job board UI instance will be injected
let jobBoardUI = null;

// View configuration
const views = {
    map: {
        btn: document.getElementById('btn-view-map'),
        elements: ['hud-center', 'action-panel']
    },
    shop: {
        btn: document.getElementById('btn-view-shop'),
        elements: ['shop-screen']
    }
};

/**
 * Switch between main views (map/shop)
 * @param {string} viewKey - 'map' or 'shop'
 */
export function switchView(viewKey) {
    // Prevent switching during heist execution
    if (GameManager.heistPhase === 'EXECUTING') return;

    // Update Buttons
    Object.keys(views).forEach(key => {
        if (key === viewKey) views[key].btn.classList.add('active');
        else views[key].btn.classList.remove('active');

        // Toggle Elements
        views[key].elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (key === viewKey) {
                    // Special handling for MAP view vs JOB BOARD
                    const hasActiveContract = GameManager.gameState.simulation.status !== 'SELECTING_CONTRACT';

                    if (key === 'map' && !hasActiveContract) {
                        // No contract selected - show Job Board
                        if (jobBoardUI) jobBoardUI.show();
                        el.style.display = (id === 'hud-center' || id === 'action-panel') ? 'none' : 'flex';
                    } else {
                        el.style.display = (id === 'hud-center' || id === 'action-panel') ? 'flex' : 'block';
                        if (key === 'map' && jobBoardUI) jobBoardUI.hide();
                    }
                } else {
                    el.style.display = 'none';
                }
            }
        });
    });

    if (viewKey === 'shop') {
        shopManager.updateUI();
        if (jobBoardUI) jobBoardUI.hide();
    }
}

/**
 * Switch between deck tabs (roster/planning)
 * @param {string} tabName - 'roster' or 'planning'
 */
export function switchDeckTab(tabName) {
    // Update Tabs
    document.querySelectorAll('.deck-tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.add('active');

    // Update Pages
    document.querySelectorAll('.deck-page').forEach(p => p.classList.remove('active'));
    const activePage = document.getElementById(`deck-page-${tabName}`);
    if (activePage) activePage.classList.add('active');
}

/**
 * Get views object for external access (disable buttons, etc.)
 */
export function getViews() {
    return views;
}

/**
 * Initialize ViewManager with dependencies
 * @param {Object} deps - { jobBoardUI }
 */
export function initViewManager(deps) {
    jobBoardUI = deps.jobBoardUI;

    // Bind view tab clicks
    views.map.btn.addEventListener('click', () => {
        if (!views.map.btn.disabled) switchView('map');
    });
    views.shop.btn.addEventListener('click', () => {
        if (!views.shop.btn.disabled) switchView('shop');
    });

    // Bind deck tab clicks
    document.getElementById('tab-roster')?.addEventListener('click', () => switchDeckTab('roster'));
    document.getElementById('tab-planning')?.addEventListener('click', () => switchDeckTab('planning'));

    // Auto-switch to map on new day
    window.addEventListener('nextDayStarted', () => {
        switchView('map');
    });
}
