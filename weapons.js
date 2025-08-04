// Weapons Module - Weapon System and Projectiles

// Import dependencies
import { playSound } from './assets.js';
import { isWallBasic } from './map.js';
import { isBlocked } from './core.js';
import { damageEnemy } from './ai.js';

// Weapon definitions
const weapons = [
    // Pistol (Weapon 1)
    {
        name: 'Pistol',
        isVisible: false,
        state: 'hidden', // 'hidden', 'coming_up', 'ready', 'firing'
        currentFrame: 0,
        frameTimer: 0,
        frameSpeed: 150, // Animation speed in ms
        upTextures: [40, 41], // weapon_up1.png, weapon_up2.png (textures 40-41)
        fireTextures: [42, 43], // weapon_fire1.png, weapon_fire2.png (textures 42-43)
        fireAnimationTime: 200, // How long fire animation lasts
        fireRate: 150,         // ms between shots when trigger held
        lastShotTime: 0,       // timestamp of most recent shot
        fireStartTime: 0,
        damage: 15,            // damage per shot
        soundName: 'pistol_fire',
        available: true        // Player starts with pistol
    },
    // Shotgun (Weapon 2)
    {
        name: 'Shotgun',
        isVisible: false,
        state: 'hidden', // 'hidden', 'coming_up', 'ready', 'firing'
        currentFrame: 0,
        frameTimer: 0,
        frameSpeed: 150, // Animation speed in ms
        upTextures: [44, 45], // shotgun_up1.png, shotgun_up2.png (textures 44-45)
        fireTextures: [46, 47], // shotgun_fire1.png, shotgun_fire2.png (textures 46-47)
        fireAnimationTime: 300, // How long fire animation lasts
        fireRate: 400,         // ms between shots when trigger held (slower than pistol)
        lastShotTime: 0,       // timestamp of most recent shot
        fireStartTime: 0,
        damage: 50,            // damage per shot - 1-shot kill enemies (45 health)
        soundName: 'shotgun_fire',
        available: false       // Shotgun must be picked up
    }
];

let currentWeapon = 0; // 0 = pistol, 1 = shotgun

// Projectile arrays
const playerProjectiles = []; // Player's bullets
const enemyProjectiles = [];  // Enemy bullets

// Game statistics
let gameStats = {
    shotsFired: 0,
    shotsHit: 0,
    enemiesKilled: 0,
    score: 0
};

// Weapon switching function
function switchWeapon(weaponIndex) {
    if (weaponIndex < 0 || weaponIndex >= weapons.length) return;
    if (!weapons[weaponIndex].available) {
        console.log(`${weapons[weaponIndex].name} not available yet!`);
        return; // Can't switch to unavailable weapon
    }
    
    // If it's the same weapon and it's hidden, bring it up
    if (weaponIndex === currentWeapon && weapons[currentWeapon].state === 'hidden') {
        const weapon = weapons[currentWeapon];
        weapon.state = 'coming_up';
        weapon.currentFrame = 0;
        weapon.frameTimer = 0;
        weapon.isVisible = true;
        console.log(`Drawing ${weapon.name}...`);
        playSound('player_draw');
        return;
    }
    
    // If it's the same weapon and it's already visible, do nothing
    if (weaponIndex === currentWeapon) return;
    
    // Hide current weapon
    weapons[currentWeapon].state = 'hidden';
    weapons[currentWeapon].isVisible = false;
    
    // Switch to new weapon and immediately draw it
    currentWeapon = weaponIndex;
    const newWeapon = weapons[currentWeapon];
    newWeapon.state = 'coming_up';
    newWeapon.currentFrame = 0;
    newWeapon.frameTimer = 0;
    newWeapon.isVisible = true;
    
    console.log(`Switched to ${newWeapon.name}`);
    playSound('player_draw');
}


// Player shooting function
function shootPlayer(player) {
    const weapon = weapons[currentWeapon];
    // Only shoot if weapon is ready AND has ammo
    if (weapon.state === 'ready' && player.ammo > 0) {
        // Start firing animation
        weapon.state = 'firing';
        weapon.currentFrame = 0;
        weapon.frameTimer = 0;
        weapon.fireStartTime = Date.now();
        
        // Consume ammo
        player.ammo--;
        
        // Play weapon sound
        playSound(weapon.soundName);
        
        // Create bullet
        const speed = 8; // Player bullets are faster
        const bullet = {
            x: player.x,
            y: player.y,
            vx: player.dirX * speed,
            vy: player.dirY * speed,
            lifetime: 1000, // 1 second lifetime
            damage: weapon.damage,     // Bullet damage from current weapon
            color: 'cyan'
        };
        playerProjectiles.push(bullet);
        gameStats.shotsFired++; // Track shots fired
        console.log(`Player fired ${weapon.name}! Ammo: ${player.ammo}/${player.maxAmmo}`);
    } else if (weapons[currentWeapon].state === 'hidden') {
        console.log('Press 1 to draw pistol first!');
    } else if (player.ammo <= 0) {
        console.log('Out of ammo! Need to find more ammunition.');
    }
}

// Update weapon animations
function updateWeapon(deltaTime) {
    const weapon = weapons[currentWeapon];
    const currentTime = Date.now();
    
    if (weapon.state === 'coming_up') {
        weapon.frameTimer += deltaTime;
        if (weapon.frameTimer >= weapon.frameSpeed) {
            weapon.frameTimer = 0;
            weapon.currentFrame++;
            
            if (weapon.currentFrame >= weapon.upTextures.length) {
                weapon.state = 'ready';
                weapon.currentFrame = weapon.upTextures.length - 1; // Stay on last frame
                console.log(`${weapon.name} ready!`);
            }
        }
    } else if (weapon.state === 'firing') {
        weapon.frameTimer += deltaTime;
        if (weapon.frameTimer >= weapon.frameSpeed) {
            weapon.frameTimer = 0;
            weapon.currentFrame++;
            
            if (weapon.currentFrame >= weapon.fireTextures.length) {
                weapon.currentFrame = 0; // Loop fire animation
            }
        }
        
        // End firing animation after set time
        if (currentTime - weapon.fireStartTime >= weapon.fireAnimationTime) {
            weapon.state = 'ready';
            weapon.currentFrame = weapon.upTextures.length - 1; // Back to ready frame
        }
    }
}

// Handle automatic fire when trigger is held
function handleAutoFire(player, keys) {
    const weapon = weapons[currentWeapon];
    const now = Date.now();
    if (keys[' '] && weapon.state === 'ready' && player.ammo > 0) {
        if (now - weapon.lastShotTime >= weapon.fireRate) {
            shootPlayer(player);                // reuse existing routine
            weapon.lastShotTime = now;
        }
    }
}

// Create enemy projectile
function fireEnemyProjectile(enemy, player) {
    // Calculate direction to player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // Avoid division by zero
    
    const speed = 4; // Enemy bullets are slower
    const bullet = {
        x: enemy.x,
        y: enemy.y,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        lifetime: 2000, // 2 second lifetime
        damage: enemy.damage || 10,     // Use enemy's damage value
        color: 'red',
        enemyType: enemy.enemyType
    };
    
    enemyProjectiles.push(bullet);
    console.log(`${enemy.enemyType} fired at player!`);
}

// Update all projectiles
function updateProjectiles(deltaTime, player, enemies, triggerPlayerDamageEffects = null) {
    // Update player projectiles
    for (let i = playerProjectiles.length - 1; i >= 0; i--) {
        const projectile = playerProjectiles[i];
        
        // Move projectile
        projectile.x += projectile.vx * deltaTime * 0.1;
        projectile.y += projectile.vy * deltaTime * 0.1;
        projectile.lifetime -= deltaTime;
        
        // Check wall and door collision
        if (isBlocked(projectile.x, projectile.y)) {
            playerProjectiles.splice(i, 1);
            continue;
        }
        
        // Check lifetime
        if (projectile.lifetime <= 0) {
            playerProjectiles.splice(i, 1);
            continue;
        }
        
        // Check enemy hits
        let hitEnemy = false;
        for (const enemy of enemies) {
            if (enemy.state === 'alive') {
                const dx = projectile.x - enemy.x;
                const dy = projectile.y - enemy.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 32) { // Hit radius
                    // Damage enemy using the proper damage function
                    const killed = damageEnemy(enemy, projectile.damage, gameStats, player);
                    
                    gameStats.shotsHit++;
                    hitEnemy = true;
                    break;
                }
            }
        }
        
        if (hitEnemy) {
            playerProjectiles.splice(i, 1);
        }
    }
    
    // Update enemy projectiles
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const bullet = enemyProjectiles[i];
        
        // Move bullet
        bullet.x += bullet.vx * deltaTime * 0.1;
        bullet.y += bullet.vy * deltaTime * 0.1;
        bullet.lifetime -= deltaTime;
        
        // Check wall and door collision
        if (isBlocked(bullet.x, bullet.y)) {
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        // Check lifetime
        if (bullet.lifetime <= 0) {
            enemyProjectiles.splice(i, 1);
            continue;
        }
        
        // Check player hit
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 24) { // Player hit radius
            // Damage player
            player.health -= bullet.damage;
            console.log(`Player hit by ${bullet.enemyType} for ${bullet.damage} damage! Health: ${player.health}`);
            
            playSound('player_hurt');
            
            // Trigger damage effects (screen shake and red flash)
            if (triggerPlayerDamageEffects) {
                triggerPlayerDamageEffects();
            }
            
            // Remove bullet
            enemyProjectiles.splice(i, 1);
            
            // Death handling is now managed by core.js
        }
    }
}

// Get current weapon for external access
function getCurrentWeapon() {
    return weapons[currentWeapon];
}

// Get weapon by index
function getWeapon(index) {
    return weapons[index];
}

// Reset all weapons to initial state
function resetWeapons() {
    weapons.forEach(weapon => {
        weapon.isVisible = false;
        weapon.state = 'hidden';
        weapon.currentFrame = 0;
        weapon.frameTimer = 0;
        weapon.lastShotTime = 0;
        weapon.fireStartTime = 0;
    });
    currentWeapon = 0;
}

// Clear all projectiles
function clearProjectiles() {
    playerProjectiles.length = 0;
    enemyProjectiles.length = 0;
}

// Get weapon statistics
function getWeaponStats() {
    return {
        currentWeapon: currentWeapon,
        weaponName: weapons[currentWeapon].name,
        weaponState: weapons[currentWeapon].state,
        isVisible: weapons[currentWeapon].isVisible,
        damage: weapons[currentWeapon].damage,
        fireRate: weapons[currentWeapon].fireRate
    };
}

// Get projectile arrays for rendering
function getProjectiles() {
    return {
        player: playerProjectiles,
        enemy: enemyProjectiles
    };
}

// Get game statistics
function getGameStats() {
    return { ...gameStats };
}

// Reset game statistics
function resetGameStats() {
    gameStats = {
        shotsFired: 0,
        shotsHit: 0,
        enemiesKilled: 0,
        score: 0
    };
}

// Unlock weapon function
function unlockWeapon(weaponIndex) {
    if (weaponIndex >= 0 && weaponIndex < weapons.length) {
        weapons[weaponIndex].available = true;
        console.log(`${weapons[weaponIndex].name} unlocked!`);
        return true;
    }
    return false;
}

// Export weapons functions and data
export {
    weapons,
    currentWeapon,
    playerProjectiles,
    enemyProjectiles,
    gameStats,
    switchWeapon,
    shootPlayer,
    updateWeapon,
    handleAutoFire,
    fireEnemyProjectile,
    updateProjectiles,
    getCurrentWeapon,
    getWeapon,
    resetWeapons,
    clearProjectiles,
    getWeaponStats,
    getProjectiles,
    getGameStats,
    resetGameStats,
    unlockWeapon
};