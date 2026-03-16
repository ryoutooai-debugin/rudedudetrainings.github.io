/**
 * Tower.js - Tower entity base class and specific tower types
 */

import { Entity } from '../components/Components.js';
import { SpriteComponent } from '../components/Components.js';

class Tower extends Entity {
    constructor(x, y, type, stats) {
        super(x, y);
        
        this.type = 'tower';
        this.towerType = type;
        this.stats = stats;
        this.lastFire = 0;
        this.target = null;
        this.angle = 0;
        
        // Add sprite component
        this.addComponent('sprite', new SpriteComponent({
            color: stats.color,
            size: 20,
            emoji: stats.emoji,
            glow: true,
            glowColor: stats.color
        }));
    }
    
    update(dt) {
        super.update(dt);
        
        // Find target
        this.findTarget();
        
        // Fire at target
        if (this.target) {
            this.angle = Math.atan2(
                this.target.y - this.y,
                this.target.x - this.x
            );
            
            this.lastFire += dt;
            if (this.lastFire >= this.stats.fireRate) {
                this.fire();
                this.lastFire = 0;
            }
        }
        
        // Generate income for CC tower
        if (this.stats.income && this.engine) {
            // Income generated on fire in original, could be per second here
        }
    }
    
    findTarget() {
        if (!this.engine) return;
        
        this.target = null;
        let minDist = Infinity;
        
        // Find closest enemy in range
        for (const entity of this.engine.entities) {
            if (entity.type !== 'enemy') continue;
            
            const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
            
            if (dist <= this.stats.range && dist < minDist) {
                minDist = dist;
                this.target = entity;
            }
        }
    }
    
    fire() {
        if (!this.engine || !this.target) return;
        
        // Create projectile
        this.engine.events.emit('spawnProjectile', {
            x: this.x,
            y: this.y,
            target: this.target,
            towerType: this.towerType,
            stats: this.stats
        });
        
        // Generate income for CC tower
        if (this.stats.income) {
            this.engine.events.emit('cashEarned', {
                amount: this.stats.income,
                x: this.x,
                y: this.y - 30
            });
        }
    }
    
    render(ctx, alpha) {
        super.render(ctx, alpha);
        
        // Draw range circle when selected (subtle)
        if (this.showRange) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.stats.range, 0, Math.PI * 2);
            ctx.fillStyle = this.stats.color + '10';
            ctx.fill();
            ctx.strokeStyle = this.stats.color + '40';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Draw barrel/aim direction
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(20, 0);
        ctx.stroke();
        
        ctx.restore();
    }
}

// Tower type definitions
const TowerTypes = {
    EWO: {
        name: 'EWO',
        cost: 100,
        damage: 15,
        range: 120,
        fireRate: 1000,
        color: '#00ff00',
        emoji: '📊',
        description: 'Oscillating waves hit multiple enemies',
        splash: true,
        splashRadius: 50,
        splashDamage: 0.5
    },
    Scalper: {
        name: 'Scalper',
        cost: 150,
        damage: 8,
        range: 100,
        fireRate: 200,
        color: '#ffff00',
        emoji: '⚡',
        description: 'Rapid fire, low damage, high speed'
    },
    CC: {
        name: 'CC',
        cost: 200,
        damage: 12,
        range: 130,
        fireRate: 800,
        color: '#ff00ff',
        emoji: '💵',
        description: 'Generates cash while attacking',
        income: 5
    },
    VWAP: {
        name: 'VWAP',
        cost: 250,
        damage: 5,
        range: 140,
        fireRate: 500,
        color: '#00ffff',
        emoji: '🎯',
        description: 'Slows enemies in range',
        slow: true
    },
    StopLoss: {
        name: 'StopLoss',
        cost: 300,
        damage: 100,
        range: 150,
        fireRate: 2000,
        color: '#ff0000',
        emoji: '🛑',
        description: 'Insta-kills strong enemies',
        execute: true
    }
};

export { Tower, TowerTypes };