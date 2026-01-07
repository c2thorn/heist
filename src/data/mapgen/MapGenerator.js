/**
 * MapGenerator - Procedural map generation from room templates
 * Uses grid-based placement for more square, natural layouts
 */

// Import room templates
import entranceTemplate from './rooms/global/entrance.json';
import hallwayHubTemplate from './rooms/global/hallway_hub.json';
import vaultTemplate from './rooms/bank/vault_small.json';
import securityTemplate from './rooms/bank/security_room.json';
import officeTemplate from './rooms/bank/office.json';
import tellerTemplate from './rooms/bank/teller_area.json';

// Import archetypes
import bankArchetype from './archetypes/bank.json';

// Room template registry
const ROOM_TEMPLATES = {
    entrance: entranceTemplate,
    hallway_hub: hallwayHubTemplate,
    vault_small: vaultTemplate,
    security_room: securityTemplate,
    office: officeTemplate,
    teller_area: tellerTemplate
};

// Archetype registry
const ARCHETYPES = {
    bank: bankArchetype
};

// Grid cell size (rooms are placed in cells)
const CELL_SIZE = 10; // Tiles per cell

// Door count weights: 35% for 1, 55% for 2, 10% for 3
const DOOR_COUNT_WEIGHTS = [
    { count: 1, weight: 35 },
    { count: 2, weight: 55 },
    { count: 3, weight: 10 }
];

/**
 * Roll weighted random door count
 */
function rollDoorCount() {
    const roll = Math.random() * 100;
    let sum = 0;
    for (const { count, weight } of DOOR_COUNT_WEIGHTS) {
        sum += weight;
        if (roll < sum) return count;
    }
    return 2; // Default to 2
}

/**
 * Get sides that have adjacent rooms or lead to corridor space
 */
function getValidSides(room, allRooms, gridWidth, gridHeight) {
    const sides = [];
    const dirs = [
        { side: 'north', dx: 0, dy: -1 },
        { side: 'south', dx: 0, dy: 1 },
        { side: 'east', dx: 1, dy: 0 },
        { side: 'west', dx: -1, dy: 0 }
    ];

    for (const { side, dx, dy } of dirs) {
        const nx = room.gridX + dx;
        const ny = room.gridY + dy;

        // Check if within grid bounds
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
            // Check if there's a neighbor room
            const hasNeighbor = allRooms.some(r => r.gridX === nx && r.gridY === ny);
            // Always valid if there's space (corridor will connect)
            sides.push({ side, hasNeighbor, isEdge: false });
        } else {
            // Edge of map - could be exterior entrance
            sides.push({ side, hasNeighbor: false, isEdge: true });
        }
    }

    return sides;
}

/**
 * Get door position on a room's wall
 */
function getDoorPosition(room, side) {
    // Center the door on the wall
    switch (side) {
        case 'north':
            return { x: room.x + Math.floor(room.width / 2), y: room.y };
        case 'south':
            return { x: room.x + Math.floor(room.width / 2), y: room.y + room.height - 1 };
        case 'east':
            return { x: room.x + room.width - 1, y: room.y + Math.floor(room.height / 2) };
        case 'west':
            return { x: room.x, y: room.y + Math.floor(room.height / 2) };
    }
}

/**
 * Generate a building from an archetype
 * @param {string} archetypeId - Archetype to use (e.g., 'bank')
 * @param {number} difficulty - Difficulty modifier (affects guards, cameras)
 * @returns {Object} Building JSON compatible with BuildingLoader
 */
export function generateBuilding(archetypeId, difficulty = 1) {
    const archetype = ARCHETYPES[archetypeId];
    if (!archetype) {
        console.error(`[MapGenerator] Unknown archetype: ${archetypeId}`);
        return null;
    }

    console.log(`[MapGenerator] Generating ${archetype.name} (difficulty: ${difficulty})`);

    // 1. Determine grid size (3x3 or 4x3 based on room count)
    const roomCount = archetype.minRooms + Math.floor(Math.random() * (archetype.maxRooms - archetype.minRooms + 1));
    const gridWidth = roomCount <= 6 ? 3 : 4;
    const gridHeight = 3;

    // 2. Select rooms
    const selectedRooms = selectRooms(archetype, roomCount);
    console.log(`[MapGenerator] Selected ${selectedRooms.length} rooms:`, selectedRooms.map(r => r.id));

    // 3. Calculate map size
    const mapWidth = gridWidth * CELL_SIZE + 4;  // +4 for margins
    const mapHeight = gridHeight * CELL_SIZE + 4;

    // 4. Place rooms in grid
    const placedRooms = placeRoomsInGrid(selectedRooms, gridWidth, gridHeight);

    // 5. Build the building JSON
    const building = buildBuildingJSON(archetype, placedRooms, mapWidth, mapHeight, difficulty);

    console.log(`[MapGenerator] Generated ${mapWidth}x${mapHeight} map with ${placedRooms.length} rooms`);
    return building;
}

/**
 * Select rooms for the building based on archetype requirements
 * Each room instance gets a unique zone ID (e.g., office_1, office_2)
 */
function selectRooms(archetype, targetCount) {
    const rooms = [];
    const zoneCounts = {}; // Track how many of each zone type

    // Helper to create room with unique instance zone
    function addRoom(roomId) {
        const template = ROOM_TEMPLATES[roomId];
        if (!template) return;

        const baseZone = template.zone;
        zoneCounts[baseZone] = (zoneCounts[baseZone] || 0) + 1;
        const instanceNum = zoneCounts[baseZone];

        // Create unique instance zone ID
        const instanceZone = instanceNum === 1 ? baseZone : `${baseZone}_${instanceNum}`;

        rooms.push({
            ...template,
            instanceId: `${roomId}_${instanceNum}`,
            instanceZone: instanceZone,  // Unique zone for this instance
            baseZone: baseZone            // Original zone for color lookup
        });
    }

    // Always add entrance
    addRoom('entrance');

    // Add required rooms
    for (const roomId of archetype.requiredRooms) {
        if (roomId !== 'entrance') {
            addRoom(roomId);
        }
    }

    // Fill with optional rooms
    const optional = archetype.optionalRooms.filter(id => ROOM_TEMPLATES[id]);
    while (rooms.length < targetCount && optional.length > 0) {
        const idx = Math.floor(Math.random() * optional.length);
        const roomId = optional[idx];
        addRoom(roomId);
    }

    return rooms;
}

/**
 * Place rooms in a grid pattern
 * Entrance at bottom-center, vault at top, others fill in between
 */
function placeRoomsInGrid(rooms, gridWidth, gridHeight) {
    const placed = [];
    const grid = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(null));

    // Find special rooms
    const entranceIdx = rooms.findIndex(r => r.id === 'entrance');
    const vaultIdx = rooms.findIndex(r => r.id.includes('vault'));

    // Place entrance at bottom center
    if (entranceIdx >= 0) {
        const entrance = rooms.splice(entranceIdx, 1)[0];
        const gx = Math.floor(gridWidth / 2);
        const gy = gridHeight - 1; // Bottom row
        grid[gy][gx] = entrance;
        placed.push({
            ...entrance,
            gridX: gx,
            gridY: gy,
            x: gx * CELL_SIZE + 2,
            y: gy * CELL_SIZE + 2
        });
    }

    // Find vault again after splice
    const vaultIdxNew = rooms.findIndex(r => r.id.includes('vault'));

    // Place vault at top (away from entrance)
    if (vaultIdxNew >= 0) {
        const vault = rooms.splice(vaultIdxNew, 1)[0];
        // Pick a corner at top
        const gx = Math.random() > 0.5 ? 0 : gridWidth - 1;
        const gy = 0; // Top row
        grid[gy][gx] = vault;
        placed.push({
            ...vault,
            gridX: gx,
            gridY: gy,
            x: gx * CELL_SIZE + 2,
            y: gy * CELL_SIZE + 2
        });
    }

    // Place remaining rooms in empty cells, prioritizing cells adjacent to filled ones
    for (const room of rooms) {
        const freeCell = findBestEmptyCell(grid, gridWidth, gridHeight);
        if (freeCell) {
            grid[freeCell.y][freeCell.x] = room;
            placed.push({
                ...room,
                gridX: freeCell.x,
                gridY: freeCell.y,
                x: freeCell.x * CELL_SIZE + 2,
                y: freeCell.y * CELL_SIZE + 2
            });
        }
    }

    return placed;
}

/**
 * Find the best empty cell to place a room (prioritize adjacency to filled cells)
 */
function findBestEmptyCell(grid, width, height) {
    let best = null;
    let bestScore = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (grid[y][x] !== null) continue;

            // Score based on adjacent filled cells
            let score = 0;
            if (y > 0 && grid[y - 1][x]) score++;
            if (y < height - 1 && grid[y + 1][x]) score++;
            if (x > 0 && grid[y][x - 1]) score++;
            if (x < width - 1 && grid[y][x + 1]) score++;

            // Add some randomness
            score += Math.random() * 0.5;

            if (score > bestScore) {
                bestScore = score;
                best = { x, y };
            }
        }
    }

    return best;
}

/**
 * Build the final building JSON from placed rooms
 */
function buildBuildingJSON(archetype, placedRooms, width, height, difficulty) {
    // Start with archetype zones, then add instance zones
    const zoneMap = new Map();
    for (const z of archetype.zones) {
        zoneMap.set(z.id, z);
    }

    // Collect zones by visibility requirement, using instanceZone
    const revealedZones = new Set(['exterior', 'hallway']); // Always revealed
    const hiddenZones = new Map(); // instanceZone -> { id, name, intelCost }

    for (const room of placedRooms) {
        const zoneId = room.instanceZone || room.zone;
        const baseZone = room.baseZone || room.zone;

        // Add instance zone definition if it doesn't exist
        if (!zoneMap.has(zoneId)) {
            const baseZoneDef = zoneMap.get(baseZone);
            zoneMap.set(zoneId, {
                id: zoneId,
                name: room.name,  // Use room name for instance
                color: baseZoneDef?.color || '#444444'
            });
        }

        if (room.requiresIntel) {
            hiddenZones.set(zoneId, {
                id: zoneId,
                name: room.name,
                intelCost: room.intelCost || 2
            });
        } else {
            revealedZones.add(zoneId);
        }
    }

    const building = {
        id: `generated_${archetype.id}_${Date.now()}`,
        name: archetype.flavorNames[Math.floor(Math.random() * archetype.flavorNames.length)],
        width,
        height,
        zones: [...zoneMap.values()],  // Include dynamic instance zones
        building: { shell: { x1: 1, y1: 1, x2: width - 2, y2: height - 2 } },
        rooms: [],
        guards: [],
        cameras: [],
        alarms: [],
        interactables: [],
        crewSpawns: [],
        extraction: { points: [] },
        openDoors: [],
        initiallyRevealed: [...revealedZones],
        hiddenZones: [...hiddenZones.values()],  // For SectorManager
        score: null,
        sideScores: []
    };

    let guardCount = 0;
    let cameraCount = 0;
    let interactableId = 0;
    const maxGuards = archetype.minGuards + Math.floor(difficulty * 0.5);
    const maxCameras = archetype.minCameras + Math.floor(difficulty * 0.5);

    // Create adjacency map for connection generation
    const adjacency = buildAdjacencyMap(placedRooms);

    // Process each placed room
    for (const room of placedRooms) {
        // Use instanceZone for unique zone ID per room instance
        const roomZone = room.instanceZone || room.zone;

        // Create room definition
        const roomDef = {
            zone: roomZone,
            bounds: {
                x1: room.x,
                y1: room.y,
                x2: room.x + room.width - 1,
                y2: room.y + room.height - 1
            },
            interior: {
                x1: room.x + 1,
                y1: room.y + 1,
                x2: room.x + room.width - 2,
                y2: room.y + room.height - 2
            },
            doors: [],
            connections: []
        };

        // Dynamic door generation
        const gridWidth = Math.max(...placedRooms.map(r => r.gridX)) + 1;
        const gridHeight = Math.max(...placedRooms.map(r => r.gridY)) + 1;
        const validSides = getValidSides(room, placedRooms, gridWidth, gridHeight);

        // Filter to sides with neighbors (for connectivity)
        const sidesWithNeighbors = validSides.filter(s => s.hasNeighbor);
        const edgeSides = validSides.filter(s => s.isEdge);

        // Roll door count (35% 1, 55% 2, 10% 3)
        const doorCount = rollDoorCount();

        // Prioritize sides with neighbors, then fill with edge sides if needed
        let availableSides = [...sidesWithNeighbors];
        if (availableSides.length < doorCount) {
            availableSides = [...availableSides, ...edgeSides];
        }

        // Shuffle and pick N sides
        availableSides.sort(() => Math.random() - 0.5);
        const selectedSides = availableSides.slice(0, Math.min(doorCount, availableSides.length));

        // Ensure at least one door leads to a neighbor (if possible)
        if (sidesWithNeighbors.length > 0 && !selectedSides.some(s => s.hasNeighbor)) {
            // Replace first selection with a neighbor side
            selectedSides[0] = sidesWithNeighbors[0];
        }

        // Create doors on selected sides
        for (const { side, isEdge, hasNeighbor } of selectedSides) {
            const doorPos = getDoorPosition(room, side);

            if (room.doorType === 'locked') {
                roomDef.doors.push({
                    x: doorPos.x,
                    y: doorPos.y,
                    locked: true,
                    unlockDuration: room.unlockDuration || 5.0
                });
            } else if (room.doorType === 'open') {
                roomDef.connections.push({ x: doorPos.x, y: doorPos.y, type: 'FLOOR' });
                // If edge side and room has entry point, mark as entrance
                if (isEdge && room.hasEntryPoint) {
                    building.openDoors.push({ x: doorPos.x, y: doorPos.y });
                }
            } else {
                // Default: regular door
                roomDef.doors.push({
                    x: doorPos.x,
                    y: doorPos.y,
                    locked: false
                });
            }

            // Track door for corridor connection
            room.generatedDoors = room.generatedDoors || [];
            room.generatedDoors.push({ side, x: doorPos.x, y: doorPos.y, hasNeighbor });
        }

        building.rooms.push(roomDef);

        // Add interactables
        for (const inter of room.interactables || []) {
            const interId = `inter_${interactableId++}`;
            building.interactables.push({
                type: inter.type,
                id: interId,
                x: room.x + inter.offsetX,
                y: room.y + inter.offsetY,
                label: inter.label,
                duration: inter.duration,
                dc: inter.dc,
                lootValue: inter.lootValue || 0
            });

            if (inter.isScore && !building.score) {
                const scoreValue = archetype.scoreRange[0] +
                    Math.floor(Math.random() * (archetype.scoreRange[1] - archetype.scoreRange[0]));
                building.score = {
                    id: 'main_score',
                    name: 'Primary Target',
                    value: scoreValue,
                    interactableId: interId
                };
            }
        }

        // Add guards
        for (const guard of room.guardSpawns || []) {
            if (guardCount < maxGuards) {
                building.guards.push({
                    id: `guard_${guardCount++}`,
                    x: room.x + guard.offsetX,
                    y: room.y + guard.offsetY,
                    color: '#ff4444',
                    radius: 10,
                    visionCone: { fov: 90, range: 5, facing: 180 }
                });
            }
        }

        // Add cameras
        for (const cam of room.cameras || []) {
            if (cameraCount < maxCameras) {
                building.cameras.push({
                    id: `camera_${cameraCount++}`,
                    x: room.x + cam.offsetX,
                    y: room.y + cam.offsetY,
                    facing: cam.facing || 0,
                    fov: cam.fov || 60,
                    range: cam.range || 4
                });
            }
        }

        // Add crew spawns
        for (const spawn of room.crewSpawns || []) {
            building.crewSpawns.push({
                x: room.x + spawn.offsetX,
                y: room.y + spawn.offsetY,
                default: spawn.default || false
            });
        }

        // Add extraction
        if (room.extraction) {
            building.extraction.points.push({
                id: `extract_${room.id}`,
                name: room.name,
                x: room.x + room.extraction.offsetX,
                y: room.y + room.extraction.offsetY,
                isDefault: room.extraction.isDefault || false
            });
        }

        // Add side scores
        if (room.sideScore) {
            const value = archetype.sideScoreRange ?
                archetype.sideScoreRange[0] + Math.floor(Math.random() * (archetype.sideScoreRange[1] - archetype.sideScoreRange[0])) :
                room.sideScore.value;
            building.sideScores.push({
                id: `side_${room.id}`,
                name: room.sideScore.name,
                value,
                x: room.x + room.sideScore.offsetX,
                y: room.y + room.sideScore.offsetY,
                sector: room.zone,
                duration: room.sideScore.duration || 4
            });
        }
    }

    // Add corridor connections between adjacent rooms
    addGridCorridors(building, placedRooms, width, height);

    // Validation pass: ensure all rooms are reachable
    validateAndFixConnectivity(building, placedRooms, width, height);

    return building;
}

/**
 * Build adjacency map of grid positions
 */
function buildAdjacencyMap(placedRooms) {
    const map = new Map();

    for (const room of placedRooms) {
        const key = `${room.gridX},${room.gridY}`;
        const neighbors = [];

        for (const other of placedRooms) {
            if (other === room) continue;
            const dx = Math.abs(other.gridX - room.gridX);
            const dy = Math.abs(other.gridY - room.gridY);
            if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                neighbors.push(other);
            }
        }

        map.set(key, neighbors);
    }

    return map;
}

/**
 * Check if there's a neighboring room in a given direction
 */
function getNeighborInDirection(room, side, allRooms) {
    const dirMap = {
        north: { dx: 0, dy: -1 },
        south: { dx: 0, dy: 1 },
        east: { dx: 1, dy: 0 },
        west: { dx: -1, dy: 0 }
    };

    const dir = dirMap[side];
    if (!dir) return null;

    const targetX = room.gridX + dir.dx;
    const targetY = room.gridY + dir.dy;

    return allRooms.find(r => r.gridX === targetX && r.gridY === targetY);
}

/**
 * Get absolute position of a connection point
 */
function getConnectionPosition(room, connection) {
    switch (connection.side) {
        case 'north':
            return { x: room.x + connection.offset, y: room.y };
        case 'south':
            return { x: room.x + connection.offset, y: room.y + room.height - 1 };
        case 'east':
            return { x: room.x + room.width - 1, y: room.y + connection.offset };
        case 'west':
            return { x: room.x, y: room.y + connection.offset };
        default:
            return { x: room.x, y: room.y };
    }
}

/**
 * Add corridor floor tiles connecting adjacent rooms
 * Only connects rooms that have doors facing each other
 */
function addGridCorridors(building, placedRooms, mapWidth, mapHeight) {
    const processed = new Set();

    for (const room of placedRooms) {
        for (const other of placedRooms) {
            if (room === other) continue;

            const key = [room.instanceId || room.id, other.instanceId || other.id].sort().join('-');
            if (processed.has(key)) continue;

            // Check if adjacent
            const dx = other.gridX - room.gridX;
            const dy = other.gridY - room.gridY;

            if (Math.abs(dx) + Math.abs(dy) !== 1) continue;

            processed.add(key);

            // Determine which sides face each other
            let roomSide, otherSide;
            if (dx === 1) {
                roomSide = 'east';
                otherSide = 'west';
            } else if (dx === -1) {
                roomSide = 'west';
                otherSide = 'east';
            } else if (dy === 1) {
                roomSide = 'south';
                otherSide = 'north';
            } else {
                roomSide = 'north';
                otherSide = 'south';
            }

            // Check if both rooms have doors on facing sides
            const roomDoor = (room.generatedDoors || []).find(d => d.side === roomSide);
            const otherDoor = (other.generatedDoors || []).find(d => d.side === otherSide);

            // Only create corridor if at least one room has a door on this side
            if (!roomDoor && !otherDoor) continue;

            // Create corridor between rooms
            const corridorDef = {
                zone: 'hallway',
                bounds: { x1: 0, y1: 0, x2: 0, y2: 0 },
                interior: { x1: 0, y1: 0, x2: 0, y2: 0 },
                doors: [],
                connections: []
            };

            // Use door positions for corridor routing (or center if no door)
            const roomY = roomDoor ? roomDoor.y : room.y + Math.floor(room.height / 2);
            const roomX = roomDoor ? roomDoor.x : room.x + Math.floor(room.width / 2);
            const otherY = otherDoor ? otherDoor.y : other.y + Math.floor(other.height / 2);
            const otherX = otherDoor ? otherDoor.x : other.x + Math.floor(other.width / 2);

            if (dx === 1 || dx === -1) {
                // Horizontal corridor (1 tile wide)
                const startX = Math.min(roomX, otherX);
                const endX = Math.max(roomX, otherX);
                const y = Math.floor((roomY + otherY) / 2);

                for (let x = startX; x <= endX; x++) {
                    corridorDef.connections.push({ x, y, type: 'FLOOR' });
                }
            } else {
                // Vertical corridor (1 tile wide)
                const startY = Math.min(roomY, otherY);
                const endY = Math.max(roomY, otherY);
                const x = Math.floor((roomX + otherX) / 2);

                for (let y = startY; y <= endY; y++) {
                    corridorDef.connections.push({ x, y, type: 'FLOOR' });
                }
            }

            if (corridorDef.connections.length > 0) {
                building.rooms.push(corridorDef);
            }
        }
    }
}

/**
 * Validate connectivity and fix any isolated rooms
 */
function validateAndFixConnectivity(building, placedRooms, mapWidth, mapHeight) {
    // Find entrance room (always the root of connectivity)
    const entrance = placedRooms.find(r => r.id === 'entrance' || r.hasEntryPoint);
    if (!entrance) {
        console.warn('[MapGenerator] No entrance found for connectivity check');
        return;
    }

    // Build room adjacency graph based on actual corridors/doors
    const connected = new Set();
    const toVisit = [entrance];

    // Track which rooms have doors leading to which other rooms
    const roomConnections = new Map();
    for (const room of placedRooms) {
        roomConnections.set(room.instanceId || room.id, new Set());
    }

    // Find connected rooms via doors
    for (const room of placedRooms) {
        for (const door of room.generatedDoors || []) {
            if (door.hasNeighbor) {
                // Find the neighbor room
                const neighbor = getNeighborInDirection(room, door.side, placedRooms);
                if (neighbor) {
                    const roomKey = room.instanceId || room.id;
                    const neighborKey = neighbor.instanceId || neighbor.id;
                    roomConnections.get(roomKey)?.add(neighborKey);
                    roomConnections.get(neighborKey)?.add(roomKey);
                }
            }
        }
    }

    // BFS from entrance to find all reachable rooms
    while (toVisit.length > 0) {
        const current = toVisit.pop();
        const currentKey = current.instanceId || current.id;

        if (connected.has(currentKey)) continue;
        connected.add(currentKey);

        // Visit connected neighbors
        const neighbors = roomConnections.get(currentKey) || new Set();
        for (const neighborKey of neighbors) {
            if (!connected.has(neighborKey)) {
                const neighborRoom = placedRooms.find(r => (r.instanceId || r.id) === neighborKey);
                if (neighborRoom) toVisit.push(neighborRoom);
            }
        }
    }

    // Find isolated rooms
    const isolated = placedRooms.filter(r => !connected.has(r.instanceId || r.id));

    if (isolated.length > 0) {
        console.log(`[MapGenerator] Found ${isolated.length} isolated rooms, creating emergency connections`);

        for (const room of isolated) {
            // Find nearest connected room
            let nearestConnected = null;
            let nearestDist = Infinity;

            for (const other of placedRooms) {
                if (!connected.has(other.instanceId || other.id)) continue;
                const dist = Math.abs(room.gridX - other.gridX) + Math.abs(room.gridY - other.gridY);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestConnected = other;
                }
            }

            if (nearestConnected) {
                // Create emergency corridor
                createEmergencyCorridor(building, room, nearestConnected);
                connected.add(room.instanceId || room.id);
            }
        }
    }

    // Handle outer wall doors - convert to exits
    for (const room of placedRooms) {
        for (const door of room.generatedDoors || []) {
            if (door.isEdge) {
                // Check if this door leads outside the building shell
                const shellX1 = 1;
                const shellY1 = 1;
                const shellX2 = mapWidth - 2;
                const shellY2 = mapHeight - 2;

                if (door.x <= shellX1 || door.x >= shellX2 || door.y <= shellY1 || door.y >= shellY2) {
                    // This is an exterior door - add as extraction point if room allows
                    if (room.hasEntryPoint || room.zone === 'lobby' || room.zone === 'hallway') {
                        building.extraction.points.push({
                            id: `exit_${room.instanceId || room.id}_${door.side}`,
                            name: `${room.name} Exit`,
                            x: door.x,
                            y: door.y,
                            isDefault: false
                        });
                        console.log(`[MapGenerator] Created exit from ${room.name} on ${door.side} side`);
                    }
                }
            }
        }
    }
}

/**
 * Create emergency corridor between two rooms that aren't connected
 */
function createEmergencyCorridor(building, roomA, roomB) {
    console.log(`[MapGenerator] Emergency corridor: ${roomA.name} -> ${roomB.name}`);

    const corridorDef = {
        zone: 'hallway',
        bounds: { x1: 0, y1: 0, x2: 0, y2: 0 },
        interior: { x1: 0, y1: 0, x2: 0, y2: 0 },
        doors: [],
        connections: []
    };

    // Simple L-shaped corridor from center of A to center of B
    const ax = roomA.x + Math.floor(roomA.width / 2);
    const ay = roomA.y + Math.floor(roomA.height / 2);
    const bx = roomB.x + Math.floor(roomB.width / 2);
    const by = roomB.y + Math.floor(roomB.height / 2);

    // Horizontal leg
    const startX = Math.min(ax, bx);
    const endX = Math.max(ax, bx);
    for (let x = startX; x <= endX; x++) {
        corridorDef.connections.push({ x, y: ay, type: 'FLOOR' });
        corridorDef.connections.push({ x, y: ay - 1, type: 'FLOOR' });
    }

    // Vertical leg
    const startY = Math.min(ay, by);
    const endY = Math.max(ay, by);
    for (let y = startY; y <= endY; y++) {
        corridorDef.connections.push({ x: bx, y, type: 'FLOOR' });
        corridorDef.connections.push({ x: bx - 1, y, type: 'FLOOR' });
    }

    building.rooms.push(corridorDef);
}

export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);
export default { generateBuilding, ARCHETYPE_IDS };
