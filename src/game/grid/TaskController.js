/**
 * TaskController - Per-unit task queue processor
 * Per SPEC_003 Section 2 - The Task Queue Architecture
 */

import { Task, TaskType, TaskStatus } from './Task.js';
import { signalBus } from './SignalBus.js';
import { SkillCheck } from './SkillCheck.js';
import { InteractableState } from './Interactable.js';

/**
 * TaskController class - manages and executes a unit's task queue
 */
export class TaskController {
    /**
     * Create a TaskController for a unit
     * @param {Unit} unit - The unit this controller belongs to
     * @param {Pathfinder} pathfinder - Reference to pathfinder for MOVE tasks
     */
    constructor(unit, pathfinder = null) {
        this.unit = unit;
        this.pathfinder = pathfinder;

        this.taskQueue = [];        // FIFO queue of pending tasks
        this.currentTask = null;    // Currently executing task
        this.isPaused = false;      // Pause for reactions (SOP)
    }

    /**
     * Add a task to the queue
     * @param {Task} task - Task to add
     */
    addTask(task) {
        this.taskQueue.push(task);
        console.log(`[TaskController:${this.unit.id}] Task added: ${task.type} (${task.id})`);
    }

    /**
     * Add multiple tasks to the queue
     * @param {Task[]} tasks - Array of tasks to add
     */
    addTasks(tasks) {
        tasks.forEach(task => this.addTask(task));
    }

    /**
     * Clear all pending tasks (keeps current task running)
     */
    clearQueue() {
        this.taskQueue = [];
        console.log(`[TaskController:${this.unit.id}] Queue cleared`);
    }

    /**
     * Stop everything - clear queue and cancel current task
     */
    abort() {
        this.clearQueue();
        if (this.currentTask) {
            this.currentTask.fail('Aborted');
            this.currentTask = null;
        }
        this.unit.stop();
    }

    /**
     * Pause task execution (e.g., for SOP reactions)
     */
    pause() {
        this.isPaused = true;
    }

    /**
     * Resume task execution
     */
    resume() {
        this.isPaused = false;
    }

    /**
     * Main update loop - call every frame
     * @param {number} deltaTime - Time since last frame in seconds
     */
    update(deltaTime) {
        // Safety check: paused for reactions
        if (this.isPaused) return;

        // If we have a current task, process it
        if (this.currentTask) {
            this._processCurrentTask(deltaTime);
            return;
        }

        // No current task - try to fetch next from queue
        if (this.taskQueue.length === 0) return;

        const nextTask = this.taskQueue[0];

        // Check signal dependency
        if (nextTask.waitForSignal) {
            if (!signalBus.check(nextTask.waitForSignal)) {
                // Still waiting for signal
                nextTask.block();
                return;
            }
            // Signal received - can proceed
            console.log(`[TaskController:${this.unit.id}] Signal received: "${nextTask.waitForSignal}"`);
        }

        // Pop task from queue and start it
        this.currentTask = this.taskQueue.shift();
        this._startTask(this.currentTask);
    }

    /**
     * Start executing a task
     * @param {Task} task - Task to start
     */
    _startTask(task) {
        task.start();
        console.log(`[TaskController:${this.unit.id}] Starting task: ${task.type}`);

        switch (task.type) {
            case TaskType.MOVE:
                this._startMoveTask(task);
                break;
            case TaskType.WAIT:
                // Nothing to start - just tick elapsed time
                break;
            case TaskType.SIGNAL:
                this._executeSignalTask(task);
                break;
            case TaskType.INTERACT:
                this._startInteractTask(task);
                break;
            default:
                console.warn(`[TaskController:${this.unit.id}] Unknown task type: ${task.type}`);
                task.fail('Unknown task type');
                this.currentTask = null;
        }
    }

    /**
     * Process the current task each frame
     * @param {number} deltaTime - Time since last frame
     */
    _processCurrentTask(deltaTime) {
        const task = this.currentTask;

        switch (task.type) {
            case TaskType.MOVE:
                this._processMoveTask(task);
                break;
            case TaskType.WAIT:
                this._processWaitTask(task, deltaTime);
                break;
            case TaskType.SIGNAL:
                // Signal tasks complete immediately in _startTask
                break;
            case TaskType.INTERACT:
                this._processInteractTask(task, deltaTime);
                break;
        }
    }

    /**
     * Start a MOVE task
     */
    _startMoveTask(task) {
        if (!this.pathfinder) {
            task.fail('No pathfinder available');
            this.currentTask = null;
            return;
        }

        const target = task.target;

        // Calculate path using async pathfinder
        this.pathfinder.findPath(
            this.unit.gridPos.x,
            this.unit.gridPos.y,
            target.x,
            target.y,
            (path) => {
                if (path && path.length > 0) {
                    this.unit.setPath(path);
                } else {
                    console.warn(`[TaskController:${this.unit.id}] No path found to (${target.x}, ${target.y})`);
                    task.fail('No path found');
                    this.currentTask = null;
                }
            }
        );
    }

    /**
     * Process a MOVE task (check if arrived)
     */
    _processMoveTask(task) {
        const target = task.target;

        // Check if unit has arrived at destination
        if (this.unit.isAt(target.x, target.y) && !this.unit.isMoving) {
            this._completeTask(task);
        }
    }

    /**
     * Process a WAIT task
     */
    _processWaitTask(task, deltaTime) {
        task.elapsed += deltaTime;

        if (task.elapsed >= task.duration) {
            this._completeTask(task);
        }
    }

    /**
     * Execute a SIGNAL task (immediate)
     */
    _executeSignalTask(task) {
        const signalId = task.target;
        signalBus.emit(signalId);
        this._completeTask(task);
    }

    /**
     * Start an INTERACT task
     */
    _startInteractTask(task) {
        const interactable = task.target;

        if (!interactable) {
            task.fail('No interactable target');
            this.currentTask = null;
            return;
        }

        // Store interaction state on task
        task._interactPhase = 'APPROACHING';  // APPROACHING, INTERACTING
        task._interactable = interactable;

        // Check if already adjacent
        const dx = Math.abs(this.unit.gridPos.x - interactable.gridX);
        const dy = Math.abs(this.unit.gridPos.y - interactable.gridY);

        if (dx <= 1 && dy <= 1) {
            // Already in range - start interacting
            this._beginInteraction(task);
        } else {
            // Need to move to approach tile first
            if (!this.pathfinder) {
                task.fail('No pathfinder for approach');
                this.currentTask = null;
                return;
            }

            // Find best approach tile
            const approachTiles = interactable.getApproachTiles(this.unit.tileMap);
            if (approachTiles.length === 0) {
                task.fail('No approach tiles available');
                this.currentTask = null;
                return;
            }

            // Pick closest approach tile
            let bestTile = approachTiles[0];
            let bestDist = Infinity;
            for (const tile of approachTiles) {
                const d = Math.abs(tile.x - this.unit.gridPos.x) +
                    Math.abs(tile.y - this.unit.gridPos.y);
                if (d < bestDist) {
                    bestDist = d;
                    bestTile = tile;
                }
            }

            // Path to approach tile
            this.pathfinder.findPath(
                this.unit.gridPos.x,
                this.unit.gridPos.y,
                bestTile.x,
                bestTile.y
            ).then(path => {
                if (path && path.length > 0) {
                    this.unit.setPath(path);
                } else {
                    task.fail('No path to interactable');
                    this.currentTask = null;
                }
            });
        }
    }

    /**
     * Begin the actual interaction (after approaching)
     */
    _beginInteraction(task) {
        const interactable = task._interactable;

        // Check if we can interact
        const check = interactable.canInteract(this.unit);
        if (!check.canInteract) {
            task.fail(check.reason);
            this.currentTask = null;
            return;
        }

        // Start the interaction
        task._interactPhase = 'INTERACTING';
        interactable.startInteraction(this.unit.id);
        console.log(`[TaskController:${this.unit.id}] Interacting with ${interactable.label}...`);
    }

    /**
     * Process an INTERACT task each frame
     */
    _processInteractTask(task, deltaTime) {
        const interactable = task._interactable;

        if (task._interactPhase === 'APPROACHING') {
            // Check if we've arrived adjacent to the target
            const dx = Math.abs(this.unit.gridPos.x - interactable.gridX);
            const dy = Math.abs(this.unit.gridPos.y - interactable.gridY);

            if (dx <= 1 && dy <= 1 && !this.unit.isMoving) {
                this._beginInteraction(task);
            }
        } else if (task._interactPhase === 'INTERACTING') {
            // Update interaction progress
            const complete = interactable.updateProgress(deltaTime);

            if (complete) {
                // Perform skill check
                const modifier = SkillCheck.getModifier(this.unit, interactable);
                const result = SkillCheck.roll(modifier, interactable.dc);

                console.log(`[SkillCheck] ${result.toString()}`);

                // Complete the interaction
                const outcome = interactable.completeInteraction(result.success);

                // Dispatch event for UI logging
                window.dispatchEvent(new CustomEvent('heistEventLog', {
                    detail: {
                        message: `${this.unit.id}: ${outcome.message} (${result.toString()})`,
                        outcome: result.success ? 'SUCCESS' : 'FAILURE'
                    }
                }));

                // Handle interaction result
                this._handleInteractionResult(outcome);

                if (result.success) {
                    this._completeTask(task);
                } else {
                    task.fail(outcome.message);
                    this.currentTask = null;
                }
            }
        }
    }

    /**
     * Handle the result of an interaction
     */
    _handleInteractionResult(result) {
        switch (result.type) {
            case 'door_unlock':
                // Open the door tile
                if (this.unit.tileMap) {
                    const tile = this.unit.tileMap.getTile(result.gridX, result.gridY);
                    if (tile && tile.openDoor) {
                        tile.openDoor();
                        // Refresh pathfinder if we have one
                        if (this.pathfinder) {
                            this.pathfinder.refresh();
                        }
                    }
                }
                break;

            case 'computer_hack':
                // Award intel
                if (result.intel && window.GameManager) {
                    // TODO: Connect to game state
                }
                if (result.disableCameras) {
                    // TODO: Disable cameras in zone
                }
                break;

            case 'safe_crack':
                // Award loot
                if (result.loot && window.GameManager) {
                    // TODO: Connect to game state
                }
                break;

            case 'panel_disable':
                // Disable security in zone
                // TODO: Implement zone disabling
                break;

            case 'door_fail':
            case 'computer_fail':
            case 'safe_fail':
            case 'panel_fail':
                // Handle failure consequences
                if (result.noise && window.threatClock) {
                    window.threatClock.addPenalty(result.noise);
                }
                if (result.triggerAlarm && window.threatClock) {
                    window.threatClock.addPenalty(30);  // Big penalty for alarms
                }
                break;
        }
    }

    /**
     * Complete the current task
     */
    _completeTask(task) {
        task.complete();
        console.log(`[TaskController:${this.unit.id}] Task completed: ${task.type} (${task.id})`);

        // Emit signal if configured
        if (task.emitSignal) {
            signalBus.emit(task.emitSignal);
        }

        this.currentTask = null;
    }

    /**
     * Get current task status for UI display
     */
    getStatus() {
        if (this.isPaused) return 'PAUSED';
        if (this.currentTask) return `${this.currentTask.type}: ${this.currentTask.status}`;
        if (this.taskQueue.length > 0) {
            const next = this.taskQueue[0];
            if (next.isBlocked) return `WAITING: ${next.waitForSignal}`;
            return 'PENDING';
        }
        return 'IDLE';
    }

    /**
     * Handle an external stimulus (Sound, Etc.)
     * @param {Object} stimulus - { type, origin, radius, priority }
     */
    handleStimulus(stimulus) {
        console.log(`[TaskController:${this.unit.id}] Reacting to stimulus: ${stimulus.type}`);

        // Simple reactions for now:
        // Clear queue? Depending on priority.
        // For HIGH priority (10+), we drop everything and look.

        if (stimulus.priority >= 5) {
            // Pause current task if possible? Or just abort.
            // For MVP: Abort current path, move to sound.

            // Abort current tasks
            this.clearQueue();
            if (this.currentTask) {
                // We don't want to FAIL, just interrupt.
                this.currentTask.fail('Interrupted by stimulus');
                this.currentTask = null;
            }
            this.unit.stop();

            // Create Investigation Task
            // 1. Move to origin
            const moveTask = new Task(TaskType.MOVE, { x: stimulus.origin.x, y: stimulus.origin.y });

            // 2. Wait/Look around
            const waitTask = new Task(TaskType.WAIT, 2.0); // Look for 2 seconds

            this.addTask(moveTask);
            this.addTask(waitTask);

            console.log(`[TaskController:${this.unit.id}] Queued investigation of (${stimulus.origin.x}, ${stimulus.origin.y})`);
        }
    }

    /**
     * Get queue length
     */
    get queueLength() {
        return this.taskQueue.length + (this.currentTask ? 1 : 0);
    }
}

