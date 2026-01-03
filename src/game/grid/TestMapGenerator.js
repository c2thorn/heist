import { GridConfig } from './GridConfig.js';
import { TileMap } from './TileMap.js';

/**
 * TestMapGenerator - creates sample building layouts for development/testing
 * Generates blueprint-style building with distinct rooms
 */
export class TestMapGenerator {
    /**
     * Generate a simple test building layout
     * @param {number} width - Map width in tiles (default 32)
     * @param {number} height - Map height in tiles (default 32)
     * @returns {TileMap} Generated map
     */
    static generateSimpleBuilding(width = 32, height = 32) {
        const map = new TileMap(width, height);

        // Define zone colors for rendering
        map.defineZone('exterior', 'Exterior', '#1a1a2e');
        map.defineZone('lobby', 'Lobby', '#2d3a4a');
        map.defineZone('hallway', 'Hallway', '#3d4a5a');
        map.defineZone('office', 'Office', '#4a5568');
        map.defineZone('vault', 'Vault', '#1e3a5f');
        map.defineZone('security', 'Security Room', '#5a3a3a');
        map.defineZone('server', 'Server Room', '#2a4a3a');

        // =====================================================================
        // Building shell (outer walls from 2,2 to 29,29)
        // =====================================================================
        const bx1 = 2, by1 = 2, bx2 = 29, by2 = 29;

        // Fill entire building footprint with floor first
        map.fillRect(bx1 + 1, by1 + 1, bx2 - 1, by2 - 1, GridConfig.TILE_TYPE.FLOOR);

        // Draw outer walls
        map.drawRect(bx1, by1, bx2, by2, GridConfig.TILE_TYPE.WALL);

        // =====================================================================
        // Room Layout
        // =====================================================================

        // --- LOBBY (bottom center: 10,22 to 21,28) ---
        map.assignZone('lobby', 10, 22, 21, 28);
        // Interior walls around lobby
        map.drawRect(10, 22, 21, 28, GridConfig.TILE_TYPE.WALL);
        // Clear interior floor
        map.fillRect(11, 23, 20, 27, GridConfig.TILE_TYPE.FLOOR);
        // Entry door (bottom, open to exterior)
        map.setTile(15, 28, GridConfig.TILE_TYPE.DOOR);
        map.setTile(16, 28, GridConfig.TILE_TYPE.DOOR);
        // Door to hallway (top)
        map.setTile(15, 22, GridConfig.TILE_TYPE.DOOR);
        map.setTile(16, 22, GridConfig.TILE_TYPE.DOOR);

        // --- MAIN HALLWAY (horizontal: 5,13 to 26,16) ---
        map.fillRect(5, 13, 26, 16, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('hallway', 5, 13, 26, 16);
        // Hallway walls (top and bottom)
        for (let x = 5; x <= 26; x++) {
            map.setTile(x, 13, GridConfig.TILE_TYPE.WALL);
            map.setTile(x, 16, GridConfig.TILE_TYPE.WALL);
        }
        // Clear walkable corridor
        map.fillRect(5, 14, 26, 15, GridConfig.TILE_TYPE.FLOOR);

        // Vertical connector from lobby to hallway
        map.fillRect(14, 17, 17, 21, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('hallway', 14, 17, 17, 21);
        map.setTile(14, 17, GridConfig.TILE_TYPE.WALL);
        map.setTile(17, 17, GridConfig.TILE_TYPE.WALL);
        map.setTile(14, 21, GridConfig.TILE_TYPE.WALL);
        map.setTile(17, 21, GridConfig.TILE_TYPE.WALL);
        // Open passage at hallway connection
        map.setTile(15, 16, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(16, 16, GridConfig.TILE_TYPE.FLOOR);

        // --- OFFICE 1 (top left: 4,4 to 12,11) ---
        map.fillRect(4, 4, 12, 11, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('office', 4, 4, 12, 11);
        map.drawRect(4, 4, 12, 11, GridConfig.TILE_TYPE.WALL);
        map.fillRect(5, 5, 11, 10, GridConfig.TILE_TYPE.FLOOR);
        // Door to hallway
        map.setTile(8, 11, GridConfig.TILE_TYPE.DOOR);
        // Connect to hallway (open wall below door)
        map.setTile(8, 12, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(8, 13, GridConfig.TILE_TYPE.DOOR);

        // --- SECURITY ROOM (top center: 14,4 to 21,11) ---
        map.fillRect(14, 4, 21, 11, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('security', 14, 4, 21, 11);
        map.drawRect(14, 4, 21, 11, GridConfig.TILE_TYPE.WALL);
        map.fillRect(15, 5, 20, 10, GridConfig.TILE_TYPE.FLOOR);
        // Door to hallway
        map.setTile(17, 11, GridConfig.TILE_TYPE.DOOR);
        map.setTile(18, 11, GridConfig.TILE_TYPE.DOOR);
        // Connect to hallway
        map.setTile(17, 12, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(18, 12, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(17, 13, GridConfig.TILE_TYPE.DOOR);
        map.setTile(18, 13, GridConfig.TILE_TYPE.DOOR);

        // --- SERVER ROOM (top right: 23,4 to 28,11) ---
        map.fillRect(23, 4, 28, 11, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('server', 23, 4, 28, 11);
        map.drawRect(23, 4, 28, 11, GridConfig.TILE_TYPE.WALL);
        map.fillRect(24, 5, 27, 10, GridConfig.TILE_TYPE.FLOOR);
        // Door to hallway
        map.setTile(25, 11, GridConfig.TILE_TYPE.DOOR);
        map.setTile(25, 12, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(25, 13, GridConfig.TILE_TYPE.DOOR);

        // --- VAULT (right side: 23,18 to 28,27) ---
        map.fillRect(23, 18, 28, 27, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('vault', 23, 18, 28, 27);
        map.drawRect(23, 18, 28, 27, GridConfig.TILE_TYPE.WALL);
        map.fillRect(24, 19, 27, 26, GridConfig.TILE_TYPE.FLOOR);
        // Heavy vault door
        map.setTile(23, 22, GridConfig.TILE_TYPE.DOOR);
        // Horizontal connector from hallway to vault area
        map.fillRect(22, 14, 22, 22, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(26, 14, GridConfig.TILE_TYPE.FLOOR);
        map.setTile(26, 15, GridConfig.TILE_TYPE.FLOOR);

        // =====================================================================
        // Reveal the building for testing (normally would be HIDDEN)
        // =====================================================================
        map.revealAll();

        return map;
    }

    /**
     * Generate a minimal test grid (for basic testing)
     * @returns {TileMap} Simple 16x16 map
     */
    static generateMinimal() {
        const map = new TileMap(16, 16);

        map.defineZone('room', 'Test Room', '#4a5568');

        // Outer walls
        map.drawRect(2, 2, 13, 13, GridConfig.TILE_TYPE.WALL);

        // Interior floor
        map.fillRect(3, 3, 12, 12, GridConfig.TILE_TYPE.FLOOR);
        map.assignZone('room', 3, 3, 12, 12);

        // Single door
        map.setTile(7, 13, GridConfig.TILE_TYPE.DOOR);

        map.revealAll();

        return map;
    }
}
