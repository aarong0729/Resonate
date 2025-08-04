// HUD Module - UI Rendering and HUD Display

// Import dependencies
import { textures } from './assets.js';
import { uiMessage } from './core.js';

// HUD constants
const HUD_HEIGHT = 80;
const TEXTURE_SIZE = 64;

// Face animation system
const faceAnimation = {
    currentFrame: 0,        // 0, 1, or 2 (for face1, face2, face3)
    frameTimer: 0,          // Timer for animation
    frameSpeed: 3000        // 3 seconds per frame
};

// HUD rendering context (set by initHUD)
let ctx = null;
let SCREEN_WIDTH = 640;
let SCREEN_HEIGHT = 480;

// Initialize HUD system
function initHUD(canvasContext, screenWidth, screenHeight) {
    ctx = canvasContext;
    SCREEN_WIDTH = screenWidth;
    SCREEN_HEIGHT = screenHeight;
}

// Update face animation
function updateFaceAnimation(deltaTime) {
    faceAnimation.frameTimer += deltaTime;
    if (faceAnimation.frameTimer >= faceAnimation.frameSpeed) {
        faceAnimation.frameTimer = 0;
        faceAnimation.currentFrame = (faceAnimation.currentFrame + 1) % 3; // Cycle through 0, 1, 2
    }
}

// Get the appropriate face texture based on health percentage and animation frame
function getFaceTextureIndex(player) {
    const healthPercent = (player.health / player.maxHealth) * 100;
    let baseIndex;
    
    if (healthPercent <= 0)      baseIndex = 60;  // Dead   (textures 60‑62)
    else if (healthPercent <= 25) baseIndex = 57; // 25% HP (textures 57‑59)
    else if (healthPercent <= 50) baseIndex = 54; // 50% HP (textures 54‑56)
    else if (healthPercent <= 75) baseIndex = 51; // 75% HP (textures 51‑53)
    else                           baseIndex = 48; // 100%  (textures 48‑50)
    
    // Return the current animation frame for this health state
    return baseIndex + faceAnimation.currentFrame;
}

// Render face texture in HUD
function renderFace(player, x, y, size) {
    const faceTextureIndex = getFaceTextureIndex(player);
    const faceTexture = textures[faceTextureIndex];
    
    if (!faceTexture) return;
    
    // Create temporary canvas for face
    const faceCanvas = document.createElement('canvas');
    const faceCtx = faceCanvas.getContext('2d');
    faceCanvas.width = size;
    faceCanvas.height = size;
    
    const faceImageData = faceCtx.createImageData(size, size);
    
    // Scale face texture to fit
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            const texX = Math.floor((px / size) * TEXTURE_SIZE);
            const texY = Math.floor((py / size) * TEXTURE_SIZE);
            
            if (faceTexture[texY] && faceTexture[texY][texX]) {
                const pixel = faceTexture[texY][texX];
                const index = (py * size + px) * 4;
                faceImageData.data[index] = pixel[0];     // R
                faceImageData.data[index + 1] = pixel[1]; // G
                faceImageData.data[index + 2] = pixel[2]; // B
                faceImageData.data[index + 3] = pixel[3]; // A
            }
        }
    }
    
    faceCtx.putImageData(faceImageData, 0, 0);
    ctx.drawImage(faceCanvas, x, y);
}

// Render text with outline
function renderTextWithOutline(text, x, y, font, fillColor = 'white', strokeColor = 'black', strokeWidth = 1) {
    ctx.font = font;
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.fillText(text, x, y);
    ctx.strokeText(text, x, y);
}

// Main HUD rendering function
function renderHUD(player, gameStats, currentWeapon) {
    if (!ctx) return;
    
    const hudHeight = HUD_HEIGHT;
    const hudY = SCREEN_HEIGHT - hudHeight;
    
    // Draw HUD background (blue bar like Doom/Wolfenstein)
    const gradient = ctx.createLinearGradient(0, hudY, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, '#4169E1'); // Royal blue top
    gradient.addColorStop(0.5, '#1E3A8A'); // Darker blue middle
    gradient.addColorStop(1, '#1E40AF'); // Blue bottom
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, hudY, SCREEN_WIDTH, hudHeight);
    
    // Draw border
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, hudY, SCREEN_WIDTH, hudHeight);
    
    // HUD sections
    const sectionWidth = SCREEN_WIDTH / 5;
    
    // Draw section dividers
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(sectionWidth * i, hudY);
        ctx.lineTo(sectionWidth * i, SCREEN_HEIGHT);
        ctx.stroke();
    }
    
    // Text settings
    ctx.textAlign = 'center';
    
    // Section 1: SCORE
    renderTextWithOutline('SCORE', sectionWidth * 0.5, hudY + 18, 'bold 16px monospace', 'white', 'transparent', 0);
    renderTextWithOutline(gameStats.score.toString(), sectionWidth * 0.5, hudY + 50, 'bold 22px monospace', 'white', 'transparent', 0);
    
    // Section 2: LIVES
    renderTextWithOutline('LIVES', sectionWidth * 1.5, hudY + 18, 'bold 16px monospace', 'white', 'transparent', 0);
    renderTextWithOutline(player.lives.toString(), sectionWidth * 1.5, hudY + 50, 'bold 22px monospace', 'white', 'transparent', 0);
    
    // Section 3: FACE (center) - full height for better integration
    const faceHeight = HUD_HEIGHT - 4; // Almost full HUD height with small margin
    const faceWidth = faceHeight; // Keep square proportions
    const faceX = sectionWidth * 2.5 - faceWidth/2;
    const faceY = hudY + 2; // Small top margin
    renderFace(player, faceX, faceY, faceWidth);
    
    // Section 4: HEALTH
    renderTextWithOutline('HEALTH', sectionWidth * 3.5, hudY + 18, 'bold 16px monospace', 'white', 'transparent', 0);
    const healthPercent = Math.round((player.health / player.maxHealth) * 100);
    const healthColor = healthPercent < 25 ? '#FF4444' : 'white'; // Red when low health
    renderTextWithOutline(healthPercent + '%', sectionWidth * 3.5, hudY + 50, 'bold 22px monospace', healthColor, 'transparent', 0);
    
    // Section 5: WEAPON & AMMO
    renderTextWithOutline(currentWeapon.name.toUpperCase(), sectionWidth * 4.5, hudY + 16, 'bold 14px monospace', 'white', 'transparent', 0);
    renderTextWithOutline('AMMO', sectionWidth * 4.5, hudY + 32, 'bold 16px monospace', 'white', 'transparent', 0);
    const ammoColor = player.ammo < 10 ? '#FFAA44' : 'white'; // Orange when low ammo
    renderTextWithOutline(player.ammo.toString(), sectionWidth * 4.5, hudY + 58, 'bold 22px monospace', ammoColor, 'transparent', 0);
    
    // Render UI messages
    renderUIMessage();
}

// Render debug HUD (optional overlay with technical info)
function renderDebugHUD(player, enemies, projectiles, fps) {
    if (!ctx) return;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 300, 120);
    
    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    
    let y = 25;
    ctx.fillText(`FPS: ${Math.round(fps)}`, 15, y); y += 15;
    ctx.fillText(`Position: ${Math.floor(player.x)}, ${Math.floor(player.y)}`, 15, y); y += 15;
    ctx.fillText(`Direction: ${player.dirX.toFixed(2)}, ${player.dirY.toFixed(2)}`, 15, y); y += 15;
    ctx.fillText(`Enemies Alive: ${enemies.filter(e => e.state === 'alive').length}`, 15, y); y += 15;
    ctx.fillText(`Projectiles: P:${projectiles.player.length} E:${projectiles.enemy.length}`, 15, y); y += 15;
    ctx.fillText(`Face Frame: ${faceAnimation.currentFrame + 1}/3`, 15, y); y += 15;
    ctx.fillText(`Health State: ${getFaceTextureIndex(player)}`, 15, y); y += 15;
}

// Render damage flash overlay
function renderDamageFlash(intensity = 0.5) {
    if (!ctx || intensity <= 0) return;
    
    ctx.fillStyle = `rgba(255, 0, 0, ${intensity * 0.3})`;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT - HUD_HEIGHT);
}

// Render low health warning
function renderLowHealthWarning(player) {
    if (!ctx) return;
    
    const healthPercent = (player.health / player.maxHealth) * 100;
    if (healthPercent > 25) return;
    
    // Pulsing red border for low health
    const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
    const intensity = (1 - healthPercent / 25) * pulse;
    
    ctx.strokeStyle = `rgba(255, 0, 0, ${intensity})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, SCREEN_WIDTH - 4, SCREEN_HEIGHT - HUD_HEIGHT - 4);
}

// Render crosshair
function renderCrosshair(size = 8, thickness = 2, color = 'white') {
    if (!ctx) return;
    
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    
    ctx.fillStyle = color;
    
    // Horizontal line
    ctx.fillRect(centerX - size, centerY - thickness/2, size * 2, thickness);
    
    // Vertical line  
    ctx.fillRect(centerX - thickness/2, centerY - size, thickness, size * 2);
}

// Constants for replay button (matching original)
const REPLAY_BTN = { w: 220, h: 60 };

// Render game state overlays (victory, game over, pause)
function renderGameStateOverlay(gameState, gameStats, player) {
    if (!ctx) return;
    
    if (gameState === 'title') {
        // Render title screen instead of game
        renderTitleScreen();
        return;
    } else if (gameState === 'death') {
        // Death screen overlay
        ctx.fillStyle = 'rgba(139, 0, 0, 0.9)'; // Dark red overlay
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT - HUD_HEIGHT);

        // Death text
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('💀  YOU DIED  💀', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);

        ctx.fillStyle = '#ffaaaa';
        ctx.font = '24px monospace';
        ctx.fillText(`Lives Remaining: ${player.lives}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 20);

        // Respawn instructions
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.fillText('Click anywhere to respawn', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 20);
        ctx.font = '16px monospace';
        ctx.fillText('or press SPACE', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 45);
        
    } else if (gameState === 'victory') {
        // translucent veil (matching original)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT - HUD_HEIGHT);

        // Victory text (matching original)
        ctx.fillStyle = 'lime';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🎉  VICTORY!  🎉', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);

        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.fillText(`Enemies Killed: ${gameStats.enemiesKilled}`, SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 20);

        // Replay button (matching original)
        const btnX = SCREEN_WIDTH / 2 - REPLAY_BTN.w / 2;
        const btnY = SCREEN_HEIGHT / 2 + 20;

        ctx.fillStyle = '#1E40AF';
        ctx.fillRect(btnX, btnY, REPLAY_BTN.w, REPLAY_BTN.h);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(btnX, btnY, REPLAY_BTN.w, REPLAY_BTN.h);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 28px monospace';
        ctx.fillText('Replay', SCREEN_WIDTH / 2, btnY + REPLAY_BTN.h / 2 + 10);
        
    } else if (gameState === 'gameOver') {
        // Game over screen
        ctx.fillStyle = 'rgba(100, 0, 0, 0.8)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', SCREEN_WIDTH/2, SCREEN_HEIGHT/2 - 40);
        
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`Final Score: ${gameStats.score}`, SCREEN_WIDTH/2, SCREEN_HEIGHT/2 + 20);
        ctx.fillText('Press R to restart', SCREEN_WIDTH/2, SCREEN_HEIGHT/2 + 80);
        
    } else if (gameState === 'paused') {
        // Pause screen
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', SCREEN_WIDTH/2, SCREEN_HEIGHT/2);
    }
}

// Render loading screen
function renderLoadingScreen(message = 'Loading...', progress = 0) {
    if (!ctx) return;
    
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    ctx.fillStyle = 'white';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(message, SCREEN_WIDTH/2, SCREEN_HEIGHT/2);
    
    // Progress bar
    if (progress > 0) {
        const barWidth = 300;
        const barHeight = 20;
        const barX = SCREEN_WIDTH/2 - barWidth/2;
        const barY = SCREEN_HEIGHT/2 + 40;
        
        // Background
        ctx.fillStyle = '#444';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        
        // Border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        
        // Progress text
        ctx.fillStyle = 'white';
        ctx.font = '16px monospace';
        ctx.fillText(`${Math.round(progress * 100)}%`, SCREEN_WIDTH/2, barY + barHeight + 25);
    }
}

// Render title screen
function renderTitleScreen() {
    if (!ctx) return;
    
    // Dark background with slight blue tint
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    
    // Title
    ctx.fillStyle = '#ff6b35';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('RAYCASTER', SCREEN_WIDTH/2, 80);
    
    ctx.fillStyle = '#ffa500';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('3D Shooter', SCREEN_WIDTH/2, 110);
    
    // Instructions
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('OBJECTIVE', SCREEN_WIDTH/2, 145);
    
    ctx.font = '16px monospace';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Eliminate all enemies to win!', SCREEN_WIDTH/2, 165);
    
    // Controls section
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('CONTROLS', SCREEN_WIDTH/2, 195);
    
    ctx.font = '13px monospace';
    ctx.fillStyle = '#cccccc';
    const controls = [
        'WASD - Move',
        'Arrow Keys - Look around',
        'Mouse/Spacebar - Fire weapon',
        '1/2 - Switch weapons (Pistol/Shotgun)',
        'E - Use doors and pick up items'
    ];
    
    let yPos = 215;
    controls.forEach(control => {
        ctx.fillText(control, SCREEN_WIDTH/2, yPos);
        yPos += 18;
    });
    
    // Tips section
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('TIPS', SCREEN_WIDTH/2, yPos + 15);
    
    ctx.font = '13px monospace';
    ctx.fillStyle = '#ffa500';
    const tips = [
        '• Start with pistol and 10 ammo',
        '• Find shotgun pickup in Room 2',
        '• Collect health packs and ammo boxes',
        '• More enemies spawn when entering Room 2'
    ];
    
    yPos += 35;
    tips.forEach(tip => {
        ctx.fillText(tip, SCREEN_WIDTH/2, yPos);
        yPos += 16;
    });
    
    // Click to start (pulsing effect) - moved much lower
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 107, 53, ${pulse})`;
    ctx.font = 'bold 24px monospace';
    ctx.fillText('CLICK TO BEGIN', SCREEN_WIDTH/2, SCREEN_HEIGHT - 30);
}

// Render weapon selection overlay
function renderWeaponSelection(weapons, currentWeaponIndex) {
    if (!ctx) return;
    
    const overlayWidth = 200;
    const overlayHeight = 100;
    const overlayX = SCREEN_WIDTH - overlayWidth - 20;
    const overlayY = 20;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);
    
    // Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);
    
    // Title
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WEAPONS', overlayX + overlayWidth/2, overlayY + 20);
    
    // Weapon list
    ctx.font = '14px monospace';
    weapons.forEach((weapon, index) => {
        const y = overlayY + 40 + (index * 20);
        const color = index === currentWeaponIndex ? '#4169E1' : 'white';
        const prefix = index === currentWeaponIndex ? '> ' : '  ';
        
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.fillText(`${prefix}${index + 1}. ${weapon.name}`, overlayX + 10, y);
    });
}

// Get HUD constants for external use
function getHUDConstants() {
    return {
        HUD_HEIGHT,
        TEXTURE_SIZE
    };
}

// Render UI messages (door interactions, key pickups, etc.)
function renderUIMessage() {
    if (!ctx || !uiMessage || !uiMessage.text || uiMessage.timer <= 0) return;
    
    // Calculate fade-out alpha based on remaining time
    const alpha = Math.min(1, uiMessage.timer / 1000); // Fade over last 1 second
    
    // Semi-transparent background
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.8})`;
    ctx.fillRect(SCREEN_WIDTH / 2 - 150, SCREEN_HEIGHT / 2 - 80, 300, 50);
    
    // Message text
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText(uiMessage.text, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);
}

// Export HUD functions and data
export {
    HUD_HEIGHT,
    REPLAY_BTN,
    faceAnimation,
    initHUD,
    renderHUD,
    renderDebugHUD,
    renderDamageFlash,
    renderLowHealthWarning,
    renderCrosshair,
    renderGameStateOverlay,
    renderLoadingScreen,
    renderTitleScreen,
    renderWeaponSelection,
    updateFaceAnimation,
    getFaceTextureIndex,
    renderFace,
    renderTextWithOutline,
    getHUDConstants,
    renderUIMessage
};