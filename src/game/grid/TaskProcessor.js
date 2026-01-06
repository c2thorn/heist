import GameManager from '../GameManager';
import { GridConfig } from './GridConfig';
import { Triggers } from '../plan/GoalDiscoveryService';
import { LootBag } from './LootBag';

/**
 * TaskProcessor - The "Brain" of the Crew Member
 * Converts high-level Objectives (Queue) into low-level Actions.
 * Handles trigger-based waiting and "Smart Waiting" when paths blocked.
 * 
 * Objective Types:
 * - ACTION: Go interact with something (trigger = "start when")
 * - HOLD: Stay in zone doing a role (trigger = "release when")
 * - LOOT: Bag items at target (trigger = "start when")
 * - ESCAPE: Exit via specified route (trigger = "start when")
 */
export class TaskProcessor {
    constructor(unit) {
        this.unit = unit;
        this.currentObjective = null;
        this.state = 'IDLE'; // IDLE, MOVING, INTERACTING, HOLDING, ESCAPING, WAITING_FOR_PATH, WAITING_FOR_TRIGGER, UNLOCKING
        this.path = [];
        this.pathIndex = 0;
        this.retryTimer = 0;
        this.holdStartTime = 0; // Track when HOLD started
        this.unlockTimer = 0;   // Timer for unlocking doors
        this.unlockDuration = 0; // Total time to unlock (for progress bar)
        this.unlockingTile = null; // The door tile being unlocked
    }

    /**
     * Get unlock progress as a value from 0 to 1
     */
    getUnlockProgress() {
        if (this.state !== 'UNLOCKING' || this.unlockDuration <= 0) return 0;
        return Math.min(1, this.unlockTimer / this.unlockDuration);
    }

    handleStimulus(stimulus) {
        console.log(`[TaskProcessor] Reacting to stimulus: ${stimulus.type}`);
        // If LOOKOUT role, could alert team here
    }

    /**
     * Main Tick Function
     */
    update(dt) {
        // 1. Check Global Phase
        if (window.heistPhase !== 'EXECUTING') return;

        // 2. Check SCRAM override
        if (this.checkScram()) return;

        // 3. Fetch Objective if Idle or waiting
        if (!this.currentObjective || this.state === 'WAITING_FOR_TRIGGER') {
            this.currentObjective = this.getNextObjective();
            if (!this.currentObjective) {
                return; // No objectives left
            }

            // Check trigger condition (start-when) for non-HOLD types
            if (this.currentObjective.trigger &&
                this.currentObjective.type !== 'HOLD') {
                if (!this.isTriggerFired(this.currentObjective.trigger)) {
                    this.state = 'WAITING_FOR_TRIGGER';
                    return; // Wait for trigger before starting
                }
            }

            this.startObjective(this.currentObjective);
        }

        // 4. Process State
        switch (this.state) {
            case 'MOVING':
                this.processMovement(dt);
                break;
            case 'WAITING_FOR_PATH':
                this.processRetry(dt);
                break;
            case 'INTERACTING':
                this.processInteraction(dt);
                break;
            case 'HOLDING':
                this.processHold(dt);
                break;
            case 'ESCAPING':
                this.processMovement(dt);
                break;
            case 'UNLOCKING':
                this.processUnlocking(dt);
                break;
        }
    }

    getNextObjective() {
        const plan = GameManager.gameState.simulation.plan[this.unit.id];
        if (!plan || plan.length === 0) {
            // Guards and other NPCs won't have plans - that's expected
            return null;
        }
        return plan.find(o => o.status === 'PENDING');
    }

    startObjective(obj) {
        console.log(`[${this.unit.id}] Starting Objective: ${obj.label} (${obj.type})`);
        obj.status = 'IN_PROGRESS';

        // Clear previous path data to prevent false arrivals
        this.path = [];
        this.pathIndex = 0;

        switch (obj.type) {
            case 'ACTION':
                this.startAction(obj);
                break;
            case 'HOLD':
                this.startHold(obj);
                break;
            case 'LOOT':
                this.startLoot(obj);
                break;
            case 'ESCAPE':
                this.startEscape(obj);
                break;
            default:
                console.warn(`Unknown objective type: ${obj.type}`);
                this.completeObjective();
        }
    }

    // === OBJECTIVE HANDLERS ===

    startAction(obj) {
        console.log(`[${this.unit.id}] startAction called with target: ${obj.target}`);
        const interactable = this.findInteractable(obj.target);
        console.log(`[${this.unit.id}] Found interactable:`, interactable);
        if (interactable) {
            // Find an adjacent walkable tile to approach
            const approachTiles = interactable.getApproachTiles(this.unit.tileMap);
            if (approachTiles.length > 0) {
                // Pick the closest approach tile
                const target = approachTiles[0]; // TODO: Pick closest
                console.log(`[${this.unit.id}] Approaching interactable at ${target.x},${target.y}`);
                this.targetInteractable = interactable; // Store for interaction
                this.requestPath(target.x, target.y);
            } else {
                console.warn(`No walkable approach tiles for ${obj.target}`);
                this.completeObjective();
            }
        } else {
            console.warn(`Interactable not found: ${obj.target}`);
            this.completeObjective();
        }
    }

    startHold(obj) {
        // Move to zone first, then hold
        const targetTile = this.findTileInSector(obj.target);
        if (targetTile) {
            this.holdStartTime = Date.now();
            this.requestPath(targetTile.x, targetTile.y);
        } else {
            console.warn(`Zone not found: ${obj.target}`);
            this.completeObjective();
        }
    }

    startLoot(obj) {
        // Move to loot target (container/zone)
        const interactable = this.findInteractable(obj.target);
        if (interactable) {
            const approachTiles = interactable.getApproachTiles(this.unit.tileMap);
            if (approachTiles.length > 0) {
                const target = approachTiles[0];
                this.targetInteractable = interactable;
                this.requestPath(target.x, target.y);
            } else {
                console.warn(`No walkable approach tiles for loot ${obj.target}`);
                this.completeObjective();
            }
        } else {
            console.warn(`Loot target not found: ${obj.target}`);
            this.completeObjective();
        }
    }

    startEscape(obj) {
        this.state = 'ESCAPING';
        const exit = this.findExit(obj.target);
        if (exit) {
            this.requestPath(exit.x, exit.y);
        } else {
            // Fallback to unit's defaultExit
            const defaultExit = this.findExit(this.unit.defaultExit);
            if (defaultExit) {
                this.requestPath(defaultExit.x, defaultExit.y);
            } else {
                console.warn(`Exit not found: ${obj.target}`);
                this.completeObjective();
            }
        }
    }

    processHold(dt) {
        // Check release trigger
        if (this.currentObjective.trigger) {
            if (this.isTriggerFired(this.currentObjective.trigger)) {
                console.log(`[${this.unit.id}] HOLD released by trigger: ${this.currentObjective.trigger}`);
                this.completeObjective();
                return;
            }
        }

        // Default timeout: mission timer (check window.missionTimer or similar)
        // For now, HOLD indefinitely until trigger or mission ends
        // Could add: if (Date.now() - this.holdStartTime > maxHoldTime) this.completeObjective();
    }

    // === TRIGGER SYSTEM ===

    isTriggerFired(trigger) {
        if (!trigger) return true; // No trigger = immediate

        // Check signal triggers
        if (trigger === Triggers.SIGNAL_EXFIL) {
            return GameManager.gameState.flags.primaryLootSecured === true;
        }
        if (trigger === Triggers.SIGNAL_SCRAM) {
            return GameManager.gameState.flags.scram === true;
        }
        if (trigger === Triggers.TIMER_COMPLETE) {
            // Check if mission timer is complete
            return window.missionTimerComplete === true;
        }

        // Check STATE: triggers
        if (trigger.startsWith('STATE:')) {
            const stateKey = trigger.replace('STATE:', '');
            // Check interactable states (e.g., vault_open)
            if (window.interactableStates && window.interactableStates[stateKey]) {
                return true;
            }
        }

        return false;
    }

    checkScram() {
        if (GameManager.gameState.flags.scram === true) {
            // Override everything, escape immediately
            if (this.state !== 'ESCAPING') {
                console.log(`[${this.unit.id}] SCRAM! Abandoning objective, escaping!`);
                if (this.currentObjective) {
                    this.currentObjective.status = 'ABORTED';
                }
                this.currentObjective = null;

                // Create emergency escape objective
                const escapeObj = {
                    id: `scram_${Date.now()}`,
                    type: 'ESCAPE',
                    target: this.unit.defaultExit || 'lobby',
                    label: 'SCRAM Escape',
                    status: 'IN_PROGRESS'
                };
                this.currentObjective = escapeObj;
                this.startEscape(escapeObj);
            }
            return true;
        }
        return false;
    }

    // === HELPERS ===

    findTileInSector(sectorId) {
        if (!window.tileMap) return null;
        const zone = window.tileMap.getZone(sectorId);
        if (!zone) return null;

        let sumX = 0, sumY = 0, count = 0;
        zone.tiles.forEach(t => {
            if (t.type === 'FLOOR') {
                sumX += t.x;
                sumY += t.y;
                count++;
            }
        });

        if (count > 0) {
            return window.tileMap.getTile(Math.floor(sumX / count), Math.floor(sumY / count));
        }
        return null;
    }

    findInteractable(id) {
        if (!window.gridRenderer) return null;
        return window.gridRenderer.interactables.find(i => i.id === id);
    }

    findExit(id) {
        // First check extractionPoints (new system)
        if (window.extractionPoints && window.extractionPoints.length > 0) {
            // If specific ID provided, find it
            if (id) {
                const exit = window.extractionPoints.find(e => e.id === id);
                if (exit) return { id: exit.id, x: exit.gridX, y: exit.gridY };
            }
            // Otherwise use default extraction point
            const defaultExit = window.extractionPoints.find(e => e.isDefault) || window.extractionPoints[0];
            if (defaultExit) return { id: defaultExit.id, x: defaultExit.gridX, y: defaultExit.gridY };
        }

        // Fallback: use radioController.exitTile
        if (window.radioController && window.radioController.exitTile) {
            return {
                id: 'main_exit',
                x: window.radioController.exitTile.x,
                y: window.radioController.exitTile.y
            };
        }

        return null;
    }

    async requestPath(targetX, targetY) {
        if (!window.pathfinder) {
            console.error(`[${this.unit.id}] window.pathfinder is not set!`);
            return;
        }

        const startX = this.unit.gridPos.x;
        const startY = this.unit.gridPos.y;
        console.log(`[${this.unit.id}] Requesting path from (${startX},${startY}) to (${targetX},${targetY})`);

        // Debug tile checks
        const startTile = this.unit.tileMap.getTile(startX, startY);
        const endTile = this.unit.tileMap.getTile(targetX, targetY);
        console.log(`[${this.unit.id}] Start tile walkable: ${startTile?.isWalkable}, End tile walkable: ${endTile?.isWalkable}`);

        // Use async version with await
        const path = await window.pathfinder.findPath(
            startX,
            startY,
            targetX,
            targetY
        );

        if (path && path.length > 0) {
            this.path = path;
            this.pathIndex = 0;
            if (this.state !== 'ESCAPING') {
                this.state = 'MOVING';
            }
            console.log(`[${this.unit.id}] Path found: ${path.length} steps`);
        } else {
            console.log(`[${this.unit.id}] Path blocked or invalid.`);
            this.state = 'WAITING_FOR_PATH';
            this.retryTimer = 1.0;
            this.targetX = targetX;
            this.targetY = targetY;
        }
    }

    processMovement(dt) {
        // Wait for path to be set (async requestPath may still be running)
        if (!this.path || this.path.length === 0) {
            return; // Path not ready yet
        }

        if (this.pathIndex >= this.path.length) {
            // Arrived at destination
            this.onArrival();
            return;
        }

        const nextNode = this.path[this.pathIndex];
        // Debug: Log unit position before movement (toggle with window.DEBUG_MOVEMENT = true)
        if (window.DEBUG_MOVEMENT && this.pathIndex === 0) {
            console.log(`[${this.unit.id}] Movement Start - UnitPos: (${this.unit.gridPos.x},${this.unit.gridPos.y}), Target: (${nextNode.x},${nextNode.y})`);
            console.log(`[${this.unit.id}] WorldPos: (${Math.round(this.unit.worldPos.x)},${Math.round(this.unit.worldPos.y)})`);
        }

        // Check if next tile is a locked door
        const nextTile = window.tileMap?.getTile(nextNode.x, nextNode.y);
        if (nextTile && nextTile.type === 'DOOR' && nextTile.isLocked) {
            // Calculate unlock duration from tile data (data-driven)
            let unlockTime = nextTile.unlockDuration || 10.0;  // Default fallback

            // Check if quick unlock arrangement was purchased
            if (nextTile.quickUnlockArrangement && nextTile.quickUnlockDuration !== null) {
                const hasArrangement = window.arrangementEngine?.hasPurchased(nextTile.quickUnlockArrangement);
                if (hasArrangement) {
                    unlockTime = nextTile.quickUnlockDuration;
                }
            }

            this.unlockDuration = unlockTime;

            // Pause to unlock the door
            console.log(`[${this.unit.id}] Encountered locked door at (${nextNode.x},${nextNode.y}) - unlocking (${this.unlockDuration}s)`);
            this.unlockingTile = nextTile;
            this.unlockTimer = 0;
            this.state = 'UNLOCKING';
            return;
        }

        const arrived = this.unit.moveTowards(nextNode.x, nextNode.y, dt);
        if (arrived) {
            if (window.DEBUG_MOVEMENT) {
                console.log(`[${this.unit.id}] Arrived at step ${this.pathIndex}: (${nextNode.x},${nextNode.y}), WorldPos: (${Math.round(this.unit.worldPos.x)},${Math.round(this.unit.worldPos.y)})`);
            }

            // Auto-open unlocked doors when stepping on them
            if (nextTile && nextTile.type === 'DOOR' && nextTile.doorState === 'CLOSED') {
                nextTile.openDoor();
            }

            this.pathIndex++;
        }
    }

    /**
     * Process door unlocking - crew member picks the lock
     * Time depends on whether vault codes were purchased
     */
    processUnlocking(dt) {
        // Check if this is a vault door and codes were purchased
        const hasVaultCodes = window.arrangementEngine?.hasPurchased('vault_codes');
        const isVaultDoor = this.unlockingTile?.x === 23 && this.unlockingTile?.y === 22;

        // Tiered unlock times: vault with codes = 1.5s, otherwise = 10s
        const QUICK_UNLOCK = 1.5;   // With vault codes
        const SLOW_UNLOCK = 10.0;   // Lockpicking
        const unlockDuration = (isVaultDoor && hasVaultCodes) ? QUICK_UNLOCK : SLOW_UNLOCK;

        this.unlockTimer += dt;

        if (this.unlockTimer >= unlockDuration) {
            // Door unlocked!
            if (this.unlockingTile) {
                this.unlockingTile.unlockDoor();
                this.unlockingTile.openDoor();
                const method = (isVaultDoor && hasVaultCodes) ? 'using codes' : 'picked lock';
                console.log(`[${this.unit.id}] Door unlocked (${method})!`);

                // Refresh pathfinder since walkability changed
                if (window.pathfinder) {
                    window.pathfinder.refresh();
                }
            }

            this.unlockingTile = null;
            this.unlockTimer = 0;

            // Resume movement
            this.state = this.currentObjective?.type === 'ESCAPE' ? 'ESCAPING' : 'MOVING';
        }
    }

    onArrival() {
        const obj = this.currentObjective;
        if (!obj) return;

        switch (obj.type) {
            case 'ACTION':
                this.state = 'INTERACTING';
                // TODO: Start interaction animation/timer
                break;
            case 'HOLD':
                this.state = 'HOLDING';
                console.log(`[${this.unit.id}] Now HOLDING in zone`);
                break;
            case 'LOOT':
                this.state = 'INTERACTING';
                // Mark primary loot as secured if applicable
                if (obj.priority === 'PRIMARY') {
                    GameManager.gameState.flags.primaryLootSecured = true;
                    console.log('[GAME] Primary loot secured! EXFIL signal fired.');
                }
                break;
            case 'ESCAPE':
                console.log(`[${this.unit.id}] EXTRACTED!`);
                this.unit.isExtracted = true;

                // Notify outcome engine for loot tracking
                if (window.outcomeEngine) {
                    window.outcomeEngine.extractUnit(this.unit);
                }

                this.completeObjective();
                break;
        }
    }

    processInteraction(dt) {
        // Get the target interactable
        const interactable = this.targetInteractable;
        if (!interactable) {
            console.warn(`[${this.unit.id}] No target interactable for interaction!`);
            this.completeObjective();
            return;
        }

        // Start interaction if not already started
        if (interactable.state !== 'IN_PROGRESS') {
            interactable.startInteraction(this.unit.id);
            console.log(`[${this.unit.id}] Started interacting with ${interactable.label} (${interactable.duration}s)`);
        }

        // Update progress
        const complete = interactable.updateProgress(dt);

        if (complete) {
            // Perform skill check (simple: always succeed for now)
            const result = interactable.completeInteraction(true);
            console.log(`[${this.unit.id}] Interaction complete: ${result.message}`);

            // Handle result (intel, loot, etc.)
            if (result.intel && window.GameManager) {
                window.GameManager.gameState.intel += result.intel;
            }

            // Create LootBag for safe cracks instead of directly adding cash
            if (result.loot && result.type === 'safe_crack') {
                const lootBag = new LootBag({
                    sourceId: result.interactableId || interactable.id,
                    name: result.lootName || 'Loot',
                    value: result.loot,
                    isScore: result.isScore || false
                });

                // Unit picks up the loot
                this.unit.pickupLoot(lootBag);
                console.log(`[${this.unit.id}] Picked up ${lootBag.name} ($${lootBag.value})${lootBag.isScore ? ' [THE SCORE]' : ''}`);
            }

            this.targetInteractable = null;
            this.completeObjective();
        }
    }

    processRetry(dt) {
        this.retryTimer -= dt;
        if (this.retryTimer <= 0) {
            this.retryTimer = 1.0;
            console.log(`[${this.unit.id}] Retrying path...`);
            this.requestPath(this.targetX, this.targetY);
        }
    }

    completeObjective() {
        if (!this.currentObjective) return;
        console.log(`[${this.unit.id}] Objective Complete: ${this.currentObjective.label}`);
        this.currentObjective.status = 'COMPLETED';
        this.currentObjective = null;
        this.state = 'IDLE';
    }
}
