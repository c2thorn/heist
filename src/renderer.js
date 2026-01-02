import './index.css';
import { MapRenderer } from './ui/map/MapRenderer';
import { commandCenterUI } from './ui/CommandCenterUI';
import { shopManager } from './ui/ShopManager';
import GameManager from './game/GameManager';
import { MapGenerator } from './game/MapGenerator';
import { SimulationEngine } from './game/SimulationEngine';

console.log('Renderer process started. Initializing Command Center...');

// 1. Initial State Preparation
const day1Map = MapGenerator.generateStaticLevel(0, window.innerHeight);
GameManager.gameState.map = day1Map;

// 2. Initialize UI Managers
commandCenterUI.init();
shopManager.init();

// 3. Initialize HTML Map Renderer
const mapRenderer = new MapRenderer();
mapRenderer.init();
// Remove Phaser Instance
// const gameInstance = new Phaser.Game(config);

// 4. View Management Logic
const views = {
  map: {
    btn: document.getElementById('btn-view-map'),
    elements: ['hud-center', 'action-panel', 'hud-top']
  },
  shop: {
    btn: document.getElementById('btn-view-shop'),
    elements: ['shop-screen']
  }
};

function switchView(viewKey) {
  // Prevent switching during simulation
  if (SimulationEngine.isRunning) return;

  // Update Buttons
  Object.keys(views).forEach(key => {
    if (key === viewKey) views[key].btn.classList.add('active');
    else views[key].btn.classList.remove('active');

    // Toggle Elements
    views[key].elements.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (key === viewKey) {
          el.style.display = (id === 'hud-center' || id === 'action-panel') ? 'flex' : 'block';
        } else {
          // KEY CHANGE: Never hide hud-top, as it holds the navigation tabs
          if (id !== 'hud-top') {
            el.style.display = 'none';
          }
        }
      }
    });
  });

  if (viewKey === 'shop') shopManager.updateUI();
}

views.map.btn.addEventListener('click', () => switchView('map'));
views.shop.btn.addEventListener('click', () => switchView('shop'));

// 5. Global Event Orchestration
window.addEventListener('openShop', () => {
  switchView('shop');
});

window.addEventListener('nextDayStarted', () => {
  switchView('map');
});

window.addEventListener('startHeist', () => {
  // Lock View Tabs during heist
  views.map.btn.disabled = true;
  views.shop.btn.disabled = true;
});

window.addEventListener('heistEventLog', () => {
  // Optional: Auto-switch to map if urgent?
});

window.addEventListener('heistFinished', () => {
  // Unlock View Tabs
  views.map.btn.disabled = false;
  views.shop.btn.disabled = false;
  updateGlobalHeat();
});

window.addEventListener('heatLaundered', () => updateGlobalHeat());
window.addEventListener('heistEventLog', () => updateGlobalHeat()); // Live updates during heist

function updateGlobalHeat() {
  const heat = Math.min(100, Math.max(0, GameManager.gameState.resources.heat));
  const fill = document.getElementById('heat-bar-fill');
  const label = document.getElementById('heat-label');

  if (fill) {
    fill.style.width = `${heat}%`;

    // Dynamic Color Interpolation: Blue (0, 0, 255) -> Red (255, 0, 0)
    // We can use HSL for cleaner transition: Blue(240) -> Red(0)
    // But direct RGB interpolation might feel more "heat" like (purple middle state)
    // Let's go with a custom gradient: Blue -> Purple -> Red -> Fire

    let color = '';

    if (heat < 50) {
      // Cool Blue to Purple
      // 0% -> rgb(0, 100, 255)
      // 50% -> rgb(200, 0, 200)
      const ratio = heat / 50;
      const r = Math.floor(0 + 200 * ratio);
      const g = Math.floor(100 * (1 - ratio));
      const b = Math.floor(255 * (1 - ratio * 0.2));
      color = `rgb(${r}, ${g}, ${b})`;
    } else {
      // Purple to Hot Red
      // 50% -> rgb(200, 0, 200)
      // 100% -> rgb(255, 50, 0)
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

function updateGlobalIntel() {
  const intel = GameManager.gameState.meta.intel;
  const label = document.getElementById('intel-display');
  if (label) {
    label.innerText = `INTEL: ${intel}`;
  }
}

window.addEventListener('intelPurchased', updateGlobalIntel);
window.addEventListener('nextDayStarted', updateGlobalIntel);

updateGlobalHeat();
updateGlobalIntel();
