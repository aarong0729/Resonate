// Particles Module - Safe Blood Splatter Implementation

// Import dependencies
import { TILE_SIZE } from './map.js';

// Particle system constants - FINAL ATTEMPT
const PARTICLE_CONSTANTS = {
    MAX_PARTICLES: 150,           
    BLOOD_PARTICLE_COUNT: 12,     
    BLOOD_LIFETIME: 800,          // Much shorter - 0.8 seconds
    BLOOD_SPEED_MIN: 1,           // Very slow
    BLOOD_SPEED_MAX: 2,           // Very short range
    GRAVITY: 0.003,               // Very gentle pull back to center
    FADE_START: 0.3               // Start fading early
};

// Active particles array
const particles = [];

// Simple blood particle class - FINAL ATTEMPT
class BloodParticle {
    constructor(x, y, angle, speed) {
        this.startX = x; // Remember where we started
        this.startY = y;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = PARTICLE_CONSTANTS.BLOOD_LIFETIME;
        this.maxLife = PARTICLE_CONSTANTS.BLOOD_LIFETIME;
        this.type = 'blood';
        this.textureIndex = 68;
        
        // Color for red tinting
        this.red = 200 + Math.random() * 55;   
        this.green = Math.random() * 20;       
        this.blue = Math.random() * 15;        
    }
    
    update(deltaTime) {
        const timeScale = deltaTime / 16.67; // Normalize to 60fps
        
        // Calculate age (0 = new, 1 = dying)
        const agePercent = 1 - (this.life / this.maxLife);
        
        // FINAL ATTEMPT: Apply gravity that pulls back toward start position
        const dx = this.startX - this.x;
        const dy = this.startY - this.y;
        
        // As particles age, pull them back toward origin (simulate falling to ground)
        const pullStrength = agePercent * PARTICLE_CONSTANTS.GRAVITY;
        this.vx += dx * pullStrength;
        this.vy += dy * pullStrength;
        
        // Air resistance - slow down over time
        this.vx *= 0.96;
        this.vy *= 0.96;
        
        // Update position
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;
        
        // Update lifetime
        this.life -= deltaTime;
        
        return this.life > 0;
    }
    
    getAlpha() {
        const lifePercent = this.life / this.maxLife;
        if (lifePercent > PARTICLE_CONSTANTS.FADE_START) {
            return 1.0;
        } else {
            return lifePercent / PARTICLE_CONSTANTS.FADE_START;
        }
    }
}

// Create blood splatter with weapon-specific intensity
function createBloodSplatter(x, y, direction = null, weaponMultiplier = 1.0) {
    // Calculate particle count based on weapon
    const particleCount = Math.floor(PARTICLE_CONSTANTS.BLOOD_PARTICLE_COUNT * weaponMultiplier);
    
    // Safety check - don't exceed limits
    if (particles.length >= PARTICLE_CONSTANTS.MAX_PARTICLES) {
        // Remove oldest particles to make room
        particles.splice(0, particleCount);
    }
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        let angle;
        
        if (direction !== null) {
            // Spray in direction with spread (more spread for shotgun)
            const baseSpread = Math.PI / 4; // 45 degree spread
            const spread = baseSpread * (weaponMultiplier > 1.5 ? 1.5 : 1.0); // Wider spread for shotgun
            angle = direction + (Math.random() - 0.5) * spread;
        } else {
            // Random direction
            angle = Math.random() * Math.PI * 2;
        }
        
        const speed = PARTICLE_CONSTANTS.BLOOD_SPEED_MIN + 
                     Math.random() * (PARTICLE_CONSTANTS.BLOOD_SPEED_MAX - PARTICLE_CONSTANTS.BLOOD_SPEED_MIN);
        
        const particle = new BloodParticle(x, y, angle, speed);
        particles.push(particle);
    }
    
    console.log(`Blood splatter created: ${particleCount} particles (${weaponMultiplier}x multiplier), ${particles.length} total`);
}

// Update all particles
function updateParticles(deltaTime) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        if (!particle.update(deltaTime)) {
            particles.splice(i, 1);
        }
    }
}

// Convert particles to sprites for rendering (safe approach)
function getParticleSprites(player) {
    return particles.map(particle => {
        const distance = Math.sqrt((particle.x - player.x) ** 2 + (particle.y - player.y) ** 2);
        const alpha = particle.getAlpha();
        
        return {
            x: particle.x,
            y: particle.y,
            textureIndex: particle.textureIndex, // Uses existing health pack texture
            active: true,
            isHitFlashing: false,
            distance: distance,
            bobOffset: 0, // No bobbing for this approach
            type: 'bloodParticle', // Unique type for special rendering
            // Custom color data for red tinting
            bloodColor: [
                Math.floor(particle.red * alpha),
                Math.floor(particle.green * alpha),
                Math.floor(particle.blue * alpha),
                Math.floor(255 * alpha)
            ]
        };
    });
}

// Debug functions
function getParticleCount() {
    return particles.length;
}

function clearAllParticles() {
    particles.length = 0;
    console.log('All particles cleared');
}

// Test function - create particles at player position
function testCreateParticles(player) {
    if (player) {
        createBloodSplatter(player.x, player.y, null);
    }
}

// Export functions
export {
    createBloodSplatter,
    updateParticles,
    getParticleSprites,
    clearAllParticles,
    getParticleCount,
    testCreateParticles,
    PARTICLE_CONSTANTS
};