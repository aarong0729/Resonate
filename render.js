// Render Module - Raycasting Engine and Rendering System

// Import dependencies
import { textures } from './assets.js';
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, map, getFloorTexture, getMapTile, isWallForRendering } from './map.js';
import { doors } from './core.js';

// Rendering constants
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const HUD_HEIGHT = 80;
const TEXTURE_SIZE = 64;

// Z-buffer for sprite depth testing
const ZBuffer = new Array(SCREEN_WIDTH);

// Screen shake effects
let screenShakeTimer = 0;
let screenShakeIntensity = 0;
let screenShakeDuration = 0;  // Store original duration for proper amplitude calculation
let screenShakeOffsetX = 0;
let screenShakeOffsetY = 0;

// Initialize canvas context
let ctx = null;
let canvas = null;

// Initialize rendering system
function initRenderer(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    return ctx;
}

// Check if door at position is open for rendering
function isDoorOpen(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    
    for (const door of doors) {
        if (door.mapX === mapX && door.mapY === mapY) {
            return door.isOpen;
        }
    }
    return false; // No door found, treat as closed
}

// Apply screen shake effect
function applyScreenShake(intensity, duration) {
    screenShakeIntensity = intensity;
    screenShakeTimer = duration;
    screenShakeDuration = duration;  // Store original duration for amplitude calculation
}

// Update screen shake (matching original implementation)
function updateScreenShake(deltaTime) {
    if (screenShakeTimer > 0) {
        screenShakeTimer -= deltaTime;
        // Use the original algorithm: amplitude decreases over time
        const amp = screenShakeIntensity * (screenShakeTimer / screenShakeDuration);
        screenShakeOffsetX = (Math.random() * 2 - 1) * amp;
        screenShakeOffsetY = (Math.random() * 2 - 1) * amp;
        
        if (screenShakeTimer <= 0) {
            screenShakeOffsetX = 0;
            screenShakeOffsetY = 0;
        }
    }
}

// Cast a single ray - matching original implementation exactly
function castRay(angle, player) {
    const rayX = Math.cos(angle);
    const rayY = Math.sin(angle);
    
    let distance = 0;
    const step = 0.5;
    
    while (distance < 800) {
        const testX = player.x + rayX * distance;
        const testY = player.y + rayY * distance;
        
        const mapX = Math.floor(testX / TILE_SIZE);
        const mapY = Math.floor(testY / TILE_SIZE);
        
        if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT || isWallForRendering(testX, testY)) {
            const wallType = (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) ? 1 : map[mapY][mapX];
            
            // Skip open doors - they shouldn't block rays
            if (wallType === 90 && isDoorOpen(testX, testY)) {
                distance += step;
                continue;
            }
            
            const prevX = player.x + rayX * (distance - step);
            const prevY = player.y + rayY * (distance - step);
            const prevMapX = Math.floor(prevX / TILE_SIZE);
            const prevMapY = Math.floor(prevY / TILE_SIZE);
            
            let side = 0;
            let wallX = 0;
            
            if (prevMapX !== mapX) {
                side = 0;
                wallX = (testY % TILE_SIZE) / TILE_SIZE;
                if (rayX > 0) wallX = 1 - wallX;
            } else {
                side = 1;
                wallX = (testX % TILE_SIZE) / TILE_SIZE;
                if (rayY < 0) wallX = 1 - wallX;
            }
            
            return {
                distance: distance,
                wallType: wallType,
                side: side,
                wallX: wallX,
                hitX: testX,
                hitY: testY
            };
        }
        
        distance += step;
    }
    
    return {
        distance: 800,
        wallType: 1,
        side: 0,
        wallX: 0,
        hitX: player.x + rayX * 800,
        hitY: player.y + rayY * 800
    };
}

// Render floor and ceiling
function renderFloorAndCeiling(imageData, player) {
    const data = imageData.data;
    
    // Floor palette matching original
    const floorPalette = [
        [40, 90, 40],      // grass green (outdoors)
        [150, 115, 60],    // wood brown (interior rooms)
        [185, 155, 95]     // yellow-tan walkway
    ];

    /* ---------- SKY/CEILING (top half) ---------- */
    const rayDirX0 = player.dirX - player.planeX;
    const rayDirY0 = player.dirY - player.planeY;
    const rayDirX1 = player.dirX + player.planeX;
    const rayDirY1 = player.dirY + player.planeY;

    for (let y = 0; y < SCREEN_HEIGHT >> 1; y++) {
        // Check if we need ceiling for this pixel
        const p = (SCREEN_HEIGHT / 2) - y;
        const posZ = 0.5 * SCREEN_HEIGHT;
        const rowDist = posZ / p;

        const stepX = rowDist * (rayDirX1 - rayDirX0) / SCREEN_WIDTH;
        const stepY = rowDist * (rayDirY1 - rayDirY0) / SCREEN_WIDTH;

        let floorX = (player.x / TILE_SIZE) + rowDist * rayDirX0;
        let floorY = (player.y / TILE_SIZE) + rowDist * rayDirY0;

        let hasCeiling = false;
        
        for (let x = 0; x < SCREEN_WIDTH; x++) {
            const cellX = Math.floor(floorX - 0.01);
            const cellY = Math.floor(floorY - 0.01);

            // Check if this area should have a ceiling (room 2 area)
            if (cellY >= 1 && cellY <= 14 && cellX >= 10 && cellX <= 15) {
                hasCeiling = true;
                // Stone ceiling color
                const brightness = Math.max(0.4, 0.7 + (y / SCREEN_HEIGHT) * 0.3);
                const r = Math.floor(140 * brightness);
                const g = Math.floor(130 * brightness);
                const b = Math.floor(120 * brightness);
                
                const idx = (y * SCREEN_WIDTH + x) * 4;
                data[idx]     = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            } else {
                // Sky color
                const brightness = 0.8 + (y / SCREEN_HEIGHT) * 0.4;
                const r = Math.floor(135 * brightness);
                const g = Math.floor(180 * brightness);
                const b = Math.floor(235 * brightness);

                const idx = (y * SCREEN_WIDTH + x) * 4;
                data[idx]     = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
            
            floorX += stepX;
            floorY += stepY;
        }
    }

    /* ---------- FLOOR (bottom half) ---------- */

    for (let y = SCREEN_HEIGHT >> 1; y < SCREEN_HEIGHT - HUD_HEIGHT; y++) {
        const p = y - (SCREEN_HEIGHT / 2);
        const posZ = 0.5 * SCREEN_HEIGHT;
        const rowDist = posZ / p;

        const stepX = rowDist * (rayDirX1 - rayDirX0) / SCREEN_WIDTH;
        const stepY = rowDist * (rayDirY1 - rayDirY0) / SCREEN_WIDTH;

        let floorX = (player.x / TILE_SIZE) + rowDist * rayDirX0;
        let floorY = (player.y / TILE_SIZE) + rowDist * rayDirY0;

        for (let x = 0; x < SCREEN_WIDTH; x++) {
            const cellX = Math.floor(floorX - 0.01);
            const cellY = Math.floor(floorY - 0.01);

            // Decide floor colour
            let paletteIdx = 0; // Default to grass

            if (cellY >= 0 && cellY < MAP_HEIGHT && cellX >= 0 && cellX < MAP_WIDTH) {
                const tile = map[cellY][cellX];

                if (tile === 0) {
                    // Walkway strip (columns 10-15, rows 1-14) - room 2 area
                    if (cellX >= 10 && cellX <= 15 && cellY >= 1 && cellY <= 14) {
                        paletteIdx = 2; // yellow walkway
                    } else {
                        // Interior heuristic: wood if surrounded by walls, else grass
                        const n = (map[cellY - 1] && map[cellY - 1][cellX] || 0) > 0;
                        const s = (map[cellY + 1] && map[cellY + 1][cellX] || 0) > 0;
                        const w = (map[cellY] && map[cellY][cellX - 1] || 0) > 0;
                        const e = (map[cellY] && map[cellY][cellX + 1] || 0) > 0;
                        paletteIdx = (n && s && w && e) ? 1 : 0;
                    }
                }
            }

            const [r, g, b] = floorPalette[paletteIdx];

            const idx = (y * SCREEN_WIDTH + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;

            floorX += stepX;
            floorY += stepY;
        }
    }
}

// Render walls using raycasting - matching original implementation
function renderWalls(imageData, player) {
    // Clear Z-buffer
    ZBuffer.fill(Infinity);
    
    for (let i = 0; i < SCREEN_WIDTH; i++) {
        const cameraX = 2 * i / SCREEN_WIDTH - 1;
        const rayDirX = player.dirX + player.planeX * cameraX;
        const rayDirY = player.dirY + player.planeY * cameraX;
        
        const rayAngle = Math.atan2(rayDirY, rayDirX);
        const hit = castRay(rayAngle, player);
        
        const correctedDistance = hit.distance * Math.cos(rayAngle - Math.atan2(player.dirY, player.dirX));
        
        ZBuffer[i] = correctedDistance;
        
        const wallHeight = (TILE_SIZE * SCREEN_HEIGHT) / correctedDistance;
        
        const drawStart = (SCREEN_HEIGHT - wallHeight) / 2;
        const drawEnd = drawStart + wallHeight;
        
        const texture = textures[hit.wallType];
        if (!texture) continue;
        
        const textureYStep = TEXTURE_SIZE / wallHeight;
        let textureY = (drawStart < 0) ? -drawStart * textureYStep : 0;
        
        const startY = Math.max(0, Math.floor(drawStart));
        const endY = Math.min(SCREEN_HEIGHT - HUD_HEIGHT, Math.floor(drawEnd));
        
        for (let y = startY; y < endY; y++) {
            const texX = Math.floor(hit.wallX * TEXTURE_SIZE);
            const texY = Math.floor(textureY);
            
            if (texture[texY] && texture[texY][texX]) {
                const pixel = texture[texY][texX];
                const index = (y * SCREEN_WIDTH + i) * 4;
                
                let shading = 1.0;
                if (hit.side === 1) shading *= 0.8;
                shading *= Math.max(0.3, 1.0 - (correctedDistance / (TILE_SIZE * 8)));
                
                imageData.data[index] = pixel[0] * shading;
                imageData.data[index + 1] = pixel[1] * shading;
                imageData.data[index + 2] = pixel[2] * shading;
                imageData.data[index + 3] = 255;
            }
            
            textureY += textureYStep;
        }
    }
}

// Render sprites - enemies and power-ups
function renderSprites(imageData, allSprites, player, spriteScaleFactor = 1.2) {
    if (!allSprites || allSprites.length === 0) return;
    
    // Filter active sprites only
    const activeSprites = allSprites.filter(sprite => sprite.active);
    if (activeSprites.length === 0) return;
    
    // Sort by distance (farthest first for proper depth rendering)
    activeSprites.sort((a, b) => b.distance - a.distance);
    
    for (let i = 0; i < activeSprites.length; i++) {
        const sprite = activeSprites[i];
        
        const spriteX = sprite.x - player.x;
        const spriteY = sprite.y - player.y;
        
        const invDet = 1.0 / (player.planeX * player.dirY - player.dirX * player.planeY);
        
        if (!isFinite(invDet)) continue;
        
        const transformX = invDet * (player.dirY * spriteX - player.dirX * spriteY);
        const transformY = invDet * (-player.planeY * spriteX + player.planeX * spriteY);
        
        if (transformY <= 0) continue;
        
        const spriteScreenX = Math.floor((SCREEN_WIDTH / 2) * (1 + transformX / transformY));
        
        // Apply different scaling based on sprite type
        let finalScaleFactor;
        if (sprite.type === 'table') {
            finalScaleFactor = spriteScaleFactor * 1.953125; // ~95% increase (1.5625 * 1.25 = another 25% bigger)
        } else if (sprite.type === 'keg') {
            finalScaleFactor = spriteScaleFactor * 1.953125; // Same size as tables
        } else if (sprite.type === 'bloodParticle') {
            finalScaleFactor = spriteScaleFactor * 0.04; // Even smaller for blood particles
        } else if (sprite.type) {
            finalScaleFactor = spriteScaleFactor * 0.60; // 40% reduction for other power-ups
        } else {
            finalScaleFactor = spriteScaleFactor; // Default for enemies
        }
        
        // Classic raycaster billboard - fixed size based on distance only
        const spriteSize = Math.floor((SCREEN_HEIGHT / transformY) * finalScaleFactor * 32);
        const spriteHeight = Math.min(SCREEN_HEIGHT, Math.max(1, spriteSize));
        const spriteWidth = spriteHeight; // Square sprites
        
        // Calculate vertical offset - enemies should be grounded, power-ups can bob
        let finalVMoveScreen = 0;
        if (sprite.type) {
            // Power-ups use bobbing offset
            finalVMoveScreen = Math.floor(sprite.bobOffset || 0);
        } else {
            // Enemies should be positioned at ground level
            finalVMoveScreen = Math.floor(spriteHeight * 0.25); // Lower enemies to ground
        }
        
        if (spriteHeight < 5 || spriteWidth < 5) continue;
        
        let drawStartY = Math.floor(-spriteHeight / 2 + SCREEN_HEIGHT / 2 + finalVMoveScreen);
        if (drawStartY < 0) drawStartY = 0;
        let drawEndY = Math.floor(spriteHeight / 2 + SCREEN_HEIGHT / 2 + finalVMoveScreen);
        if (drawEndY >= SCREEN_HEIGHT) drawEndY = SCREEN_HEIGHT - 1;
        
        let drawStartX = Math.floor(-spriteWidth / 2 + spriteScreenX);
        let drawEndX = Math.floor(spriteWidth / 2 + spriteScreenX);
        
        // Allow sprites to go off-screen naturally, only clamp for safety
        drawStartX = Math.max(-spriteWidth, drawStartX);
        drawEndX = Math.min(SCREEN_WIDTH + spriteWidth, drawEndX);
        
        if (drawStartX >= drawEndX || drawStartY >= drawEndY) continue;
        
        // Choose texture - for power-ups use textureIndex directly, for enemies use state-based logic
        let currentTextureIndex;
        if (sprite.type) {
            // Power-up sprite - use textureIndex directly
            currentTextureIndex = sprite.textureIndex;
        } else {
            // Enemy sprite - use state-based texture selection (legacy logic)
            if (sprite.state === 'dying') {
                currentTextureIndex = sprite.deathTextureIndex + sprite.currentFrame;
            } else if (sprite.isWalking) {
                currentTextureIndex = sprite.walkTextureIndex + sprite.currentFrame;
            } else {
                currentTextureIndex = sprite.shootTextureIndex + sprite.currentFrame;
            }
        }
        
        const spriteTexture = textures[currentTextureIndex];
        if (!spriteTexture) continue;
        
        for (let stripe = drawStartX; stripe < drawEndX; stripe++) {
            const texX = Math.floor((stripe - drawStartX) * TEXTURE_SIZE / (drawEndX - drawStartX));
            if (texX < 0 || texX >= TEXTURE_SIZE) continue;
            
            if (transformY > 0 && stripe >= 0 && stripe < SCREEN_WIDTH && 
                stripe < ZBuffer.length && transformY < ZBuffer[stripe]) {
                
                for (let y = drawStartY; y < drawEndY; y++) {
                    const d = (y - finalVMoveScreen) * 256 - SCREEN_HEIGHT * 128 + spriteHeight * 128;
                    const texY = Math.floor(((d * TEXTURE_SIZE) / spriteHeight) / 256);
                    
                    if (texY < 0 || texY >= TEXTURE_SIZE) continue;
                    
                    if (!spriteTexture[texY] || !spriteTexture[texY][texX]) continue;
                    
                    const pixel = spriteTexture[texY][texX];
                    
                    if (!pixel || !Array.isArray(pixel)) continue;
                    
                    const alpha = pixel.length > 3 ? pixel[3] : 255;
                    if (alpha > 128) {
                        const brightness = Math.max(0.4, 1 - transformY / (TILE_SIZE * 8));
                        let r, g, b;
                        
                        // Handle blood particle coloring (safe)
                        if (sprite.type === 'bloodParticle' && sprite.bloodColor) {
                            // Use pre-calculated blood color
                            r = sprite.bloodColor[0];
                            g = sprite.bloodColor[1];
                            b = sprite.bloodColor[2];
                        } else {
                            // Normal sprite coloring
                            r = Math.floor(pixel[0] * brightness);
                            g = Math.floor(pixel[1] * brightness);
                            b = Math.floor(pixel[2] * brightness);
                        }
                        
                        // Apply hit flash effect (red tint) for enemies - matching original
                        if (sprite.isHitFlashing && sprite.state === 'alive') {
                            r = Math.min(255, r + 100); // Add red
                            g = Math.max(0, g - 50);     // Reduce green
                            b = Math.max(0, b - 50);     // Reduce blue
                        }
                        
                        const index = (y * SCREEN_WIDTH + stripe) * 4;
                        imageData.data[index] = r;
                        imageData.data[index + 1] = g;
                        imageData.data[index + 2] = b;
                        imageData.data[index + 3] = 255;
                    }
                }
            }
        }
    }
}

// Render weapon at bottom of screen
function renderWeapon(imageData, weapon, player) {
    if (!weapon.isVisible) return;
    
    let weaponTexture;
    if (weapon.state === 'coming_up') {
        weaponTexture = textures[weapon.upTextures[weapon.currentFrame]];
    } else if (weapon.state === 'firing') {
        weaponTexture = textures[weapon.fireTextures[weapon.currentFrame]];
    } else if (weapon.state === 'ready') {
        weaponTexture = textures[weapon.upTextures[weapon.upTextures.length - 1]];
    }
    
    if (!weaponTexture) return;
    
    const weaponWidth = 150;
    const weaponHeight = 120;
    
    // Weapon bob & placement
    const freq = 0.006;          // bob frequency
    const amp = 6;               // bob amplitude in px
    const bob = Math.sin(player.walkTimer * freq) * amp;

    const floorY = SCREEN_HEIGHT - HUD_HEIGHT;   // top edge of HUD
    const baseY = floorY - weaponHeight + 8;     // 8-px gap

    const weaponX = SCREEN_WIDTH / 2 - weaponWidth / 2 + bob;  // gentle X sway
    const weaponY = baseY - bob * 0.5;                         // gentle Y bob
    
    // Round once so indices stay integers
    const weaponIX = Math.round(weaponX);
    const weaponIY = Math.round(weaponY);
    
    for (let y = 0; y < weaponHeight; y++) {
        for (let x = 0; x < weaponWidth; x++) {
            const screenY = weaponIY + y;
            const screenX = weaponIX + x;
            
            // Only render if within screen bounds and above HUD
            if (screenX >= 0 && screenX < SCREEN_WIDTH && 
                screenY >= 0 && screenY < SCREEN_HEIGHT) {
                
                const texX = Math.floor((x / weaponWidth) * TEXTURE_SIZE);
                const texY = Math.floor((y / weaponHeight) * TEXTURE_SIZE);
                
                if (texX >= 0 && texX < TEXTURE_SIZE && texY >= 0 && texY < TEXTURE_SIZE && 
                    weaponTexture[texY] && weaponTexture[texY][texX]) {
                    
                    const pixel = weaponTexture[texY][texX];
                    if (pixel && pixel[3] > 128) { // Check alpha
                        const index = (screenY * SCREEN_WIDTH + screenX) * 4;
                        if (index >= 0 && index < imageData.data.length - 3) {
                            imageData.data[index] = pixel[0];
                            imageData.data[index + 1] = pixel[1];
                            imageData.data[index + 2] = pixel[2];
                            imageData.data[index + 3] = 255;
                        }
                    }
                }
            }
        }
    }
}

// Render crosshair
function renderCrosshair(imageData) {
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const size = 6;
    const thickness = 2;
    
    // Horizontal line
    for (let x = centerX - size; x <= centerX + size; x++) {
        for (let t = 0; t < thickness; t++) {
            const y = centerY + t - thickness / 2;
            if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT - HUD_HEIGHT) {
                const index = (Math.floor(y) * SCREEN_WIDTH + Math.floor(x)) * 4;
                imageData.data[index] = 255;     // R
                imageData.data[index + 1] = 255; // G
                imageData.data[index + 2] = 255; // B
                imageData.data[index + 3] = 255; // A
            }
        }
    }
    
    // Vertical line
    for (let y = centerY - size; y <= centerY + size; y++) {
        for (let t = 0; t < thickness; t++) {
            const x = centerX + t - thickness / 2;
            if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT - HUD_HEIGHT) {
                const index = (Math.floor(y) * SCREEN_WIDTH + Math.floor(x)) * 4;
                imageData.data[index] = 255;     // R
                imageData.data[index + 1] = 255; // G
                imageData.data[index + 2] = 255; // B
                imageData.data[index + 3] = 255; // A
            }
        }
    }
}

// Apply screen effects (damage, etc.)
function renderScreenEffects(imageData, effects) {
    if (effects.damageFlash && effects.damageFlash.intensity > 0) {
        const intensity = effects.damageFlash.intensity;
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            // Red damage overlay
            imageData.data[i] = Math.min(255, imageData.data[i] + intensity * 100);     // R
            imageData.data[i + 1] = Math.max(0, imageData.data[i + 1] - intensity * 50); // G
            imageData.data[i + 2] = Math.max(0, imageData.data[i + 2] - intensity * 50); // B
        }
    }
    
    if (effects.lowHealth && effects.lowHealth.intensity > 0) {
        const intensity = effects.lowHealth.intensity;
        const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
        
        // Red border effect for low health
        for (let y = 0; y < SCREEN_HEIGHT - HUD_HEIGHT; y++) {
            for (let x = 0; x < SCREEN_WIDTH; x++) {
                const distFromEdge = Math.min(x, SCREEN_WIDTH - x, y, SCREEN_HEIGHT - HUD_HEIGHT - y);
                if (distFromEdge < 20) {
                    const borderIntensity = intensity * pulse * (1 - distFromEdge / 20);
                    const index = (y * SCREEN_WIDTH + x) * 4;
                    imageData.data[index] = Math.min(255, imageData.data[index] + borderIntensity * 80);
                }
            }
        }
    }
}

// Main render function
function render(player, allSprites, weapon, gameState, effects = {}) {
    if (!ctx) return;
    
    // Create image data for pixel manipulation
    const imageData = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Render floor and ceiling
    renderFloorAndCeiling(imageData, player);
    
    // Render walls
    renderWalls(imageData, player);
    
    // Render sprites (enemies and power-ups)
    renderSprites(imageData, allSprites, player, 1.2);
    
    // Render weapon
    renderWeapon(imageData, weapon, player);
    
    // Render crosshair
    renderCrosshair(imageData);
    
    // Apply screen effects
    renderScreenEffects(imageData, effects);
    
    // Draw to canvas with screen shake offset (matching original implementation)
    ctx.putImageData(
        imageData,
        Math.round(screenShakeOffsetX),   // X offset
        Math.round(screenShakeOffsetY)    // Y offset
    );
    
    // Game state overlays are now handled by the HUD module
}

// Export rendering functions
export {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    HUD_HEIGHT,
    ZBuffer,
    initRenderer,
    render,
    castRay,
    renderWalls,
    renderSprites,
    renderWeapon,
    renderFloorAndCeiling,
    renderCrosshair,
    renderScreenEffects,
    applyScreenShake,
    updateScreenShake
};