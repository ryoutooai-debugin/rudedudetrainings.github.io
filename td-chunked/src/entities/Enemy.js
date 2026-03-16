/**
 * Enemy.js - Enemy entity with all necessary components
 */

import { Entity } from '../components/Components.js';
import { HealthComponent, MovementComponent, SpriteComponent, HealthBarComponent } from '../components/Components.js';

class Enemy extends Entity {
    constructor(waveData, path) {
        super(path[0].x, path[0].y);
        
        this.type = 'enemy';
        this.waveData = waveData;
        this.flying = waveData.flying || false;
        
        // Add components
        this.addComponent('health', new HealthComponent(waveData.health));
        this.addComponent('movement', new MovementComponent(waveData.speed));
        this.addComponent('sprite', new SpriteComponent({
            color: waveData.color,
            size: this.flying ? 15 : 12,
            emoji: waveData.emoji || (this.flying ? '🦅' : '🐂'),
            glow: waveData.isBoss || waveData.isElite,
            glowColor: waveData.color
        }));
        this.addComponent('healthBar', new HealthBarComponent());
        
        // Set path
        this.getComponent('movement').setPath(path);
        
        // Store reward
        this.reward = waveData.reward;
    }
    
    takeDamage(damage, type) {
        const health = this.getComponent('health');
        
        // Special damage types
        if (type === 'execute' && health.currentHealth > 50) {
            damage = health.currentHealth; // Instakill
        }
        
        health.takeDamage(damage);
        
        // Apply slow from VWAP
        if (type === 'slow') {
            this.getComponent('movement').applySlow(0.5, 2000);
        }
    }
    
    onDeath() {
        // Award cash
        if (this.engine) {
            this.engine.events.emit('cashEarned', {
                amount: this.reward,
                x: this.x,
                y: this.y
            });
        }
    }
    
    onReachedEnd() {
        // Deal damage to player
        if (this.engine) {
            this.engine.events.emit('playerDamage', {
                damage: 1,
                x: this.x,
                y: this.y
            });
        }
    }
}

export { Enemy };