/**
 * Projectile.js - Projectile entity that tracks and damages enemies
 */

import { Entity } from '../components/Components.js';
import { SpriteComponent } from '../components/Components.js';

class Projectile extends Entity {
    constructor(x, y, target, towerType, stats) {
        super(x, y);
        
        this.type = 'projectile';
        this.target = target;
        this.towerType = towerType;
        this.stats = stats;
        this.speed = 8;
        this.hit = false;
        
        // Add sprite
        this.addComponent('sprite', new SpriteComponent({
            color: stats.color,
            size: 8,
            glow: true,
            glowColor: stats.color
        }));
    }
    
    update(dt) {
        if (this.hit || !this.target || this.target.markedForDeletion) {
            this.destroy();
            return;
        }
        
        // Move toward target
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);
        
        const moveSpeed = this.speed * (dt / 16);
        
        if (dist < moveSpeed) {
            // Hit target
            this.hit = true;
            this.onHit();
        } else {
            this.x += (dx / dist) * moveSpeed;
            this.y += (dy / dist) * moveSpeed;
        }
        
        // Trail effect
        if (this.engine && Math.random() > 0.5) {
            this.engine.getSystem('particles')?.spawnTrail(this.x, this.y, this.stats.color);
        }
    }
    
    onHit() {
        if (!this.target) return;
        
        // Deal damage
        let damageType = 'normal';
        if (this.stats.execute) damageType = 'execute';
        if (this.stats.slow) damageType = 'slow';
        
        this.target.takeDamage(this.stats.damage, damageType);
        
        // Splash damage for EWO
        if (this.stats.splash) {
            this.applySplashDamage();
        }
    }
    
    applySplashDamage() {
        if (!this.engine) return;
        
        const splashRadius = this.stats.splashRadius || 50;
        const splashDamage = this.stats.splashDamage || 0.5;
        
        for (const entity of this.engine.entities) {
            if (entity.type !== 'enemy' || entity === this.target) continue;
            
            const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
            if (dist <= splashRadius) {
                entity.takeDamage(this.stats.damage * splashDamage, 'splash');
            }
        }
        
        // Visual splash effect
        this.engine.events.emit('splashEffect', {
            x: this.x,
            y: this.y,
            radius: splashRadius,
            color: this.stats.color
        });
    }
}

export { Projectile };