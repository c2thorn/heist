import { TileMap } from './TileMap.js';
import { GridConfig } from './GridConfig.js';
import { Unit } from './Unit.js';
import { VisionCone } from './VisionCone.js';
import { Safe, Computer, SecurityPanel } from './Interactable.js';
import { ExtractionPoint } from './ExtractionPoint.js';

/**
 * BuildingLoader - Creates TileMap and entities from building JSON data
 * Replaces TestMapGenerator with data-driven building creation
 */
export class BuildingLoader {
    /**
     * Load a building from JSON data
     * @param {Object} data - Building JSON
     * @returns {{ tileMap: TileMap, guards: Array, interactables: Array, crewSpawns: Array, visionCones: Array }}
     */
    static load(data) {
        const { width, height, zones, rooms, building, guards, interactables, crewSpawns, openDoors, initiallyRevealed, score, sideScores, extraction } = data;

        // 1. Create TileMap
        const tileMap = new TileMap(width, height);

        // 2. Define zones
        for (const zone of zones) {
            tileMap.defineZone(zone.id, zone.name, zone.color);
        }

        // 3. Build shell
        if (building?.shell) {
            const { x1, y1, x2, y2 } = building.shell;
            // Fill interior with floor
            tileMap.fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, GridConfig.TILE_TYPE.FLOOR);
            // Draw outer walls
            tileMap.drawRect(x1, y1, x2, y2, GridConfig.TILE_TYPE.WALL);
        }

        // 4. Build rooms
        for (const room of rooms) {
            this._buildRoom(tileMap, room);
        }

        // 5. Open doors that should start open
        if (openDoors) {
            for (const door of openDoors) {
                const tile = tileMap.getTile(door.x, door.y);
                if (tile && tile.openDoor) {
                    tile.openDoor();
                }
            }
        }

        // 6. Set initial visibility (default all hidden)
        // Then reveal specified zones
        if (initiallyRevealed) {
            for (const zoneId of initiallyRevealed) {
                tileMap.setZoneVisibility(zoneId, GridConfig.VISIBILITY.REVEALED);
            }
        }

        // 7. Always reveal VOID tiles (exterior/outside - shouldn't be hidden)
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const tile = tileMap.getTile(x, y);
                if (tile && tile.type === GridConfig.TILE_TYPE.VOID) {
                    tile.setVisibility(GridConfig.VISIBILITY.VISIBLE);
                }
            }
        }

        // 7. Parse guards
        const guardEntities = [];
        const visionCones = [];
        if (guards) {
            for (const guardData of guards) {
                const { guard, visionCone } = this._createGuard(guardData, tileMap);
                guardEntities.push(guard);
                if (visionCone) {
                    visionCones.push(visionCone);
                }
            }
        }

        // 8. Parse interactables
        const interactableEntities = [];
        if (interactables) {
            for (const intData of interactables) {
                // Check if this interactable is THE Score
                const isScore = score && score.interactableId === intData.id;
                const scoreConfig = isScore ? {
                    isScore: true,
                    lootValue: score.value,
                    lootName: score.name
                } : {};

                const entity = this._createInteractable({ ...intData, ...scoreConfig });
                if (entity) {
                    interactableEntities.push(entity);
                }
            }
        }

        // 9. Parse crew spawns
        const spawns = crewSpawns || [{ x: width / 2, y: height - 4, default: true }];

        // 10. Parse extraction points
        const extractionPoints = [];
        if (extraction?.points) {
            for (const pointData of extraction.points) {
                extractionPoints.push(new ExtractionPoint(pointData));
            }
        }

        // 11. Parse score data (for HeistOutcomeEngine)
        const scoreData = score || null;
        const sideScoreData = sideScores || [];

        return {
            tileMap,
            guards: guardEntities,
            interactables: interactableEntities,
            crewSpawns: spawns,
            visionCones,
            extractionPoints,
            scoreData,
            sideScoreData
        };
    }

    /**
     * Build a room from room data
     */
    static _buildRoom(tileMap, room) {
        const { zone, bounds, interior, doors, connections, customWalls } = room;

        // Fill with floor and assign zone
        if (bounds) {
            tileMap.fillRect(bounds.x1, bounds.y1, bounds.x2, bounds.y2, GridConfig.TILE_TYPE.FLOOR);
            tileMap.assignZone(zone, bounds.x1, bounds.y1, bounds.x2, bounds.y2);

            // Draw walls around bounds
            tileMap.drawRect(bounds.x1, bounds.y1, bounds.x2, bounds.y2, GridConfig.TILE_TYPE.WALL);
        }

        // Clear interior
        if (interior) {
            tileMap.fillRect(interior.x1, interior.y1, interior.x2, interior.y2, GridConfig.TILE_TYPE.FLOOR);
        }

        // Custom walls (for hallways etc)
        if (customWalls) {
            for (const wall of customWalls) {
                if (wall.type === 'horizontal') {
                    for (let x = wall.x1; x <= wall.x2; x++) {
                        tileMap.setTile(x, wall.y, GridConfig.TILE_TYPE.WALL);
                    }
                } else if (wall.type === 'vertical') {
                    for (let y = wall.y1; y <= wall.y2; y++) {
                        tileMap.setTile(wall.x, y, GridConfig.TILE_TYPE.WALL);
                    }
                }
            }
        }

        // Place doors and lock if specified
        if (doors) {
            for (const door of doors) {
                tileMap.setTile(door.x, door.y, GridConfig.TILE_TYPE.DOOR);
                const tile = tileMap.getTile(door.x, door.y);
                if (tile) {
                    if (door.locked) {
                        tile.lockDoor();
                    }
                    // Store unlock timing data if provided
                    if (door.unlockDuration !== undefined) {
                        tile.unlockDuration = door.unlockDuration;
                    }
                    if (door.quickUnlockDuration !== undefined) {
                        tile.quickUnlockDuration = door.quickUnlockDuration;
                    }
                    if (door.quickUnlockArrangement) {
                        tile.quickUnlockArrangement = door.quickUnlockArrangement;
                    }
                }
            }
        }

        // Connections (floors/passages to other rooms)
        if (connections) {
            for (const conn of connections) {
                if (conn.x1 !== undefined && conn.y1 !== undefined) {
                    // Range connection
                    tileMap.fillRect(conn.x1, conn.y1, conn.x2, conn.y2, GridConfig.TILE_TYPE.FLOOR);
                    tileMap.assignZone(zone, conn.x1, conn.y1, conn.x2, conn.y2);
                } else {
                    // Single tile
                    tileMap.setTile(conn.x, conn.y, conn.type === 'DOOR' ? GridConfig.TILE_TYPE.DOOR : GridConfig.TILE_TYPE.FLOOR);
                }
            }
        }
    }

    /**
     * Create a guard unit from data
     */
    static _createGuard(data, tileMap) {
        const guard = new Unit(data.id, data.x, data.y, tileMap);
        guard.color = data.color || '#ff4444';
        guard.radius = data.radius || 10;
        guard.isFriendly = false;

        let visionCone = null;
        if (data.visionCone) {
            const ts = GridConfig.TILE_SIZE;
            visionCone = new VisionCone({
                fov: data.visionCone.fov || 60,
                range: data.visionCone.range || 150,
                facing: data.visionCone.facing || 0
            });
            visionCone.setPosition(
                data.x * ts + ts / 2,
                data.y * ts + ts / 2,
                data.visionCone.facing || 0
            );
        }

        return { guard, visionCone };
    }

    /**
     * Create an interactable from data
     */
    static _createInteractable(data) {
        const config = {
            id: data.id,
            gridX: data.x,
            gridY: data.y,
            name: data.label,
            duration: data.duration,
            dc: data.dc,
            lootValue: data.lootValue,
            // Score-specific properties (set by load() for the primary Score)
            isScore: data.isScore || false,
            lootName: data.lootName
        };

        switch (data.type) {
            case 'SAFE':
                return new Safe(config);
            case 'COMPUTER':
                return new Computer(config);
            case 'PANEL':
                return new SecurityPanel(config);
            default:
                console.warn(`[BuildingLoader] Unknown interactable type: ${data.type}`);
                return null;
        }
    }
}
