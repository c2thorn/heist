/**
 * Task - Data class for crew task queue items
 * Per SPEC_003 Section 2 - Command Queue & Crew AI
 */

/**
 * Task types that can be queued
 */
export const TaskType = {
    MOVE: 'MOVE',           // Move to a grid position
    WAIT: 'WAIT',           // Wait for a duration
    SIGNAL: 'SIGNAL',       // Emit a signal to the bus
    INTERACT: 'INTERACT'    // Future: interact with object
};

/**
 * Task execution status
 */
export const TaskStatus = {
    PENDING: 'PENDING',     // Waiting in queue
    BLOCKED: 'BLOCKED',     // Waiting for signal dependency
    ACTIVE: 'ACTIVE',       // Currently executing
    COMPLETED: 'COMPLETED', // Successfully finished
    FAILED: 'FAILED'        // Failed to complete
};

/**
 * Task class - represents a single queued action
 */
export class Task {
    /**
     * Create a new Task
     * @param {string} type - TaskType value
     * @param {Object} target - Target data (position, signal name, etc.)
     * @param {Object} options - Additional options
     * @param {string} options.waitForSignal - Signal ID to wait for before executing
     * @param {string} options.emitSignal - Signal ID to emit after completing
     * @param {number} options.duration - Duration in seconds (for WAIT tasks)
     */
    constructor(type, target, options = {}) {
        this.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.type = type;
        this.target = target;
        this.status = TaskStatus.PENDING;
        
        // Logic Gate properties (SPEC_003 Section 4)
        this.waitForSignal = options.waitForSignal || null;
        this.emitSignal = options.emitSignal || null;
        
        // Task-specific properties
        this.duration = options.duration || 0;  // For WAIT tasks
        this.elapsed = 0;                        // Progress tracking
        
        // Metadata
        this.createdAt = Date.now();
        this.startedAt = null;
        this.completedAt = null;
    }

    /**
     * Mark task as started
     */
    start() {
        this.status = TaskStatus.ACTIVE;
        this.startedAt = Date.now();
    }

    /**
     * Mark task as completed
     */
    complete() {
        this.status = TaskStatus.COMPLETED;
        this.completedAt = Date.now();
    }

    /**
     * Mark task as failed
     * @param {string} reason - Failure reason
     */
    fail(reason) {
        this.status = TaskStatus.FAILED;
        this.completedAt = Date.now();
        this.failReason = reason;
    }

    /**
     * Mark task as blocked (waiting for signal)
     */
    block() {
        this.status = TaskStatus.BLOCKED;
    }

    /**
     * Check if task is finished (completed or failed)
     */
    get isFinished() {
        return this.status === TaskStatus.COMPLETED || this.status === TaskStatus.FAILED;
    }

    /**
     * Check if task is blocked on a signal
     */
    get isBlocked() {
        return this.status === TaskStatus.BLOCKED;
    }

    /**
     * Create a MOVE task
     * @param {number} x - Target grid X
     * @param {number} y - Target grid Y
     * @param {Object} options - Additional options
     */
    static move(x, y, options = {}) {
        return new Task(TaskType.MOVE, { x, y }, options);
    }

    /**
     * Create a WAIT task
     * @param {number} duration - Duration in seconds
     * @param {Object} options - Additional options
     */
    static wait(duration, options = {}) {
        return new Task(TaskType.WAIT, null, { ...options, duration });
    }

    /**
     * Create a SIGNAL task
     * @param {string} signalId - Signal to emit
     * @param {Object} options - Additional options
     */
    static signal(signalId, options = {}) {
        return new Task(TaskType.SIGNAL, signalId, options);
    }
}
