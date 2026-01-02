import Phaser from 'phaser';

import GameManager from '../GameManager';
import { MapGenerator } from '../MapGenerator';
import { SimulationEngine } from '../SimulationEngine';

export class BlueprintScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BlueprintScene' });
        this.pathGraphics = null;
        this.nodeMap = new Map(); // Store visual references
        this.stackSprite = null;
        this.intelText = null;

        // Event listener references for cleanup
        this._onStartHeist = null;
        this._onNextDay = null;
    }

    create() {
        console.log("BlueprintScene Created");

        // 1. Load Map Data
        let mapData = GameManager.gameState.map;
        if (!mapData) {
            mapData = MapGenerator.generateStaticLevel(0, window.innerHeight);
            GameManager.gameState.map = mapData;
        }

        // 2. Render Map
        this.drawMap(mapData);

        // 3. Init Path Graphics Layer (Behind nodes, in front of edges)
        this.pathGraphics = this.add.graphics().setDepth(10);

        // 4. Init Stack Sprite (The Crew)
        this.stackSprite = this.add.rectangle(0, 0, 40, 40, 0xffffff);
        this.stackSprite.setStrokeStyle(3, 0x000000);
        this.stackSprite.setDepth(100);
        this.stackSprite.setVisible(false);

        // 5. Init HUD Text (Moved to HTML)

        // 6. Disable default context menu for right-click support
        this.input.mouse.disableContextMenu();

        // 7. Initial UI Update
        this.updateUI();

        // Clear event log for new mission
        const logArea = document.getElementById('event-log');
        if (logArea) logArea.innerHTML = '';

        // Update visual heat bar to persisted state
        this.updateHeatBar(GameManager.gameState.resources.heat);

        // 8. Event Listeners (with cleanup)
        this._onStartHeist = () => {
            if (SimulationEngine.isRunning) return;
            const plannedPath = GameManager.getPath();
            const activeCrew = GameManager.gameState.crew.activeStack;

            // Clear Log
            const logArea = document.getElementById('event-log');
            if (logArea) logArea.innerHTML = '';

            SimulationEngine.runHeist(plannedPath, activeCrew, this);
        };

        this._onNextDay = () => {
            console.log("REFRESHING MAP FOR NEW DAY");
            this.scene.restart();
        };

        window.addEventListener('startHeist', this._onStartHeist);
        window.addEventListener('nextDayStarted', this._onNextDay);

        // Cleanup on Shutdown
        this.events.on('shutdown', () => {
            window.removeEventListener('startHeist', this._onStartHeist);
            window.removeEventListener('nextDayStarted', this._onNextDay);
            SimulationEngine.isRunning = false;
        });
    }

    drawMap(mapData) {
        const graphics = this.add.graphics().setDepth(1); // Visual Edges at very bottom
        graphics.lineStyle(4, 0xffffff, 0.2); // Slower opacity for edges

        mapData.edges.forEach(edge => {
            const fromNode = mapData.nodes.find(n => n.id === edge.from);
            const toNode = mapData.nodes.find(n => n.id === edge.to);
            if (fromNode && toNode) {
                graphics.lineBetween(fromNode.x, fromNode.y, toNode.x, toNode.y);
            }
        });

        mapData.nodes.forEach(node => {
            this.drawNode(node);
        });
    }

    // --- VISUAL HELPERS ---
    drawHexagon(x, y, radius, color, thickness = 2, alpha = 1) {
        const graphics = this.add.graphics();
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = Phaser.Math.DegToRad(60 * i);
            points.push({
                x: x + radius * Math.cos(angle),
                y: y + radius * Math.sin(angle)
            });
        }

        graphics.lineStyle(thickness, 0xffffff, 0.5); // White rim
        graphics.fillStyle(color, alpha);
        graphics.fillPoints(points, true, true);
        graphics.strokePoints(points, true, true);
        graphics.setDepth(20);
        return graphics;
    }

    drawNode(node) {
        const isHidden = node.status === 'HIDDEN';
        let color = isHidden ? 0x444444 : this.getNodeColor(node);

        // Core Shape: Hexagon Stroke
        const hex = this.drawHexagon(node.x, node.y, 35, color, isHidden ? 2 : 4);

        // Interactive Zone (Invisible Circle for easier clicking)
        const hitArea = this.add.circle(node.x, node.y, 35, 0x000000, 0).setDepth(25).setInteractive();

        hitArea.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.handleNodeSelection(node.id);
            } else if (pointer.rightButtonDown()) {
                this.handleScout(node.id);
            }
        });

        // Icon / Question Mark
        const mainText = this.add.text(node.x, node.y, isHidden ? "?" : "", {
            font: 'bold 24px Arial',
            fill: color === 0x444444 ? '#888' : '#fff'
        }).setOrigin(0.5).setDepth(30);

        // Labels (Clean Outline Style)
        const labelText = isHidden ? "???" : node.name;
        const subText = this.add.text(node.x, node.y + 45, labelText, {
            font: 'bold 12px Arial',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);

        // Stat Info
        const statType = node.properties?.statCheck || 'NONE';
        const difficulty = node.properties?.difficulty || 0;
        const statTextStr = (isHidden || statType === 'NONE') ? "" : `${statType} ${difficulty}`;

        const statText = this.add.text(node.x, node.y + 60, statTextStr, {
            font: 'bold 11px Arial',
            fill: this.getStatTextColor(statType),
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(30);

        this.nodeMap.set(node.id, { circle: hex, mainText, subText, statText, nodeData: node });
    }

    getNodeColor(node) {
        if (node.type === 'ENTRY') return 0x00ff00;
        if (node.type === 'EXIT') return 0x0000ff;

        const statType = node.properties?.statCheck;
        if (statType === 'FORCE') return 0xff0000;
        if (statType === 'TECH') return 0x0000ff;
        if (statType === 'STEALTH') return 0xffff00;
        if (statType === 'FACE') return 0x800080;

        return 0xaaaaaa;
    }

    getStatTextColor(statType) {
        if (statType === 'FORCE') return '#ff4444';
        if (statType === 'TECH') return '#5555ff';
        if (statType === 'STEALTH') return '#ffff00';
        if (statType === 'FACE') return '#ff44ff';
        return '#ffffff';
    }

    handleScout(nodeId) {
        const success = GameManager.scoutNode(nodeId);
        if (success) {
            this.refreshNodeVisual(nodeId);
            window.dispatchEvent(new CustomEvent('intelPurchased'));
        } else {
            const visual = this.nodeMap.get(nodeId);
            if (visual) {
                this.tweens.add({
                    targets: [visual.circle, visual.mainText, visual.subText, visual.statText],
                    x: '+=5', duration: 50, yoyo: true, repeat: 3
                });
            }
        }
    }

    refreshNodeVisual(nodeId) {
        const visual = this.nodeMap.get(nodeId);
        if (!visual) return;
        const node = visual.nodeData;
        const statType = node.properties?.statCheck || 'NONE';
        const difficulty = node.properties?.difficulty || 0;

        // Redraw Hexagon (Phaser Graphics are stateful, easier to clear/redraw)
        visual.circle.clear();

        // Let's stick to the color update for now.
        const color = this.getNodeColor(node);
        visual.circle.lineStyle(4, 0xffffff, 0.5);
        visual.circle.fillStyle(color, 1);

        // Re-calcing points relative to the original x,y
        const centerX = node.x;
        const centerY = node.y;
        const absPoints = [];
        for (let i = 0; i < 6; i++) {
            const angle = Phaser.Math.DegToRad(60 * i);
            absPoints.push({
                x: centerX + 35 * Math.cos(angle),
                y: centerY + 35 * Math.sin(angle)
            });
        }
        visual.circle.fillPoints(absPoints, true, true);
        visual.circle.strokePoints(absPoints, true, true);

        visual.mainText.setText("");
        visual.subText.setText(node.name);

        // Update Labels
        const statTextStr = (statType === 'NONE') ? "" : `${statType} ${difficulty}`;
        visual.statText.setText(statTextStr);
        visual.statText.setFill(this.getStatTextColor(statType));

        this.tweens.add({ targets: visual.circle, scale: 1.1, duration: 200, yoyo: true });
    }

    initStackVisible(x, y) {
        this.stackSprite.setPosition(x, y);
        this.stackSprite.setVisible(true);
        this.tweens.add({ targets: this.stackSprite, scale: 1.2, duration: 200, yoyo: true });
    }

    async moveStackVisual(node) {
        return new Promise(resolve => {
            this.tweens.add({
                targets: this.stackSprite,
                x: node.x, y: node.y,
                duration: 1000,
                ease: 'Cubic.easeInOut',
                onComplete: () => resolve()
            });
        });
    }

    showEncounterResult(nodeId, result, currentHeat) {
        const visual = this.nodeMap.get(nodeId);
        if (!visual) return;
        const visualNode = visual.circle;

        // Update HTML Heat Bar
        this.updateHeatBar(currentHeat);

        const isSuccess = result.outcome === 'SUCCESS';
        const statusColor = isSuccess ? 0x00ff00 : 0xff0000;

        // Visual Pulse
        this.tweens.add({ targets: visualNode, scale: 1.3, duration: 200, yoyo: true, ease: 'Back.easeOut' });

        // Ripple
        const ring = this.add.circle(visualNode.x, visualNode.y, 30, statusColor, 0);
        ring.setStrokeStyle(4, statusColor);
        this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 800, onComplete: () => ring.destroy() });

        // Math Visualization (Floating Text)
        if (result.statName !== 'NONE') {
            this.showFloatingCombatText(visualNode.x, visualNode.y, result);
        }
    }

    showFloatingCombatText(x, y, data) {
        const isSuccess = data.outcome === 'SUCCESS';
        const color = isSuccess ? '#00ff00' : '#ff4444';
        const textStr = `${data.statName}: ${data.crewValue} vs ${data.difficulty}`;

        const floatText = this.add.text(x, y - 20, textStr, {
            font: 'bold 18px Arial',
            fill: color,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: floatText,
            y: y - 100,
            alpha: 0,
            duration: 1500,
            ease: 'Cubic.easeOut',
            onComplete: () => floatText.destroy()
        });
    }

    updateHeatBar(heat) {
        const fill = document.getElementById('heat-bar-fill');
        if (!fill) return;

        fill.style.width = `${heat}%`;
        fill.classList.remove('warning', 'danger');

        if (heat >= 100) fill.classList.add('danger');
        else if (heat >= 80) fill.classList.add('danger');
        else if (heat >= 50) fill.classList.add('warning');
    }

    showGameOver(isSuccess, specialMessage = null) {
        const screen = document.getElementById('game-results-screen');
        const title = document.getElementById('results-title');
        const msg = document.getElementById('results-msg');
        const btn = document.getElementById('results-btn');

        if (!screen || !title || !msg || !btn) return;

        title.innerText = isSuccess ? "HEIST SUCCESSFUL" : "MISSION FAILED";
        title.style.color = isSuccess ? "#00ff00" : "#ff4444";
        msg.innerText = specialMessage || (isSuccess ? "The crew slipped away with the score." : "The alarm was triggered. You were compromised.");

        const isRunOver = GameManager.gameState.flags.isGameOver || GameManager.gameState.flags.isVictory;
        btn.innerText = isRunOver ? "NEW RUN" : "GO TO SAFEHOUSE";

        screen.style.display = 'flex';

        // Clear existing listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            screen.style.display = 'none';
            if (isRunOver) {
                GameManager.resetGame();
                this.scene.restart();
            } else {
                // Auto-Advance to Next Day Logic
                import('../../ui/ShopManager').then(({ shopManager }) => {
                    shopManager.startDay(); // Generate new map & difficulty
                    window.dispatchEvent(new CustomEvent('openShop')); // Go to Base
                });
            }
        });
    }

    handleNodeSelection(nodeId) {
        if (this.stackSprite.visible && SimulationEngine.isRunning) return;
        const success = GameManager.addToPath(nodeId);
        if (success) { this.drawPath(); this.updateUI(); }
    }

    drawPath() {
        this.pathGraphics.clear();
        const plannedPath = GameManager.getPath();
        const nodes = GameManager.gameState.map.nodes;
        if (plannedPath.length < 1) return;

        // Draw selection lines
        this.pathGraphics.lineStyle(6, 0xffff00, 1);
        for (let i = 0; i < plannedPath.length - 1; i++) {
            const nodeA = nodes.find(n => n.id === plannedPath[i]);
            const nodeB = nodes.find(n => n.id === plannedPath[i + 1]);
            if (nodeA && nodeB) this.pathGraphics.lineBetween(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
        }

        // Draw highlight rings for selected nodes
        plannedPath.forEach((nodeId, index) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return;

            const isLast = index === plannedPath.length - 1;

            if (isLast) {
                // Thick outer ring for focus
                this.pathGraphics.lineStyle(10, 0xffff00, 1);
                this.pathGraphics.strokeCircle(node.x, node.y, 38);
                this.pathGraphics.lineStyle(4, 0xffffff, 1);
                this.pathGraphics.strokeCircle(node.x, node.y, 42);
            } else {
                this.pathGraphics.lineStyle(4, 0xffff00, 0.8);
                this.pathGraphics.strokeCircle(node.x, node.y, 35);
            }
        });
    }

    updateUI() {
        const plannedPath = GameManager.getPath();
        const nodes = GameManager.gameState.map.nodes;
        let isCompletable = false;
        if (plannedPath.length > 0) {
            const lastNode = nodes.find(n => n.id === plannedPath[plannedPath.length - 1]);
            if (lastNode && lastNode.type === 'EXIT') isCompletable = true;
        }
        window.dispatchEvent(new CustomEvent('gameStateUpdated', { detail: { isCompletable, pathLength: plannedPath.length } }));
    }
}
