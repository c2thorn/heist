/**
 * Debug Configuration
 * Controls console logging throughout the application
 */
export const DEBUG = {
    /** Master switch - set to false to disable all debug logs */
    enabled: true,

    /** Category-specific flags */
    categories: {
        spawn: true,       // Crew spawning
        camera: false,     // Camera/viewport movement
        pathfinding: false,// Unit movement and pathfinding
        detection: true,   // Guard vision and detection
        events: false,     // Event dispatching
        simulation: true,  // Task processing
        loading: true,     // Map/building loading
        sectors: true,     // Intel and sector management
        arrangements: true // Support assets
    }
};

/**
 * Conditional log helper
 * @param {string} category - Log category (must exist in DEBUG.categories)
 * @param {...any} args - Arguments to log
 */
export function debugLog(category, ...args) {
    if (DEBUG.enabled && DEBUG.categories[category]) {
        console.log(`[${category.toUpperCase()}]`, ...args);
    }
}
