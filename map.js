// Map Module - World Map and Collision Detection

// Map constants
const MAP_WIDTH = 16;
const MAP_HEIGHT = 16;
const TILE_SIZE = 64;

// World map definition
// 0 = empty space, 1-8 = wall textures, 90 = door, 37 = key location
const map = [
    [1,1,1,1,1,1,1,1,1,8,8,8,8,8,38,3],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,3],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,15],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,3],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,13],
    [1,0,0,0,0,0,0,0,0,70,0,0,0,0,0,14],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,3],
    [1,0,0,0,0,0,0,0,0,90,0,0,0,0,0,15],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,3],
    [1,0,0,0,0,0,0,0,0,4,6,6,37,5,90,3],
    [1,0,0,0,0,0,0,0,0,4,2,2,2,2,0,2],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,2],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,2],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,2],
    [1,0,0,0,0,0,0,0,0,4,0,0,0,0,0,2],
    [1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2]
];

// Floor palette for different areas
// Floor palette: 0 = grass, 1 = wood, 2 = walkway (yellow-tan)
const floorPalette = [
    [40, 90, 40],      // grass green
    [150, 115, 60],    // wood brown
    [185, 155, 95]     // yellow-tan walkway
];

// Check if a position hits a wall (basic version without door checking)
function isWallBasic(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    
    if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        return true; // Out of bounds = wall
    }
    
    const tile = map[mapY][mapX];
    return tile > 0 && tile !== 90; // Don't treat doors as walls here
}

// Check if a position hits a wall (will be overridden by core.js)
function isWall(x, y) {
    return isWallBasic(x, y);
}

// Check if a position hits a wall for rendering purposes (doors always render)
function isWallForRendering(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    
    if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        return true; // Out of bounds = wall
    }
    
    return map[mapY][mapX] > 0;
}

// Returns true if any wall lies within `radius` pixels of (x,y) - MATCH ORIGINAL EXACTLY
function isWallNear(x, y, radius) {
    return (
        isWall(x + radius, y) ||
        isWall(x - radius, y) ||
        isWall(x, y + radius) ||
        isWall(x, y - radius)
    );
}

// Get tile value at map position
function getMapTile(mapX, mapY) {
    if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        return 1; // Default wall for out of bounds
    }
    return map[mapY][mapX];
}

// Convert world coordinates to map coordinates
function worldToMap(x, y) {
    return {
        mapX: Math.floor(x / TILE_SIZE),
        mapY: Math.floor(y / TILE_SIZE)
    };
}

// Convert map coordinates to world coordinates (center of tile)
function mapToWorld(mapX, mapY) {
    return {
        x: (mapX + 0.5) * TILE_SIZE,
        y: (mapY + 0.5) * TILE_SIZE
    };
}

// Get floor texture index for rendering
function getFloorTexture(mapX, mapY) {
    // Simple implementation - could be expanded
    if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        return 0; // Default grass
    }
    
    const tile = map[mapY][mapX];
    return tile === 0 ? 0 : 1; // Empty = grass, wall = stone
}

// Get list of empty (walkable) spaces for spawn point generation
function getEmptySpaces() {
    const emptySpaces = [];
    
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] === 0) {
                emptySpaces.push({ x: x, y: y });
            }
        }
    }
    
    return emptySpaces;
}

// Line of sight calculation for AI
function hasLineOfSight(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const steps = Math.max(dx, dy) / (TILE_SIZE / 4); // Check every quarter tile
    
    if (steps < 1) return true;
    
    const stepX = (x2 - x1) / steps;
    const stepY = (y2 - y1) / steps;
    
    for (let i = 0; i <= steps; i++) {
        const checkX = x1 + stepX * i;
        const checkY = y1 + stepY * i;
        
        if (isWall(checkX, checkY)) {
            return false;
        }
    }
    
    return true;
}

// Calculate distance between two points
function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Check if coordinates are within map bounds
function isInBounds(mapX, mapY) {
    return mapX >= 0 && mapX < MAP_WIDTH && mapY >= 0 && mapY < MAP_HEIGHT;
}

// Generate spawn points for entities
function findSpawnPoints() {
    const spawnPoints = {
        player: null,
        enemies: [],
        healthPacks: [],
        ammoBoxes: [],
        tables: []
    };
    
    // This would parse the original map for special codes like P, E, H, A, T
    // For now, return default positions
    spawnPoints.player = { x: 2.5 * TILE_SIZE, y: 2.5 * TILE_SIZE };
    
    // Default enemy positions
    spawnPoints.enemies = [
        { x: 3 * TILE_SIZE, y: 12 * TILE_SIZE, type: 'e1' },
        { x: 7 * TILE_SIZE, y: 14 * TILE_SIZE, type: 'e2' }
    ];
    
    // Default power-up positions
    spawnPoints.healthPacks = [
        { x: 11.5 * TILE_SIZE, y: 2.5 * TILE_SIZE },
        { x: 13.5 * TILE_SIZE, y: 4.5 * TILE_SIZE }
    ];
    
    spawnPoints.ammoBoxes = [
        { x: 11.5 * TILE_SIZE, y: 15.5 * TILE_SIZE },
        { x: 12.5 * TILE_SIZE, y: 15.5 * TILE_SIZE }
    ];
    
    spawnPoints.tables = [
        { x: 11.5 * TILE_SIZE, y: 13.5 * TILE_SIZE },
        { x: 13.5 * TILE_SIZE, y: 13.5 * TILE_SIZE }
    ];
    
    return spawnPoints;
}

// Export map functions and data
export {
    MAP_WIDTH,
    MAP_HEIGHT,
    TILE_SIZE,
    map,
    floorPalette,
    isWall,
    isWallBasic,
    isWallForRendering,
    isWallNear,
    getMapTile,
    worldToMap,
    mapToWorld,
    getFloorTexture,
    getEmptySpaces,
    hasLineOfSight,
    getDistance,
    isInBounds,
    findSpawnPoints
};