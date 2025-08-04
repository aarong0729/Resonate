// Core Module - Main Game Loop and Coordination

// Import all game modules
import { loadAllAssets, playSound, playMusic, stopMusic } from './assets.js';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT, map, isWallBasic, isWallNear } from './map.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT, initRenderer, render, updateScreenShake, applyScreenShake } from './render.js';
import { 
    weapons, 
    switchWeapon, 
    shootPlayer, 
    updateWeapon, 
    handleAutoFire, 
    updateProjectiles,
    getCurrentWeapon,
    getGameStats,
    resetGameStats,
    unlockWeapon
} from './weapons.js';
import { 
    getAllEnemies, 
    updateAllEnemies, 
    getEnemyTextureIndex, 
    isEnemyHitFlashing,
    areAllEnemiesDead,
    resetEnemies,
    getEnemyStats,
    addEnemy
} from './ai.js';
import { 
    HUD_HEIGHT, 
    REPLAY_BTN,
    initHUD, 
    renderHUD, 
    renderDebugHUD,
    renderGameStateOverlay,
    renderLoadingScreen,
    renderTitleScreen,
    updateFaceAnimation,
    renderDamageFlash,
    renderLowHealthWarning
} from './hud.js';
import { 
    updateParticles, 
    getParticleSprites, 
    clearAllParticles,
    getParticleCount,
    testCreateParticles
} from './particles.js';

// Game state
let gameState = 'loading'; // 'loading', 'title', 'playing', 'paused', 'victory', 'gameOver', 'death'
let showDebugHUD = false;
let victoryDelayTimer = 0; // Delay before showing victory screen

// Enemy spawning system
let enemySpawnState = {
    playerPreviousRoom: 1,  // Track which room player was in (1 = room1, 2 = room2)
    totalEnemiesSpawned: 5, // Start with initial 5 enemies
    maxEnemies: 10,         // Stop spawning at 10 total (more reasonable for victory)
    hasTriggered: false     // Prevent multiple triggers in doorway
};

// Player object
const player = {
    x: 1.5 * TILE_SIZE,
    y: 1.5 * TILE_SIZE,
    dirX: 1, dirY: 0,
    planeX: 0, planeY: 0.66,
    health: 100, maxHealth: 100,
    ammo: 10, maxAmmo: 200,  // Start with only 10 ammo
    lives: 3,
    walkTimer: 0,
    lastHitTime: 0,  // Track when player was last hit for damage effects
    inventory: {
        keys: [],
        hasKey: function(keyId) { return this.keys.includes(keyId); }
    }
};

// Input state
const keys = {};
let lastTime = 0;
let fps = 0;
let frameCount = 0;
let fpsTimer = 0;

// Canvas and context
let canvas = null;
let ctx = null;

// Game effects
const gameEffects = {
    damageFlash: { intensity: 0, timer: 0 },
    lowHealth: { intensity: 0 }
};

// Powerup system - matching map layout exactly
const powerUps = [
    // Ammo boxes (A) - from map row 1 (y=1): columns 11,13 (x=11,13)
    { x:11.5*TILE_SIZE, y: 1.5*TILE_SIZE, type:'ammo',   textureIndex:69, active:true, bobTimer:0,          bobSpeed:2200, bobHeight:6, respawnTime:25000, pickedUpTime:0 },
    { x:13.5*TILE_SIZE, y: 1.5*TILE_SIZE, type:'ammo',   textureIndex:69, active:true, bobTimer:Math.PI,    bobSpeed:2100, bobHeight:5, respawnTime:25000, pickedUpTime:0 },
    // Tables (T) - from map row 3 (y=3): columns 11,13 (x=11,13)
    { x:11.5*TILE_SIZE, y: 3.5*TILE_SIZE, type:'table',  textureIndex:72, active:true, bobTimer:0, bobSpeed:0, bobHeight:0, respawnTime:0, pickedUpTime:0 },
    { x:13.5*TILE_SIZE, y: 3.5*TILE_SIZE, type:'table',  textureIndex:72, active:true, bobTimer:0, bobSpeed:0, bobHeight:0, respawnTime:0, pickedUpTime:0 },
    // Kegs (K) - decorative barrels
    { x:10.5*TILE_SIZE, y:11.5*TILE_SIZE, type:'keg',    textureIndex:71, active:true, bobTimer:0, bobSpeed:0, bobHeight:0, respawnTime:0, pickedUpTime:0 },
    { x:10.5*TILE_SIZE, y:14.5*TILE_SIZE, type:'keg',    textureIndex:71, active:true, bobTimer:0, bobSpeed:0, bobHeight:0, respawnTime:0, pickedUpTime:0 },
    { x:11.5*TILE_SIZE, y:14.5*TILE_SIZE, type:'keg',    textureIndex:71, active:true, bobTimer:0, bobSpeed:0, bobHeight:0, respawnTime:0, pickedUpTime:0 },
    // Shotgun pickup (S) - replaces one keg at (14, 14) - one-time pickup
    { x:14.5*TILE_SIZE, y:14.5*TILE_SIZE, type:'shotgun', textureIndex:73, active:true, bobTimer:0, bobSpeed:2000, bobHeight:8, respawnTime:-1, pickedUpTime:0 },
    // Health packs (H) - from map rows 8,11,12,13 (y=8,11,12,13): various columns
    { x:11.5*TILE_SIZE, y: 8.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:0,          bobSpeed:2000, bobHeight:8, respawnTime:30000, pickedUpTime:0 },
    { x:13.5*TILE_SIZE, y: 8.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI,    bobSpeed:2200, bobHeight:6, respawnTime:30000, pickedUpTime:0 },
    { x:11.5*TILE_SIZE, y:11.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI/2,  bobSpeed:2100, bobHeight:7, respawnTime:30000, pickedUpTime:0 },
    { x:13.5*TILE_SIZE, y:11.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI*0.8,bobSpeed:1900, bobHeight:6, respawnTime:30000, pickedUpTime:0 },
    { x:12.5*TILE_SIZE, y:12.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI*1.2,bobSpeed:2000, bobHeight:8, respawnTime:30000, pickedUpTime:0 },
    { x:11.5*TILE_SIZE, y:13.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI*1.6,bobSpeed:2100, bobHeight:7, respawnTime:30000, pickedUpTime:0 },
    { x:13.5*TILE_SIZE, y:13.5*TILE_SIZE, type:'health', textureIndex:68, active:true, bobTimer:Math.PI*0.3,bobSpeed:1900, bobHeight:6, respawnTime:30000, pickedUpTime:0 }
];

// Door system
const doors = [
    { 
        id: 'door1', 
        x: 9 * TILE_SIZE, 
        y: 7 * TILE_SIZE, 
        mapX: 9, 
        mapY: 7, 
        isOpen: false, 
        requiresKey: false,
        keyId: null,
        isAnimating: false,
        animationTimer: 0,
        autoCloseTimer: 0,
        autoCloseDelay: 3000  // 3 seconds
    },
    { 
        id: 'door2', 
        x: 14 * TILE_SIZE, 
        y: 9 * TILE_SIZE, 
        mapX: 14, 
        mapY: 9, 
        isOpen: false, 
        requiresKey: true,
        keyId: 'key1',
        isAnimating: false,
        animationTimer: 0,
        autoCloseTimer: 0,
        autoCloseDelay: 3000  // 3 seconds
    }
];

// Interactive tiles (key pickup locations and easter eggs)
const interactiveTiles = [
    {
        id: 'key1',
        x: 12.5 * TILE_SIZE,
        y: 9.5 * TILE_SIZE,
        mapX: 12,
        mapY: 9,
        type: 'key',
        active: true,
        keyId: 'key1'
    },
    {
        id: 'easter_egg_teanaway',
        x: 14.5 * TILE_SIZE,
        y: 0.5 * TILE_SIZE,
        mapX: 14,
        mapY: 0,
        type: 'easter_egg',
        active: true,
        message: 'WTF Teanaway?'
    }
];

// UI messages system
let uiMessage = {
    text: '',
    timer: 0,
    maxTime: 2000  // 2 seconds
};

// Initialize the game
async function initGame(canvasElement) {
    try {
        // Set up canvas
        canvas = canvasElement;
        ctx = initRenderer(canvas);
        initHUD(ctx, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        // Show loading screen
        renderLoadingScreen('Loading assets...', 0);
        
        // Load all game assets
        await loadAllAssets();
        
        // Initialize game state
        resetGame();
        
        // Set up input handlers
        setupInputHandlers();
        
        // Start with title screen
        gameState = 'title';
        
        // Start background music
        setTimeout(() => {
            playMusic('background', true); // Fade in background music after a brief delay
        }, 1000);
        
        requestAnimationFrame(gameLoop);
        
        console.log('Game initialized successfully!');
        return true;
        
    } catch (error) {
        console.error('Failed to initialize game:', error);
        renderLoadingScreen('Error loading game: ' + error.message, 0);
        return false;
    }
}

// Detect which room the player is in
function getPlayerRoom(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    
    // Room 2 is roughly columns 10-15, rows 1-14
    if (mapX >= 10 && mapX <= 15 && mapY >= 1 && mapY <= 14) {
        return 2;
    }
    // Everything else is Room 1 (including spawn area)
    return 1;
}

// Check for safe spawn positions (not occupied by existing enemies)
function findSafeSpawnPosition(preferredPositions) {
    const enemies = getAllEnemies();
    const safeDistance = TILE_SIZE * 1.5; // Minimum distance from existing enemies
    
    for (const pos of preferredPositions) {
        let isSafe = true;
        
        // Check if position is too close to any existing enemy
        for (const enemy of enemies) {
            if (enemy.state === 'alive') {
                const dx = pos.x - enemy.x;
                const dy = pos.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < safeDistance) {
                    isSafe = false;
                    break;
                }
            }
        }
        
        if (isSafe) {
            return pos;
        }
    }
    
    // If no safe position found, return first position anyway
    return preferredPositions[0];
}

// Spawn 5 additional enemies in Room 1
function spawnAdditionalEnemies() {
    // Spawn only 3 enemies per trigger (more manageable)
    const spawnPositions = [
        { x: 4.5 * TILE_SIZE, y: 4.5 * TILE_SIZE, type: 'e2' },
        { x: 5.5 * TILE_SIZE, y: 7.5 * TILE_SIZE, type: 'e2' },
        { x: 1.5 * TILE_SIZE, y: 6.5 * TILE_SIZE, type: 'e1' }
    ];
    
    let spawnedCount = 0;
    const maxSpawnThisTrigger = 3; // Limit spawns per trigger
    
    for (const spawn of spawnPositions) {
        // Check if we've hit the enemy limit OR the per-trigger limit
        if (enemySpawnState.totalEnemiesSpawned >= enemySpawnState.maxEnemies || 
            spawnedCount >= maxSpawnThisTrigger) {
            console.log(`Enemy spawn stopping: Total: ${enemySpawnState.totalEnemiesSpawned}/${enemySpawnState.maxEnemies}, This trigger: ${spawnedCount}/${maxSpawnThisTrigger}`);
            break;
        }
        
        // Find a safe position near the preferred location
        const alternatives = [
            spawn,
            { x: spawn.x + TILE_SIZE, y: spawn.y, type: spawn.type },
            { x: spawn.x - TILE_SIZE, y: spawn.y, type: spawn.type },
            { x: spawn.x, y: spawn.y + TILE_SIZE, type: spawn.type },
            { x: spawn.x, y: spawn.y - TILE_SIZE, type: spawn.type }
        ];
        
        const safePos = findSafeSpawnPosition(alternatives);
        
        // Spawn the enemy
        addEnemy(safePos.x, safePos.y, safePos.type);
        enemySpawnState.totalEnemiesSpawned++;
        spawnedCount++;
        
        console.log(`Spawned ${safePos.type} at (${Math.floor(safePos.x/TILE_SIZE)}, ${Math.floor(safePos.y/TILE_SIZE)})`);
    }
    
    console.log(`🚨 ${spawnedCount} additional enemies spawned! Total: ${enemySpawnState.totalEnemiesSpawned}/${enemySpawnState.maxEnemies}`);
    
    // Allow triggering again after some time if we haven't hit the max
    if (enemySpawnState.totalEnemiesSpawned < enemySpawnState.maxEnemies) {
        setTimeout(() => {
            console.log('📍 Enemy spawn trigger reset - can spawn more enemies');
            enemySpawnState.hasTriggered = false;
        }, 10000); // Reset after 10 seconds
    }
}

// Check for room transition and spawn enemies
function checkEnemySpawnTrigger() {
    const currentRoom = getPlayerRoom(player.x, player.y);
    
    // Clear trigger flag when player is clearly in one room or the other
    if (currentRoom !== enemySpawnState.playerPreviousRoom) {
        enemySpawnState.hasTriggered = false;
    }
    
    // Trigger spawn when player moves from Room 1 to Room 2 (FIXED VERSION)
    if (enemySpawnState.playerPreviousRoom === 1 && 
        currentRoom === 2 && 
        !enemySpawnState.hasTriggered &&
        enemySpawnState.totalEnemiesSpawned < enemySpawnState.maxEnemies) {
        
        console.log(`🚨 Enemy spawn trigger activated! Previous: ${enemySpawnState.playerPreviousRoom}, Current: ${currentRoom}, Total spawned: ${enemySpawnState.totalEnemiesSpawned}/${enemySpawnState.maxEnemies}`);
        enemySpawnState.hasTriggered = true;
        spawnAdditionalEnemies();
    }
    
    // Update previous room (only when not in doorway)
    const doorwayThreshold = 0.5 * TILE_SIZE; // Buffer zone around doorway
    const doorX = 9 * TILE_SIZE; // Door is at column 9
    
    // Only update room if player is clearly away from the doorway
    if (Math.abs(player.x - doorX) > doorwayThreshold) {
        enemySpawnState.playerPreviousRoom = currentRoom;
    }
}

// Respawn player after death
function respawnPlayer() {
    if (gameState !== 'death') return;
    
    // Reset player state
    player.health = player.maxHealth;
    player.x = 1.5 * TILE_SIZE;
    player.y = 1.5 * TILE_SIZE;
    player.dirX = 1;
    player.dirY = 0;
    player.planeX = 0;
    player.planeY = 0.66;
    
    // Trigger damage flash for visual feedback
    triggerPlayerDamageEffects();
    
    // Return to playing state
    gameState = 'playing';
    
    // Make sure background music is playing
    playMusic('background', false); // Resume without fade-in since it should already be playing
    
    console.log(`Player respawned! Lives remaining: ${player.lives}`);
}

// Reset game to initial state
function resetGame() {
    // Reset player
    player.x = 1.5 * TILE_SIZE;
    player.y = 1.5 * TILE_SIZE;
    player.dirX = 1;
    player.dirY = 0;
    player.planeX = 0;
    player.planeY = 0.66;
    player.health = player.maxHealth;
    player.ammo = 10;  // Start with only 10 ammo
    player.lives = 3;
    player.walkTimer = 0;
    player.inventory.keys = [];
    
    // Reset game systems
    resetEnemies();
    resetGameStats();
    clearAllParticles();
    
    // Reset weapons
    weapons.forEach((weapon, index) => {
        weapon.isVisible = false;
        weapon.state = 'hidden';
        weapon.currentFrame = 0;
        weapon.frameTimer = 0;
        // Reset weapon availability - only pistol (index 0) available at start
        weapon.available = (index === 0);
    });
    
    // Reset effects
    gameEffects.damageFlash.intensity = 0;
    gameEffects.damageFlash.timer = 0;
    gameEffects.lowHealth.intensity = 0;
    
    // Reset enemy spawn state
    enemySpawnState.playerPreviousRoom = 1;
    enemySpawnState.totalEnemiesSpawned = 5; // Starting enemies
    enemySpawnState.hasTriggered = false;
    
    // Reset victory timer
    victoryDelayTimer = 0;
    
    gameState = 'playing';
    
    // Restart background music
    playMusic('background', true); // Fade in music on game reset
    
    console.log('Game reset to initial state');
}

// Start game from title screen
function startGame() {
    console.log('Starting game from title screen...');
    resetGame(); // This will set gameState to 'playing'
}

// Set up input event handlers
function setupInputHandlers() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        handleKeyDown(e.key);
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Mouse events
    canvas.addEventListener('click', (evt) => {
        if (gameState === 'title') {
            // Click anywhere to start game
            startGame();
        } else if (gameState === 'playing') {
            shootPlayer(player);
        } else if (gameState === 'death') {
            // Click anywhere to respawn
            respawnPlayer();
        } else if (gameState === 'victory') {
            // Handle replay button click (matching original)
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width  / rect.width;   // 640 / 1280 = 0.5
            const scaleY = canvas.height / rect.height;  // 480 / 960  = 0.5
            const mx = (evt.clientX - rect.left) * scaleX;
            const my = (evt.clientY - rect.top)  * scaleY;

            const btnX = SCREEN_WIDTH / 2 - REPLAY_BTN.w / 2;
            const btnY = SCREEN_HEIGHT / 2 + 20;

            if (mx >= btnX && mx <= btnX + REPLAY_BTN.w &&
                my >= btnY && my <= btnY + REPLAY_BTN.h) {
                location.reload();   // restart the game
            }
        }
    });
    
    // Prevent context menu
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Handle individual key presses
function handleKeyDown(key) {
    switch (key) {
        case '1':
            if (gameState === 'playing') switchWeapon(0);
            break;
        case '2':
            if (gameState === 'playing') switchWeapon(1);
            break;
        case ' ':
        case 'Enter':
            if (gameState === 'title') {
                startGame();
            } else if (gameState === 'death') {
                respawnPlayer();
            } else if (gameState === 'playing') {
                shootPlayer(player);
            }
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
        case 'F1':
            showDebugHUD = !showDebugHUD;
            break;
        case 'F5':
            if (gameState === 'gameOver' || gameState === 'victory') {
                resetGame();
            }
            break;
        case 'Escape':
            if (gameState === 'playing') {
                togglePause();
            } else if (gameState === 'paused') {
                gameState = 'playing';
            }
            break;
        case 'e':
        case 'E':
            if (gameState === 'playing') {
                handleInteraction();
            }
            break;
        case 'b':
        case 'B':
            // Test key for blood particles
            if (gameState === 'playing') {
                testCreateParticles(player);
                console.log(`Particle test - Total particles: ${getParticleCount()}`);
            }
            break;
    }
}

// Toggle pause state
function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        console.log('Game paused');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        console.log('Game resumed');
    }
}

// Handle player interaction (E key)
function handleInteraction() {
    const interactionDistance = TILE_SIZE * 1.5; // 1.5 tiles
    
    // Check interactive tile interactions (key pickup) FIRST
    for (const tile of interactiveTiles) {
        if (!tile.active) continue;
        
        const distance = Math.sqrt((tile.x - player.x) ** 2 + (tile.y - player.y) ** 2);
        
        if (distance <= interactionDistance) {
            if (tile.type === 'key') {
                tile.active = false;
                player.inventory.keys.push(tile.keyId);
                playSound('pickup_key');
                showMessage("Thanks Chris!");
                console.log(`Player acquired ${tile.keyId}`);
                return;
            } else if (tile.type === 'easter_egg') {
                showMessage(tile.message);
                console.log(`Easter egg triggered: ${tile.message}`);
                return;
            }
        }
    }
    
    // Check door interactions SECOND
    for (const door of doors) {
        const distance = Math.sqrt((door.x - player.x) ** 2 + (door.y - player.y) ** 2);
        
        if (distance <= interactionDistance) {
            if (door.requiresKey && !player.inventory.hasKey(door.keyId)) {
                showMessage("Door is locked!");
                return;
            }
            
            // Check if trying to close door while standing on it
            const playerMapX = Math.floor(player.x / TILE_SIZE);
            const playerMapY = Math.floor(player.y / TILE_SIZE);
            
            if (door.isOpen && playerMapX === door.mapX && playerMapY === door.mapY) {
                showMessage("Can't close door while standing on it!");
                return;
            }
            
            // Toggle door state
            door.isOpen = !door.isOpen;
            playSound('door_open');
            
            if (door.isOpen) {
                door.autoCloseTimer = door.autoCloseDelay; // Start auto-close timer
            } else {
                door.autoCloseTimer = 0; // Cancel auto-close timer
            }
            
            console.log(`${door.id} ${door.isOpen ? 'opened' : 'closed'}`);
            return;
        }
    }
}

// Show UI message
function showMessage(text) {
    uiMessage.text = text;
    uiMessage.timer = uiMessage.maxTime;
}

// Update UI message timer
function updateUIMessage(deltaTime) {
    if (uiMessage.timer > 0) {
        uiMessage.timer -= deltaTime;
        if (uiMessage.timer <= 0) {
            uiMessage.text = '';
        }
    }
}

// Update door auto-close timers
function updateDoors(deltaTime) {
    for (const door of doors) {
        if (door.isOpen && door.autoCloseTimer > 0) {
            door.autoCloseTimer -= deltaTime;
            
            if (door.autoCloseTimer <= 0) {
                // Check if player is standing on the door tile
                const playerMapX = Math.floor(player.x / TILE_SIZE);
                const playerMapY = Math.floor(player.y / TILE_SIZE);
                
                if (playerMapX === door.mapX && playerMapY === door.mapY) {
                    // Player is on door tile, delay closing by 1 second
                    door.autoCloseTimer = 1000;
                    console.log(`${door.id} close delayed - player on door tile`);
                } else {
                    // Safe to close door
                    door.isOpen = false;
                    door.autoCloseTimer = 0;
                    playSound('door_open'); // Same sound for closing
                    console.log(`${door.id} auto-closed`);
                }
            }
        }
    }
}

// Check if door should block movement
function isDoorBlocking(x, y) {
    for (const door of doors) {
        if (!door.isOpen) {
            const doorMapX = Math.floor(door.x / TILE_SIZE);
            const doorMapY = Math.floor(door.y / TILE_SIZE);
            const checkMapX = Math.floor(x / TILE_SIZE);
            const checkMapY = Math.floor(y / TILE_SIZE);
            
            if (doorMapX === checkMapX && doorMapY === checkMapY) {
                return true;
            }
        }
    }
    return false;
}

// Check if door is near position with radius buffer (similar to isWallNear)
function isDoorNear(x, y, radius) {
    // Check in four directions around the position with radius buffer
    return (
        isDoorBlocking(x + radius, y) ||
        isDoorBlocking(x - radius, y) ||
        isDoorBlocking(x, y + radius) ||
        isDoorBlocking(x, y - radius)
    );
}

// Check if position collides with any table or keg
function isTableBlocking(x, y) {
    const checkRadius = 25; // Table/keg collision radius for projectiles/enemies
    
    for (const powerUp of powerUps) {
        if ((powerUp.type === 'table' || powerUp.type === 'keg') && powerUp.active) {
            const dx = x - powerUp.x;
            const dy = y - powerUp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < checkRadius) {
                return true;
            }
        }
    }
    return false;
}

// Check if position collides with any table or keg (with player buffer)
function isTableBlockingPlayer(x, y) {
    const checkRadius = 35; // Larger buffer for player comfort
    
    for (const powerUp of powerUps) {
        if ((powerUp.type === 'table' || powerUp.type === 'keg') && powerUp.active) {
            const dx = x - powerUp.x;
            const dy = y - powerUp.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < checkRadius) {
                return true;
            }
        }
    }
    return false;
}

// Combined wall, door, and table collision check
function isBlocked(x, y) {
    return isWallBasic(x, y) || isDoorBlocking(x, y) || isTableBlocking(x, y);
}

// Player collision check with wall and table buffer
function isPlayerBlocked(x, y) {
    const wallBuffer = 20; // 20-pixel buffer from walls
    const doorBuffer = 20; // Same buffer for doors
    return isWallNear(x, y, wallBuffer) || isDoorNear(x, y, doorBuffer) || isTableBlockingPlayer(x, y);
}

// Update player movement and rotation
function updatePlayer(deltaTime) {
    if (gameState !== 'playing') return;
    
    const moveSpeed = 0.1 * deltaTime;
    const rotSpeed = 0.002 * deltaTime;
    
    // Rotation (fixed: left arrow = turn left, right arrow = turn right)
    if (keys['ArrowLeft']) {
        const oldDirX = player.dirX;
        player.dirX = player.dirX * Math.cos(-rotSpeed) - player.dirY * Math.sin(-rotSpeed);
        player.dirY = oldDirX * Math.sin(-rotSpeed) + player.dirY * Math.cos(-rotSpeed);
        const oldPlaneX = player.planeX;
        player.planeX = player.planeX * Math.cos(-rotSpeed) - player.planeY * Math.sin(-rotSpeed);
        player.planeY = oldPlaneX * Math.sin(-rotSpeed) + player.planeY * Math.cos(-rotSpeed);
    }
    if (keys['ArrowRight']) {
        const oldDirX = player.dirX;
        player.dirX = player.dirX * Math.cos(rotSpeed) - player.dirY * Math.sin(rotSpeed);
        player.dirY = oldDirX * Math.sin(rotSpeed) + player.dirY * Math.cos(rotSpeed);
        const oldPlaneX = player.planeX;
        player.planeX = player.planeX * Math.cos(rotSpeed) - player.planeY * Math.sin(rotSpeed);
        player.planeY = oldPlaneX * Math.sin(rotSpeed) + player.planeY * Math.cos(rotSpeed);
    }
    
    // Movement (with wall buffer for smoother collision)
    let moving = false;
    if (keys['w'] || keys['W']) {
        const newX = player.x + player.dirX * moveSpeed;
        const newY = player.y + player.dirY * moveSpeed;
        if (!isPlayerBlocked(newX, player.y)) player.x = newX;
        if (!isPlayerBlocked(player.x, newY)) player.y = newY;
        moving = true;
    }
    if (keys['s'] || keys['S']) {
        const newX = player.x - player.dirX * moveSpeed;
        const newY = player.y - player.dirY * moveSpeed;
        if (!isPlayerBlocked(newX, player.y)) player.x = newX;
        if (!isPlayerBlocked(player.x, newY)) player.y = newY;
        moving = true;
    }
    if (keys['a'] || keys['A']) {
        const newX = player.x - player.planeX * moveSpeed;
        const newY = player.y - player.planeY * moveSpeed;
        if (!isPlayerBlocked(newX, player.y)) player.x = newX;
        if (!isPlayerBlocked(player.x, newY)) player.y = newY;
        moving = true;
    }
    if (keys['d'] || keys['D']) {
        const newX = player.x + player.planeX * moveSpeed;
        const newY = player.y + player.planeY * moveSpeed;
        if (!isPlayerBlocked(newX, player.y)) player.x = newX;
        if (!isPlayerBlocked(player.x, newY)) player.y = newY;
        moving = true;
    }
    
    if (moving) {
        player.walkTimer += deltaTime;
    }
}

// Update game effects (damage flash, screen shake, etc)
function updateGameEffects(deltaTime) {
    const currentTime = Date.now();
    
    // Update damage flash effect (matching original timing)
    if (gameEffects.damageFlash.timer > 0) {
        gameEffects.damageFlash.timer -= deltaTime;
        // Fade out intensity over time (350ms duration like original)
        const progress = gameEffects.damageFlash.timer / 350;
        gameEffects.damageFlash.intensity = Math.max(0, 0.6 * progress);
        
        if (gameEffects.damageFlash.timer <= 0) {
            gameEffects.damageFlash.intensity = 0;
        }
    }
    
    // Update low health warning with pulsing effect
    const healthPercent = (player.health / player.maxHealth) * 100;
    if (healthPercent <= 25) {
        // Pulsing effect for low health
        const pulse = Math.sin(currentTime * 0.01) * 0.5 + 0.5;
        gameEffects.lowHealth.intensity = (1 - healthPercent / 25) * pulse;
    } else {
        gameEffects.lowHealth.intensity = 0;
    }
}

// Trigger damage effects when player is hit (matching original)
function triggerPlayerDamageEffects() {
    const currentTime = Date.now();
    
    // Set lastHitTime for other systems that might need it
    player.lastHitTime = currentTime;
    
    // Trigger screen shake (8px intensity, 350ms duration like original)
    applyScreenShake(8, 350);
    
    // Trigger damage flash (350ms duration like original) 
    gameEffects.damageFlash.timer = 350;
    gameEffects.damageFlash.intensity = 0.6; // Start at full intensity
}

// Update powerups (animation, respawning, collision)
function updatePowerUps(deltaTime) {
    const currentTime = Date.now();
    
    powerUps.forEach((powerUp, index) => {
        if (powerUp.type === 'table' || powerUp.type === 'keg') return; // décor, no pickup or bob
        
        // Update bobbing animation
        powerUp.bobTimer += deltaTime;
        
        // Handle respawning
        if (!powerUp.active) {
            // Don't respawn if respawnTime is -1 (one-time pickup)
            if (powerUp.respawnTime > 0 && currentTime - powerUp.pickedUpTime >= powerUp.respawnTime) {
                powerUp.active = true;
                console.log(`Power-up ${index} respawned!`);
            }
            return; // Skip inactive power-ups
        }
        
        // Check collision with player
        const dx = powerUp.x - player.x;
        const dy = powerUp.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 30) { // Player touched power-up
            powerUp.active = false;
            powerUp.pickedUpTime = currentTime;
            
            if (powerUp.type === 'health') {
                const healthGain = 10; // Exactly 10 health
                const oldHealth = player.health;
                player.health = Math.min(player.maxHealth, player.health + healthGain);
                const actualGain = player.health - oldHealth;
                console.log(`🏥 Health pack picked up! +${actualGain} health (${player.health}/${player.maxHealth})`);
                playSound('pickup_health');
                
            } else if (powerUp.type === 'ammo') {
                const ammoGain = 10; // Exactly 10 ammo
                const oldAmmo = player.ammo;
                player.ammo = Math.min(player.maxAmmo, player.ammo + ammoGain);
                const actualGain = player.ammo - oldAmmo;
                console.log(`🔫 Ammo box picked up! +${actualGain} ammo (${player.ammo}/${player.maxAmmo})`);
                playSound('pickup_ammo');
                
            } else if (powerUp.type === 'shotgun') {
                // Give player shotgun and 10 ammo
                const oldAmmo = player.ammo;
                player.ammo = Math.min(player.maxAmmo, player.ammo + 10);
                const actualGain = player.ammo - oldAmmo;
                console.log(`🔫 Shotgun picked up! +${actualGain} ammo (${player.ammo}/${player.maxAmmo}). Shotgun unlocked!`);
                playSound('pickup_ammo');
                // Unlock and switch to shotgun (weapon index 1)
                unlockWeapon(1);
                switchWeapon(1);
            }
        }
    });
}

// Update FPS counter
function updateFPS(deltaTime) {
    frameCount++;
    fpsTimer += deltaTime;
    
    if (fpsTimer >= 1000) { // Update every second
        fps = frameCount;
        frameCount = 0;
        fpsTimer = 0;
    }
}

// Check game conditions (victory, game over)
function checkGameConditions() {
    if (gameState !== 'playing') return;
    
    // Check victory condition with delay
    if (areAllEnemiesDead()) {
        if (victoryDelayTimer === 0) {
            // Start victory delay timer
            victoryDelayTimer = Date.now();
            console.log('🏆 All enemies defeated! Victory screen in 2 seconds...');
        } else if (Date.now() - victoryDelayTimer >= 2000) {
            // 2 second delay has passed
            gameState = 'victory';
            console.log('🎉 Victory! All enemies defeated!');
            
            // Play victory sound and fade out background music
            playSound('victory');
            stopMusic(true); // Fade out background music on victory
            return;
        } else {
            // Log countdown during delay
            const timeRemaining = 2000 - (Date.now() - victoryDelayTimer);
            console.log(`⏱️ Victory countdown: ${Math.ceil(timeRemaining/1000)}s remaining`);
        }
    } else {
        // Reset timer if enemies are still alive (with debug info)
        if (victoryDelayTimer !== 0) {
            console.log('❌ Victory timer reset - enemies still alive');
            victoryDelayTimer = 0;
        }
    }
    
    // Check death condition
    if (player.health <= 0) {
        player.lives--;
        
        if (player.lives > 0) {
            // Show death screen
            gameState = 'death';
            console.log(`Player died! Lives remaining: ${player.lives}`);
            playSound('player_die');
            // Keep music playing during death screen
        } else {
            // Final game over
            gameState = 'gameOver';
            console.log('Game Over! No lives remaining!');
            playSound('player_die');
            stopMusic(true); // Fade out music on final game over
        }
    }
}

// Create sprites from enemies and powerups for rendering
function createRenderableSprites() {
    const enemies = getAllEnemies();
    
    const enemySprites = enemies.map(enemy => {
        const textureIndex = getEnemyTextureIndex(enemy);
        
        return {
            x: enemy.x,
            y: enemy.y,
            textureIndex: textureIndex,
            active: enemy.state !== 'dead',
            isHitFlashing: isEnemyHitFlashing(enemy),
            distance: Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2),
            bobOffset: 0, // No bobbing for enemies
            // Include enemy properties for state-based texture selection
            state: enemy.state,
            isWalking: enemy.isWalking,
            currentFrame: enemy.currentFrame,
            walkTextureIndex: enemy.walkTextureIndex,
            shootTextureIndex: enemy.shootTextureIndex,
            deathTextureIndex: enemy.deathTextureIndex
        };
    });
    
    // Create powerup sprites with bobbing animation
    const activePowerups = powerUps.filter(powerUp => powerUp.active);
    
    const powerupSprites = activePowerups.map(powerUp => {
        // Calculate bobbing offset
        const bobOffset = powerUp.bobSpeed > 0
            ? Math.sin(powerUp.bobTimer / powerUp.bobSpeed * Math.PI * 2) * powerUp.bobHeight
            : 0;
        
        return {
            x: powerUp.x,
            y: powerUp.y,
            textureIndex: powerUp.textureIndex,
            active: true,
            isHitFlashing: false,
            distance: Math.sqrt((powerUp.x - player.x) ** 2 + (powerUp.y - player.y) ** 2),
            bobOffset: bobOffset,
            type: powerUp.type
        };
    });
    // Add particle sprites (safe test)
    const particleSprites = getParticleSprites(player);
    
    return [...enemySprites, ...powerupSprites, ...particleSprites];
}

// Main game loop
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    // Update FPS
    updateFPS(deltaTime);
    
    // Update game systems based on state
    if (gameState === 'playing') {
        // Update player
        updatePlayer(deltaTime);
        
        // Update weapons
        updateWeapon(deltaTime);
        handleAutoFire(player, keys);
        
        // Update AI and enemies (only when playing)
        if (gameState === 'playing') {
            updateAllEnemies(player, deltaTime, getGameStats());
        }
        
        // Update projectiles (only when playing) 
        if (gameState === 'playing') {
            updateProjectiles(deltaTime, player, getAllEnemies(), triggerPlayerDamageEffects);
        }
        
        // Update powerups
        updatePowerUps(deltaTime);
        
        // Update particles (safe test)
        updateParticles(deltaTime);
        
        // Update animations
        updateFaceAnimation(deltaTime);
        updateScreenShake(deltaTime);
        updateGameEffects(deltaTime);
        updateUIMessage(deltaTime);
        updateDoors(deltaTime);
        
        // Check for enemy spawning triggers
        checkEnemySpawnTrigger();
        
        // Check game conditions
        checkGameConditions();
    }
    
    // Render game
    renderGame();
    
    // Continue game loop
    requestAnimationFrame(gameLoop);
}

// Render the complete game
function renderGame() {
    // Get all sprites (enemies and power-ups) for rendering
    const allSprites = createRenderableSprites();
    const weapon = getCurrentWeapon();
    
    // Main game rendering
    render(player, allSprites, weapon, gameState, gameEffects);
    
    // Render screen effects
    if (gameEffects.damageFlash.intensity > 0) {
        renderDamageFlash(gameEffects.damageFlash.intensity);
    }
    
    if (gameEffects.lowHealth.intensity > 0) {
        renderLowHealthWarning(player);
    }
    
    // Render HUD
    renderHUD(player, getGameStats(), weapon);
    
    // Render debug HUD if enabled
    if (showDebugHUD) {
        const enemies = getAllEnemies();
        const projectiles = {
            player: [], // Would need to import this from weapons module
            enemy: []
        };
        renderDebugHUD(player, enemies, projectiles, fps);
    }
    
    // Render game state overlays
    renderGameStateOverlay(gameState, getGameStats(), player);
    
    // Update cursor style based on game state (matching original)
    if (gameState === 'victory') {
        canvas.style.cursor = 'pointer';   // show a hand cursor on victory overlay
    } else {
        canvas.style.cursor = 'default';
    }
}

// Get current game state for external access
function getGameState() {
    return {
        state: gameState,
        player: { ...player },
        gameStats: getGameStats(),
        enemyStats: getEnemyStats(),
        fps: fps
    };
}

// Public API for external control
function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
    }
}

function resumeGame() {
    if (gameState === 'paused') {
        gameState = 'playing';
    }
}

function restartGame() {
    resetGame();
}

// Export core game functions
export {
    initGame,
    resetGame,
    pauseGame,
    resumeGame,
    restartGame,
    getGameState,
    triggerPlayerDamageEffects,
    player,
    gameState,
    showDebugHUD,
    doors,
    isDoorBlocking,
    isDoorNear,
    isBlocked,
    isTableBlocking,
    uiMessage
};