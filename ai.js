// AI Module - Enemy Behavior and Combat AI

// Import dependencies
import { playEnemySound } from './assets.js';
import { TILE_SIZE, isWallNear, hasLineOfSight } from './map.js';
import { isDoorBlocking, isDoorNear, isBlocked, isTableBlocking } from './core.js';
import { fireEnemyProjectile } from './weapons.js';
import { createBloodSplatter } from './particles.js';

// Check if enemy position is blocked by walls, doors, and tables
function isEnemyBlocked(x, y, radius) {
    return isWallNear(x, y, radius) || isDoorNear(x, y, radius) || isTableBlocking(x, y);
}

// Enemy type templates (configurations for different enemy types)
const enemyTemplates = {
    'e1': {
        color: 'red',
        speed: 0.8,
        walkTextureIndex: 32,    // Walking animation (32,33,34,35) - booth.png needs index 8
        shootTextureIndex: 16,   // Shooting animation (16,17,18,19)
        deathTextureIndex: 24,   // Death animation (24,25,26,27)
        shootCooldown: 2000,     // 2 seconds between shots
        defaultHealth: 75,       // 5 pistol shots (15x5=75), 2 shotgun shots (50x2=100)
        damage: 15               // E1 hits harder
    },
    'e2': {
        color: 'green',
        speed: 1.2,
        walkTextureIndex: 9,     // Walking animation (9,10,11,12) - moved to avoid conflicts
        shootTextureIndex: 20,   // Shooting animation (20,21,22,23)
        deathTextureIndex: 28,   // Death animation (28,29,30,31)
        shootCooldown: 1800,     // 1.8 seconds between shots
        defaultHealth: 45,       // Exactly 3 pistol shots (15x3=45)
        damage: 8                // E2 hits lighter
    }
};

// Active enemies array (starts empty, populated by resetEnemies)
const enemies = [];

// AI behavior constants - match original exactly
const AI_CONSTANTS = {
    MIN_DISTANCE: TILE_SIZE * 1,
    OPTIMAL_DISTANCE: TILE_SIZE * 1.5,
    MAX_CHASE_DISTANCE: TILE_SIZE * 5,
    SHOOTING_RANGE: TILE_SIZE * 4,
    COLLISION_PADDING: TILE_SIZE * 0.25 // 16 pixels - match original pad
};

// Create a new enemy
function createEnemy(x, y, enemyType, health = null) {
    const template = enemyTemplates[enemyType] || enemyTemplates['e1']; // Fallback to e1 template
    const finalHealth = health || template.defaultHealth;
    
    return {
        x: x,
        y: y,
        color: template.color,
        enemyType: enemyType,
        speed: template.speed,
        walkTextureIndex: template.walkTextureIndex,
        shootTextureIndex: template.shootTextureIndex,
        deathTextureIndex: template.deathTextureIndex,
        currentFrame: 0,
        frameTimer: 0,
        frameSpeed: 200, // Match original 200ms per frame
        isWalking: true,
        lastShotTime: 0,
        shootCooldown: template.shootCooldown,
        shootDuration: 800,
        shootStartTime: 0,
        canSeePlayer: false,
        health: finalHealth,
        maxHealth: finalHealth,
        damage: template.damage || 10,  // Enemy damage value
        state: 'alive',
        deathStartTime: 0,
        deathDuration: 800,
        hitFlashTime: 0,
        hitFlashDuration: 150,
        aiState: "idle"
    };
}

// Damage an enemy
function damageEnemy(enemy, damage, gameStats, player) {
    if (enemy.state !== 'alive') return false;
    
    enemy.health -= damage;
    enemy.hitFlashTime = Date.now();
    
    console.log(`${enemy.enemyType} took ${damage} damage, health: ${enemy.health}/${enemy.maxHealth}`);
    
    // Create blood splatter effect when enemy is hit
    if (player) {
        // Calculate direction from player to enemy for blood spray
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const direction = Math.atan2(dy, dx);
        
        // Determine weapon multiplier based on damage
        let weaponMultiplier = 1.0;
        if (damage >= 50) {
            // Shotgun damage (50) - double the blood
            weaponMultiplier = 2.0;
        } else if (damage >= 15) {
            // Pistol damage (15) - 50% more blood than original
            weaponMultiplier = 1.0; // Already increased base count by 50%
        }
        
        // Create blood splatter at enemy position
        createBloodSplatter(enemy.x, enemy.y, direction, weaponMultiplier);
    }
    
    console.log(`Hit ${enemy.enemyType} for ${damage} damage! Health: ${enemy.health}`);
    
    if (enemy.health <= 0) {
        // Enemy dies - MATCH ORIGINAL EXACTLY
        enemy.state = 'dying';
        enemy.deathStartTime = Date.now();
        enemy.currentFrame = 0;      // Reset animation to start from first death frame
        enemy.frameTimer = 0;        // Reset frame timer
        enemy.isWalking = false;     // Stop movement
        
        // Create extra blood splatter on death
        if (player) {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const direction = Math.atan2(dy, dx);
            
            // Use same weapon multiplier for death splatter
            let weaponMultiplier = 1.0;
            if (damage >= 35) {
                weaponMultiplier = 2.0; // Shotgun
            }
            
            // Create additional blood splatter for death
            createBloodSplatter(enemy.x, enemy.y, direction, weaponMultiplier);
            createBloodSplatter(enemy.x, enemy.y, null, weaponMultiplier); // Random spray too
        }
        
        // Play death sound
        playEnemySound(enemy, 'die', player);
        
        // Update game stats
        if (gameStats) {
            gameStats.enemiesKilled++;
            gameStats.score += (enemy.maxHealth >= 40) ? 100 : 75;
        }
        
        console.log(`${enemy.enemyType} killed! Score: ${gameStats ? gameStats.score : '?'}`);
        return true; // Enemy died
    } else {
        // Enemy survived - play hit sound (matching original)
        playEnemySound(enemy, 'hit', player);
    }
    
    return false; // Enemy damaged but alive
}

// Update enemy AI and behavior
function updateEnemyAI(enemy, enemyIndex, player, deltaTime, gameStats) {
    const currentTime = Date.now();
    
    // Skip AI processing for dying enemies (animation handled in updateEnemyAnimation)
    if (enemy.state === 'dying') {
        return;
    }
    
    if (enemy.state !== 'alive') return;
    
    // Calculate distance and direction to player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check line of sight
    const prevSee = enemy.canSeePlayer;
    enemy.canSeePlayer = hasLineOfSight(enemy.x, enemy.y, player.x, player.y);
    
    // Play "spot" sound when LOS is first acquired
    if (!prevSee && enemy.canSeePlayer) {
        playEnemySound(enemy, 'spot', player);
    }
    
    // AI behavior logic
    updateEnemyBehavior(enemy, enemyIndex, player, dx, dy, distance, currentTime);
    
    // Update animations
    updateEnemyAnimation(enemy, deltaTime);
}

// Detect which room a position is in (same logic as core.js)
function getRoomForPosition(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    
    // Room 2 is roughly columns 10-15, rows 1-14
    if (mapX >= 10 && mapX <= 15 && mapY >= 1 && mapY <= 14) {
        return 2;
    }
    // Everything else is Room 1
    return 1;
}

// Update enemy behavior based on AI state
function updateEnemyBehavior(enemy, enemyIndex, player, dx, dy, distance, currentTime) {
    const pad = AI_CONSTANTS.COLLISION_PADDING;
    
    // Check if enemy and player are in different rooms
    const enemyRoom = getRoomForPosition(enemy.x, enemy.y);
    const playerRoom = getRoomForPosition(player.x, player.y);
    const differentRooms = enemyRoom !== playerRoom;
    
    // Check if enemy can shoot
    const timeSinceLastShot = currentTime - enemy.lastShotTime;
    const canShoot = enemy.canSeePlayer && 
                   distance <= AI_CONSTANTS.SHOOTING_RANGE && 
                   timeSinceLastShot >= enemy.shootCooldown && 
                   enemy.isWalking;
    
    // Handle shooting state transition
    if (!enemy.isWalking) {
        const shootingDuration = currentTime - enemy.shootStartTime;
        if (shootingDuration >= enemy.shootDuration) {
            enemy.isWalking = true;
        }
    }
    
    // Execute AI behavior
    if (canShoot) {
        // Start shooting
        enemy.isWalking = false;
        enemy.shootStartTime = currentTime;
        enemy.lastShotTime = currentTime;
        enemy.aiState = "shooting";
        
        // Fire projectile
        fireEnemyProjectile(enemy, player);
        
        // Play shoot sound
        playEnemySound(enemy, 'shoot', player);
        
    } else if (enemy.isWalking) {
        // If player is in a different room, patrol instead of chase
        if (differentRooms) {
            enemy.aiState = "patrolling";
            // Simple patrol behavior - move in a small circle or random walk
            const patrolSpeed = enemy.speed * 0.3;
            const time = currentTime * 0.001; // Convert to seconds
            const patrolRadius = 32;
            
            // Circular patrol pattern based on enemy index and time
            const angle = (time + enemyIndex * 2) * 0.5; // Different phase for each enemy
            const targetX = enemy.x + Math.cos(angle) * patrolRadius * 0.1;
            const targetY = enemy.y + Math.sin(angle) * patrolRadius * 0.1;
            
            if (!isEnemyBlocked(targetX, enemy.y, pad)) enemy.x = targetX;
            if (!isEnemyBlocked(enemy.x, targetY, pad)) enemy.y = targetY;
            
        } else if (distance > AI_CONSTANTS.OPTIMAL_DISTANCE && distance < AI_CONSTANTS.MAX_CHASE_DISTANCE) {
            // Chase player (only when in same room)
            enemy.aiState = "chasing";
            const moveX = (dx / distance) * enemy.speed * 0.7;
            const moveY = (dy / distance) * enemy.speed * 0.7;
            
            const newX = enemy.x + moveX;
            const newY = enemy.y + moveY;
            
            if (!isEnemyBlocked(newX, enemy.y, pad)) enemy.x = newX;
            if (!isEnemyBlocked(enemy.x, newY, pad)) enemy.y = newY;
            
        } else if (distance <= AI_CONSTANTS.MIN_DISTANCE) {
            // Retreat from player
            enemy.aiState = "retreating";
            const moveX = -(dx / distance) * enemy.speed * 0.4;
            const moveY = -(dy / distance) * enemy.speed * 0.4;
            
            const newX = enemy.x + moveX;
            const newY = enemy.y + moveY;
            
            if (!isEnemyBlocked(newX, enemy.y, pad)) enemy.x = newX;
            if (!isEnemyBlocked(enemy.x, newY, pad)) enemy.y = newY;
            
        } else {
            // Circle around player
            enemy.aiState = "circling";
            const perpX = -dy / distance;
            const perpY = dx / distance;
            
            const circleDirection = (enemyIndex % 2 === 0) ? 1 : -1;
            const circleSpeed = enemy.speed * 0.6;
            const approachFactor = Math.sin(Date.now() * 0.001 + enemyIndex) * 0.2;
            
            const moveX = (perpX * circleDirection * circleSpeed) + (dx / distance * approachFactor);
            const moveY = (perpY * circleDirection * circleSpeed) + (dy / distance * approachFactor);
            
            const newX = enemy.x + moveX;
            const newY = enemy.y + moveY;
            
            if (!isEnemyBlocked(newX, enemy.y, pad)) enemy.x = newX;
            if (!isEnemyBlocked(enemy.x, newY, pad)) enemy.y = newY;
        }
    } else {
        // Currently shooting - maintain shooting state
        enemy.aiState = "shooting";
    }
}

// Update enemy animation frames
function updateEnemyAnimation(enemy, deltaTime) {
    enemy.frameTimer += deltaTime;
    if (enemy.frameTimer >= enemy.frameSpeed) {
        enemy.frameTimer = 0;
        
        if (enemy.state === 'alive') {
            enemy.currentFrame = (enemy.currentFrame + 1) % 4;
        } else if (enemy.state === 'dying') {
            // Death animation - only advance frames until we reach the last frame (frame 3)
            if (enemy.currentFrame < 3) {
                enemy.currentFrame++;
                
                if (enemy.currentFrame >= 3) {
                    // Reached last frame - stay here for 2 seconds
                    console.log(`Enemy death animation complete, staying on last frame...`);
                }
            }
            // If currentFrame >= 3, we stay on the last frame (no further advancement)
        }
    }
}

// Get enemy texture index based on current state
function getEnemyTextureIndex(enemy) {
    if (enemy.state === 'dead') {
        return enemy.deathTextureIndex + 3; // Last death frame
    } else if (enemy.state === 'dying') {
        return enemy.deathTextureIndex + enemy.currentFrame;
    } else if (enemy.state === 'alive') {
        if (enemy.isWalking) {
            return enemy.walkTextureIndex + enemy.currentFrame;
        } else {
            // Shooting animation
            return enemy.shootTextureIndex + enemy.currentFrame;
        }
    }
    
    return enemy.walkTextureIndex; // Fallback
}

// Check if enemy is hit flashing (for red tint effect)
function isEnemyHitFlashing(enemy) {
    if (enemy.hitFlashTime === 0) return false;
    const flashDuration = Date.now() - enemy.hitFlashTime;
    return flashDuration < enemy.hitFlashDuration;
}

// Get all living enemies
function getLivingEnemies() {
    return enemies.filter(enemy => enemy.state === 'alive');
}

// Get all enemies (for rendering)
function getAllEnemies() {
    return enemies;
}

// Remove dead enemies from the game
function removeDeadEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].state === 'dead') {
            const removedEnemy = enemies.splice(i, 1)[0];
            console.log(`Removed dead ${removedEnemy.enemyType} from game`);
        }
    }
}

// Update all enemies
function updateAllEnemies(player, deltaTime, gameStats) {
    let aliveCount = 0;
    const currentTime = Date.now();
    
    for (let i = enemies.length - 1; i >= 0; i--) { // Iterate backwards for safe removal
        const enemy = enemies[i];
        
        // Check if dying enemy should be removed
        if (enemy.state === 'dying') {
            const totalDeathTime = enemy.deathDuration + 2000; // Original 800ms + 2000ms pause
            if (currentTime - enemy.deathStartTime >= totalDeathTime) {
                console.log(`Removing dead enemy ${i} after ${totalDeathTime}ms`);
                enemies.splice(i, 1);
                continue; // Skip to next enemy
            }
        }
        
        updateEnemyAI(enemy, i, player, deltaTime, gameStats);
        updateEnemyAnimation(enemy, deltaTime); // Update animation for ALL enemies (alive and dying)
        
        if (enemy.state === 'alive') {
            aliveCount++;
        }
    }
    
    return aliveCount;
}

// Reset all enemies to initial state  
function resetEnemies() {
    // Reset to 5 enemies in room 1 - 1 E1 + 4 E2s
    enemies.length = 0;
    
    // 1 E1 (tougher enemy) - back corner of room 1
    enemies.push(createEnemy(7.5 * TILE_SIZE, 6.5 * TILE_SIZE, 'e1')); // Far from player spawn
    
    // 4 E2s (weaker enemies) - spread around room 1
    enemies.push(createEnemy(3.5 * TILE_SIZE, 6.5 * TILE_SIZE, 'e2')); // Left side
    enemies.push(createEnemy(6.5 * TILE_SIZE, 3.5 * TILE_SIZE, 'e2')); // Upper right
    enemies.push(createEnemy(2.5 * TILE_SIZE, 8.5 * TILE_SIZE, 'e2')); // Lower left
    enemies.push(createEnemy(7.5 * TILE_SIZE, 8.5 * TILE_SIZE, 'e2')); // Lower right
    
    console.log('Enemies reset: 1 E1 + 4 E2s spawned in room 1');
}

// Add a new enemy to the game
function addEnemy(x, y, enemyType, health) {
    const newEnemy = createEnemy(x, y, enemyType, health);
    enemies.push(newEnemy);
    return newEnemy;
}

// Get enemy count by state
function getEnemyStats() {
    const stats = {
        alive: 0,
        dying: 0,
        dead: 0,
        total: enemies.length
    };
    
    enemies.forEach(enemy => {
        stats[enemy.state]++;
    });
    
    return stats;
}

// Check if all enemies are dead (victory condition)
function areAllEnemiesDead() {
    const aliveCount = enemies.filter(enemy => enemy.state === 'alive').length;
    const dyingCount = enemies.filter(enemy => enemy.state === 'dying').length;
    const total = enemies.length;
    
    // Victory when no alive enemies remain (whether array is empty or all are dying/dead)
    const victory = aliveCount === 0;
    
    // Enhanced debug info - always log when checking victory condition with enemies present
    if (total > 0) {
        console.log(`Victory check: ${aliveCount} alive, ${dyingCount} dying, ${total} total. Victory: ${victory}`);
    }
    
    // Additional victory celebration log
    if (victory && total >= 0) {
        console.log(`🎉 Victory achieved! ${total} enemies remaining in cleanup, 0 alive`);
    }
    
    return victory;
}

// Get enemy at position (for interaction/collision)
function getEnemyAtPosition(x, y, radius = 32) {
    return enemies.find(enemy => {
        if (enemy.state !== 'alive') return false;
        const dx = x - enemy.x;
        const dy = y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= radius;
    });
}

// Export AI functions and data
export {
    enemies,
    AI_CONSTANTS,
    createEnemy,
    damageEnemy,
    updateEnemyAI,
    updateEnemyBehavior,
    updateEnemyAnimation,
    getEnemyTextureIndex,
    isEnemyHitFlashing,
    getLivingEnemies,
    getAllEnemies,
    removeDeadEnemies,
    updateAllEnemies,
    resetEnemies,
    addEnemy,
    getEnemyStats,
    areAllEnemiesDead,
    getEnemyAtPosition
};