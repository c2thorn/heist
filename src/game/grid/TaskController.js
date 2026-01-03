/**
 * TaskController - Per-unit task queue processor
 * Per SPEC_003 Section 2 - The Task Queue Architecture
 */

import { TaskType, TaskStatus } from './Task.js';
import { signalBus } from './SignalBus.js';

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
     * Get queue length
     */
    get queueLength() {
        return this.taskQueue.length + (this.currentTask ? 1 : 0);
    }
}
