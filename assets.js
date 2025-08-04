// Assets Module - Texture and Sound Loading System - Updated 2025-07-30

// Import dependencies
import { TILE_SIZE } from './map.js';

// Constants
const TEXTURE_SIZE = 64;

// Global storage
const textures = [];
const sounds = {};
const music = {};
let texturesLoaded = false;

// Sound volume settings
const soundVolumes = {
    pistol_fire:   0.60,   // mid-level pop
    shotgun_fire:  0.80,   // beefier blast
    player_draw:   0.40,   // subtle draw sound
    player_hurt:   0.50,   // moderate hurt
    player_die:    0.70,   // dramatic death
    e1_spot:       0.45,   // enemy alert
    e1_shoot:      0.55,   // enemy firing
    e1_hit:        0.40,   // enemy taking damage
    e1_die:        0.60,   // enemy death
    e2_spot:       0.45,   // enemy alert
    e2_shoot:      0.55,   // enemy firing
    e2_hit:        0.40,   // enemy taking damage
    e2_die:        0.60,   // enemy death
    pickup_health: 0.50,   // health pickup
    pickup_ammo:   0.50,   // ammo pickup
    door_open:     0.55,   // door opening
    pickup_key:    0.45,   // key pickup
    victory:       0.70    // victory sound - celebratory, slightly louder
};

// Music volume settings
const musicVolumes = {
    background:    0.05,   // Lower volume for ambient background music
    title:         0.20,   // Slightly higher for title screen
    victory:       0.25,   // Victory music
    gameover:      0.20    // Game over music
};

// Load all sound files
function loadSounds() {
    [
        ['player_draw',   'sounds/player_draw.wav'],
        ['pistol_fire',   'sounds/pistol_fire.wav'],
        ['shotgun_fire',  'sounds/shotgun_fire.wav'],
        ['player_hurt',   'sounds/player_hurt.wav'],
        ['player_die',    'sounds/player_die.wav'],
        ['e1_spot',       'sounds/e1_spot.wav'],
        ['e1_shoot',      'sounds/e1_shoot.wav'],
        ['e1_hit',        'sounds/e1_hit.wav'],
        ['e1_die',        'sounds/e1_die.wav'],
        ['e2_spot',       'sounds/e2_spot.wav'],
        ['e2_shoot',      'sounds/e2_shoot.wav'],
        ['e2_hit',        'sounds/e2_hit.wav'],
        ['e2_die',        'sounds/e2_die.wav'],
        ['pickup_health', 'sounds/pickup_health.wav'],
        ['pickup_ammo',   'sounds/pickup_ammo.wav'],
        ['door_open',     'sounds/door1.wav'],
        ['pickup_key',    'sounds/key.wav'],
        ['victory',       'sounds/victory.wav']
    ].forEach(([key,url]) => {
        const a = new Audio(url);
        a.preload = 'auto';
        a.volume = soundVolumes[key] || 0.6;
        sounds[key] = a;
    });
}

// Load music files
function loadMusic() {
    // INSTRUCTIONS: Place your 30-second WAV file in the 'sounds/' folder
    // and update the filename below (e.g., 'sounds/your_music_file.wav')
    [
        ['background', 'sounds/game_music.wav']  // Replace with your actual filename
    ].forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.loop = true;  // Enable looping for background music
        audio.volume = musicVolumes[key] || 0.25;
        
        // Add basic error handling
        audio.addEventListener('error', (e) => {
            console.log(`❌ Music failed to load: ${key} (${url})`, e);
        });
        
        music[key] = audio;
    });
}


// Background music control
let currentMusic = null;
let musicFading = false;

// Play music with optional fade-in
function playMusic(key, fadeIn = true) {
    if (!music[key]) return;
    
    // Stop current music if playing
    if (currentMusic && currentMusic !== music[key]) {
        stopMusic(false); // Don't fade out, immediate stop
    }
    
    const track = music[key];
    currentMusic = track;
    
    if (fadeIn) {
        track.volume = 0;
        track.play().catch(() => {}); // Ignore autoplay errors
        
        // Fade in over 2 seconds
        const targetVolume = musicVolumes[key] || 0.25;
        const fadeStep = targetVolume / 40; // 40 steps over 2 seconds
        const fadeInterval = setInterval(() => {
            if (track.volume < targetVolume - fadeStep) {
                track.volume += fadeStep;
            } else {
                track.volume = targetVolume;
                clearInterval(fadeInterval);
            }
        }, 50); // Update every 50ms
    } else {
        track.volume = musicVolumes[key] || 0.25;
        track.play().catch(() => {}); // Ignore autoplay errors
    }
}

// Stop music with optional fade-out
function stopMusic(fadeOut = true) {
    if (!currentMusic) return;
    
    if (fadeOut) {
        musicFading = true;
        const track = currentMusic;
        const fadeStep = track.volume / 40; // 40 steps over 2 seconds
        
        const fadeInterval = setInterval(() => {
            if (track.volume > fadeStep) {
                track.volume -= fadeStep;
            } else {
                track.volume = 0;
                track.pause();
                track.currentTime = 0;
                clearInterval(fadeInterval);
                musicFading = false;
                if (currentMusic === track) currentMusic = null;
            }
        }, 50); // Update every 50ms
    } else {
        currentMusic.pause();
        currentMusic.currentTime = 0;
        currentMusic = null;
    }
}

// Set music volume
function setMusicVolume(volume) {
    if (currentMusic) {
        currentMusic.volume = volume;
    }
}

// Get music status
function isMusicFading() {
    return musicFading;
}

// Play sound with volume control
function playSound(key, volume = 1.0) {
    if (sounds[key]) {
        const clip = sounds[key].cloneNode();
        clip.volume = sounds[key].volume * volume;
        clip.play().catch(() => {});
    }
}

// Calculate enemy sound volume based on distance (matching original)
function getEnemyVolume(enemy, player) {
    if (!enemy || typeof enemy.x !== 'number' || typeof enemy.y !== 'number') return 0;
    if (!player || typeof player.x !== 'number' || typeof player.y !== 'number') return 0;
    
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const maxDistance = TILE_SIZE * 4; // fade to minVol by 4 tiles (256 pixels)
    const minVol = 0.15; // still barely audible
    let volume = 1 - distance / maxDistance;
    return Math.max(minVol, Math.min(1, volume));
}

// Play enemy sound with distance-based volume (matching original)
function playEnemySound(enemy, suffix, player) {
    const volume = getEnemyVolume(enemy, player);
    const key = `${enemy.enemyType}_${suffix}`; // e.g. "e1_shoot"
    playSound(key, volume);
}

// Load individual texture file
function loadTexture(imagePath, textureIndex) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = TEXTURE_SIZE;
            canvas.height = TEXTURE_SIZE;
            
            ctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
            const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
            
            textures[textureIndex] = [];
            for (let y = 0; y < TEXTURE_SIZE; y++) {
                textures[textureIndex][y] = [];
                for (let x = 0; x < TEXTURE_SIZE; x++) {
                    const pixelIndex = (y * TEXTURE_SIZE + x) * 4;
                    textures[textureIndex][y][x] = [
                        imageData.data[pixelIndex],     // R
                        imageData.data[pixelIndex + 1], // G
                        imageData.data[pixelIndex + 2], // B
                        imageData.data[pixelIndex + 3]  // A
                    ];
                }
            }
            
            console.log(`Loaded texture: ${imagePath}`);
            resolve();
        };
        
        img.onerror = function() {
            console.error(`Failed to load texture: ${imagePath}`);
            reject(new Error(`Failed to load texture: ${imagePath}`));
        };
        
        img.src = imagePath;
    });
}

// Create procedural texture fallback
function createProceduralTexture(textureIndex, color) {
    textures[textureIndex] = [];
    for (let y = 0; y < TEXTURE_SIZE; y++) {
        textures[textureIndex][y] = [];
        for (let x = 0; x < TEXTURE_SIZE; x++) {
            textures[textureIndex][y][x] = [...color, 255]; // RGBA
        }
    }
}

// Generate HUD face textures procedurally if needed
function generateHUDFaces() {
    console.log('Generating procedural HUD faces...');
    
    // Create simple face textures for different health states
    const faceColors = [
        [100, 255, 100], // 100% health - green
        [255, 255, 100], // 75% health - yellow  
        [255, 200, 100], // 50% health - orange
        [255, 150, 100], // 25% health - red-orange
        [128, 128, 128]  // dead - gray
    ];
    
    faceColors.forEach((color, healthIndex) => {
        // Create 3 animation frames for each health state
        for (let frame = 0; frame < 3; frame++) {
            const textureIndex = 48 + (healthIndex * 3) + frame;
            createProceduralTexture(textureIndex, color);
        }
    });
}

// Load all game assets
async function loadAllAssets() {
    console.log('Loading game assets...');
    
    // Load sounds and music (non-blocking)
    loadSounds();
    loadMusic();
    
    try {
        // Create fallbacks for indices 0 that aren't used in map but might be referenced
        createProceduralTexture(0, [100, 100, 100]); // Fallback for index 0
        
        // Load new wall textures
        try {
            await loadTexture('textures/cooler.png', 2);
            console.log('Loaded cooler.png');
        } catch {
            createProceduralTexture(2, [120, 160, 200]); // Blue cooler fallback
        }
        
        try {
            await loadTexture('textures/Projector1.png', 13);
            console.log('Loaded Projector1.png');
        } catch {
            createProceduralTexture(13, [80, 80, 80]); // Dark projector fallback
        }
        
        try {
            await loadTexture('textures/Projector2.png', 14);
            console.log('Loaded Projector2.png');
        } catch {
            createProceduralTexture(14, [90, 90, 90]); // Lighter projector fallback
        }
        
        try {
            await loadTexture('textures/wall_door.png', 15);
            console.log('Loaded wall_door.png');
        } catch {
            createProceduralTexture(15, [140, 100, 80]); // Brown door wall fallback
        }
        
        try {
            await loadTexture('textures/building_logo.png', 70);
            console.log('Loaded building_logo.png');
        } catch {
            createProceduralTexture(70, [200, 180, 160]); // Light logo wall fallback
        }
        
        // Load wall textures at correct indices with fallbacks
        try {
            await loadTexture('textures/stone_wall.png', 1);  // Map uses 1 for stone_wall
        } catch {
            createProceduralTexture(1, [128, 128, 128]); // Gray stone fallback
        }
        
        try {
            await loadTexture('textures/wall_wht.png', 3);    // Map uses 3 for wall_wht
        } catch {
            createProceduralTexture(3, [210, 180, 140]); // Tan fallback
        }
        
        try {
            await loadTexture('textures/building_1.png', 4);  // Map uses 4 for building_1
        } catch {
            createProceduralTexture(4, [160, 82, 45]); // Brown fallback
        }
        
        try {
            await loadTexture('textures/bar_2r.png', 5);      // Map uses 5 for bar_2r
        } catch {
            createProceduralTexture(5, [139, 69, 19]); // Wood fallback
        }
        
        try {
            await loadTexture('textures/bar_1.png', 6);       // Map uses 6 for bar_1
        } catch {
            createProceduralTexture(6, [105, 105, 105]); // Gray fallback
        }
        
        try {
            await loadTexture('textures/bar_2l.png', 7);      // Map uses 7 for bar_2l
        } catch {
            createProceduralTexture(7, [72, 61, 139]); // Blue fallback
        }
        
        try {
            await loadTexture('textures/booth.png', 8);       // Map uses 8 for booth
        } catch {
            createProceduralTexture(8, [100, 50, 50]); // Dark red fallback
        }
        
        
        // Load special wall textures with fallbacks
        try {
            await loadTexture('textures/bar_1c.png', 36);
            console.log('Loaded bar_1c.png into texture 36');
        } catch {
            console.log('bar_1c.png not found, using bar_1.png');
            textures[36] = textures[6]; // Use bar_1.png as fallback
        }
        
        try {
            await loadTexture('textures/bar1c.png', 37); // Note: bar1c not bar_1c
            console.log('Loaded bar1c.png into texture 37');
        } catch {
            console.log('bar1c.png not found, using bar_1c.png');
            textures[37] = textures[36]; // Use bar_1c.png as fallback
        }
        
        try {
            await loadTexture('textures/booth2.png', 38);
            console.log('Loaded booth2.png into texture 38');
        } catch {
            console.log('booth2.png not found, using booth.png');
            textures[38] = textures[8]; // Use booth.png as fallback
        }
        
        // Load enemy animations
        await loadEnemyAnimations();
        
        // Load weapon textures
        await loadWeaponTextures();
        
        // Load HUD face textures
        await loadHUDFaces();
        
        // Load power-up textures
        await loadPowerUpTextures();
        
        // Load door texture
        await loadDoorTexture();
        
        console.log('All textures loaded!');
        texturesLoaded = true;
        
    } catch (error) {
        console.error('Error loading assets:', error);
        // Create fallback textures
        createFallbackTextures();
        texturesLoaded = true;
    }
}

// Load enemy animation textures
async function loadEnemyAnimations() {
    // Enemy 1 walking animation - Use free indices (booth.png needs index 8)
    try {
        await loadTexture('textures/enemy1_walk1.png', 32);
        await loadTexture('textures/enemy1_walk2.png', 33);
        await loadTexture('textures/enemy1_walk3.png', 34);
        await loadTexture('textures/enemy1_walk4.png', 35);
        console.log('Loaded enemy1 walking animation frames');
    } catch (error) {
        console.log('Could not load enemy1 walking textures, using fallbacks');
        [32, 33, 34, 35].forEach(i => createProceduralTexture(i, [255, 100, 100]));
    }
    
    // Enemy 2 walking animation - Use free indices after enemy1
    try {
        await loadTexture('textures/enemy2_walk1.png', 9);
        await loadTexture('textures/enemy2_walk2.png', 10);
        await loadTexture('textures/enemy2_walk3.png', 11);
        await loadTexture('textures/enemy2_walk4.png', 12);
        console.log('Loaded enemy2 walking animation frames');
    } catch (error) {
        console.log('Could not load enemy2 walking textures, using fallbacks');
        [9, 10, 11, 12].forEach(i => createProceduralTexture(i, [100, 255, 100]));
    }
    
    // Load shooting and death animations...
    await loadEnemyShootingAnimations();
    await loadEnemyDeathAnimations();
}

// Load enemy shooting animations
async function loadEnemyShootingAnimations() {
    // Enemy 1 shooting - MATCH ORIGINAL INDICES
    try {
        await loadTexture('textures/enemy1_shoot1.png', 16);
        await loadTexture('textures/enemy1_shoot2.png', 17);
        await loadTexture('textures/enemy1_shoot3.png', 18);
        await loadTexture('textures/enemy1_shoot4.png', 19);
        console.log('Loaded enemy1 shooting animation frames');
    } catch (error) {
        [16, 17, 18, 19].forEach(i => createProceduralTexture(i, [255, 150, 150]));
    }
    
    // Enemy 2 shooting - MATCH ORIGINAL INDICES
    try {
        await loadTexture('textures/enemy2_shoot1.png', 20);
        await loadTexture('textures/enemy2_shoot2.png', 21);
        await loadTexture('textures/enemy2_shoot3.png', 22);
        await loadTexture('textures/enemy2_shoot4.png', 23);
        console.log('Loaded enemy2 shooting animation frames');
    } catch (error) {
        [20, 21, 22, 23].forEach(i => createProceduralTexture(i, [150, 255, 150]));
    }
}

// Load enemy death animations
async function loadEnemyDeathAnimations() {
    // Enemy 1 death - MATCH ORIGINAL INDICES
    try {
        await loadTexture('textures/enemy1_death1.png', 24);
        await loadTexture('textures/enemy1_death2.png', 25);
        await loadTexture('textures/enemy1_death3.png', 26);
        await loadTexture('textures/enemy1_death4.png', 27);
        console.log('Loaded enemy1 death animation frames');
    } catch (error) {
        [24, 25, 26, 27].forEach(i => createProceduralTexture(i, [128, 64, 64]));
    }
    
    // Enemy 2 death - MATCH ORIGINAL INDICES
    try {
        await loadTexture('textures/enemy2_death1.png', 28);
        await loadTexture('textures/enemy2_death2.png', 29);
        await loadTexture('textures/enemy2_death3.png', 30);
        await loadTexture('textures/enemy2_death4.png', 31);
        console.log('Loaded enemy2 death animation frames');
    } catch (error) {
        [28, 29, 30, 31].forEach(i => createProceduralTexture(i, [64, 128, 64]));
    }
}

// Load weapon textures
async function loadWeaponTextures() {
    // Pistol textures (40-43) - required
    try {
        await loadTexture('textures/weapon_up1.png', 40);
        await loadTexture('textures/weapon_up2.png', 41);
        await loadTexture('textures/weapon_fire1.png', 42);
        await loadTexture('textures/weapon_fire2.png', 43);
        console.log('Loaded pistol textures');
    } catch (error) {
        console.log('Could not load pistol textures, using procedural pistol textures');
        [40, 41, 42, 43].forEach(i => createProceduralTexture(i, [64, 64, 64]));
    }
    
    // Shotgun textures (44-47)
    try {
        await loadTexture('textures/shotgun_up1.png', 44);
        await loadTexture('textures/shotgun_up2.png', 45);
        await loadTexture('textures/shotgun_fire1.png', 46);
        await loadTexture('textures/shotgun_fire2.png', 47);
        console.log('Loaded shotgun textures');
    } catch (error) {
        console.log('Could not load shotgun textures, using procedural shotgun textures');
        [44, 45, 46, 47].forEach(i => createProceduralTexture(i, [32, 32, 32]));
    }
}

// Load HUD face textures
async function loadHUDFaces() {
    const faceStates = ['100', '75', '50', '25', 'dead'];
    const faceTypes = ['face1', 'face2', 'face3'];
    
    let loadedFaces = false;
    
    // Try to load face textures
    try {
        for (let stateIndex = 0; stateIndex < faceStates.length; stateIndex++) {
            const state = faceStates[stateIndex];
            
            for (let typeIndex = 0; typeIndex < faceTypes.length; typeIndex++) {
                const faceType = faceTypes[typeIndex];
                const textureIndex = 48 + (stateIndex * 3) + typeIndex;
                
                try {
                    await loadTexture(`textures/${faceType}_${state}.png`, textureIndex);
                    console.log(`Loaded ${faceType}_${state}.png`);
                    loadedFaces = true;
                } catch {
                    if (faceType === 'face1') {
                        throw new Error(`Missing face1_${state}.png`);
                    } else {
                        // Use face1 as fallback for face2/face3
                        console.log(`${faceType}_${state}.png not found, using face1_${state}.png`);
                        textures[textureIndex] = textures[48 + (stateIndex * 3)]; // face1 equivalent
                    }
                }
            }
        }
        
        if (loadedFaces) {
            console.log('Loaded animated faces for 5 health states');
        }
        
    } catch (error) {
        console.log('Could not load face textures, generating procedural faces');
        generateHUDFaces();
    }
}

// Load power-up and decoration textures
async function loadPowerUpTextures() {
    // Health pack
    try {
        await loadTexture('textures/health_pack.png', 68);
        console.log('Loaded health_pack.png');
    } catch {
        createProceduralTexture(68, [255, 100, 100]); // Red cross
    }
    
    // Ammo box
    try {
        await loadTexture('textures/ammo_box.png', 69);
        console.log('Loaded ammo_box.png');
    } catch {
        createProceduralTexture(69, [150, 150, 50]); // Yellow box
    }
    
    // Keg sprite
    try {
        await loadTexture('textures/keg1.png', 71);
        console.log('Loaded keg1.png');
    } catch {
        createProceduralTexture(71, [101, 67, 33]); // Brown keg fallback
    }
    
    // Table decoration
    try {
        await loadTexture('textures/table.png', 72);
        console.log('Loaded table.png');
    } catch {
        createProceduralTexture(72, [139, 69, 19]); // Brown table
    }
    
    // Shotgun pickup item
    try {
        await loadTexture('textures/shotgun_item.png', 73);
        console.log('Loaded shotgun_item.png');
    } catch {
        createProceduralTexture(73, [64, 64, 64]); // Dark gray shotgun fallback
    }
}

// Load door texture
async function loadDoorTexture() {
    try {
        await loadTexture('textures/door1.png', 90);
        console.log('Loaded door1.png');
    } catch {
        createProceduralTexture(90, [139, 69, 19]); // Brown door fallback
        console.log('door1.png not found, using procedural door texture');
    }
}

// Create fallback textures if loading fails
function createFallbackTextures() {
    console.log('Creating fallback textures...');
    
    // Basic wall textures
    const wallColors = [
        [128, 128, 128], // Stone
        [139, 69, 19],   // Wood
        [160, 82, 45],   // Saddle brown
        [210, 180, 140], // Tan
        [105, 105, 105], // Dim gray
        [72, 61, 139]    // Dark slate blue
    ];
    
    wallColors.forEach((color, index) => {
        if (!textures[index]) {
            createProceduralTexture(index, color);
        }
    });
    
    // Generate all missing textures
    generateHUDFaces();
}

// Export functions and variables for use in other modules
export {
    textures,
    sounds,
    music,
    texturesLoaded,
    loadAllAssets,
    playSound,
    playEnemySound,
    getEnemyVolume,
    playMusic,
    stopMusic,
    setMusicVolume,
    isMusicFading,
    createProceduralTexture,
    generateHUDFaces
};