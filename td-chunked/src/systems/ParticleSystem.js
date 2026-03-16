/**
 * ParticleSystem.js - Handles visual effects, explosions, trails
 * Optimized with object pooling for performance
 */

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.pool = []; // Object pool for reuse
        this.maxParticles = 500;
        
        // Effect presets
        this.presets = {
            explosion: {
                count: 20,
                speed: { min: 2, max: 6 },
                life: { min: 30, max: 60 },
                size: { min: 2, max: 6 },
                colors: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff'],
                gravity: 0.1,
                fade: true
            },
            hit: {
                count: 8,
                speed: { min: 1, max: 3 },
                life: { min: 15, max: 30 },
                size: { min: 1, max: 3 },
                colors: ['#ffffff', '#ffcccc'],
                gravity: 0,
                fade: true
            },
            trail: {
                count: 1,
                speed: { min: 0, max: 0.5 },
                life: { min: 20, max: 40 },
                size: { min: 3, max: 5 },
                colors: ['rgba(233, 69, 96, 0.5)'],
                gravity: -0.02,
                fade: true
            },
            towerBuild: {
                count: 30,
                speed: { min: 1, max: 4 },
                life: { min: 40, max: 80 },
                size: { min: 2, max: 5 },
                colors: ['#00ff00', '#00cc00', '#99ff99'],
                gravity: -0.05,
                fade: true
            },
            cash: {
                count: 10,
                speed: { min: 0.5, max: 2 },
                life: { min: 30, max: 50 },
                size: { min: 2, max: 4 },
                colors: ['#ffd700', '#ffec8b'],
                gravity: -0.1,
                fade: true
            }
        };
    }
    
    init(engine) {
        this.engine = engine;
        
        // Listen for events that spawn particles
        engine.events.on('enemyDeath', ({ x, y, color }) => {
            this.spawn('explosion', x, y, color);
        });
        
        engine.events.on('enemyHit', ({ x, y }) => {
            this.spawn('hit', x, y);
        });
        
        engine.events.on('towerBuilt', ({ x, y }) => {
            this.spawn('towerBuild', x, y);
        });
        
        engine.events.on('cashEarned', ({ x, y }) => {
            this.spawn('cash', x, y);
        });
    }
    
    spawn(presetName, x, y, overrideColor = null) {
        const preset = this.presets[presetName];
        if (!preset) return;
        
        for (let i = 0; i < preset.count; i++) {
            // Get from pool or create new
            let particle = this.pool.pop() || {};
            
            particle.x = x;
            particle.y = y;
            particle.vx = (Math.random() - 0.5) * (preset.speed.max - preset.speed.min) + preset.speed.min;
            particle.vy = (Math.random() - 0.5) * (preset.speed.max - preset.speed.min) + preset.speed.min;
            particle.life = Math.random() * (preset.life.max - preset.life.min) + preset.life.min;
            particle.maxLife = particle.life;
            particle.size = Math.random() * (preset.size.max - preset.size.min) + preset.size.min;
            particle.color = overrideColor || preset.colors[Math.floor(Math.random() * preset.colors.length)];
            particle.gravity = preset.gravity;
            particle.fade = preset.fade;
            
            this.particles.push(particle);
        }
        
        // Trim excess particles
        if (this.particles.length > this.maxParticles) {
            const excess = this.particles.splice(0, this.particles.length - this.maxParticles);
            this.pool.push(...excess);
        }
    }
    
    spawnTrail(x, y, color) {
        if (Math.random() > 0.3) return; // Don't spawn every frame
        
        let particle = this.pool.pop() || {};
        const preset = this.presets.trail;
        
        particle.x = x + (Math.random() - 0.5) * 10;
        particle.y = y + (Math.random() - 0.5) * 10;
        particle.vx = (Math.random() - 0.5) * 0.5;
        particle.vy = (Math.random() - 0.5) * 0.5;
        particle.life = Math.random() * 20 + 20;
        particle.maxLife = particle.life;
        particle.size = Math.random() * 2 + 3;
        particle.color = color || preset.colors[0];
        particle.gravity = preset.gravity;
        particle.fade = true;
        
        this.particles.push(particle);
    }
    
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            // Update physics
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.life -= dt / 16; // Normalize to ~60fps
            
            // Return to pool when dead
            if (p.life <= 0) {
                this.pool.push(this.particles.splice(i, 1)[0]);
            }
        }
    }
    
    render(ctx) {
        ctx.save();
        
        for (const p of this.particles) {
            const alpha = p.fade ? p.life / p.maxLife : 1;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    clear() {
        this.pool.push(...this.particles);
        this.particles = [];
    }
}

export { ParticleSystem };