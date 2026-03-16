/**
 * Entity base class and components
 * Component-based architecture for flexible game objects
 */

class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.type = 'entity';
        this.components = new Map();
        this.markedForDeletion = false;
        this.engine = null;
        this.id = Math.random().toString(36).substr(2, 9);
    }
    
    addComponent(name, component) {
        component.entity = this;
        this.components.set(name, component);
        return component;
    }
    
    getComponent(name) {
        return this.components.get(name);
    }
    
    hasComponent(name) {
        return this.components.has(name);
    }
    
    removeComponent(name) {
        this.components.delete(name);
    }
    
    update(dt) {
        // Update all components
        for (const [name, component] of this.components) {
            if (component.update) {
                component.update(dt);
            }
        }
        
        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;
    }
    
    render(ctx, alpha) {
        // Render all components
        for (const [name, component] of this.components) {
            if (component.render) {
                component.render(ctx, alpha);
            }
        }
    }
    
    destroy() {
        this.markedForDeletion = true;
        for (const [name, component] of this.components) {
            if (component.destroy) {
                component.destroy();
            }
        }
    }
}

// Components

class TransformComponent {
    constructor(x = 0, y = 0, rotation = 0, scale = 1) {
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.scale = scale;
        this.entity = null;
    }
    
    getWorldPosition() {
        return { x: this.entity.x + this.x, y: this.entity.y + this.y };
    }
}

class HealthComponent {
    constructor(maxHealth) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.entity = null;
    }
    
    takeDamage(amount) {
        this.currentHealth -= amount;
        
        // Emit hit event
        if (this.entity && this.entity.engine) {
            this.entity.engine.events.emit('entityHit', {
                entity: this.entity,
                damage: amount,
                x: this.entity.x,
                y: this.entity.y
            });
        }
        
        if (this.currentHealth <= 0) {
            this.die();
        }
    }
    
    heal(amount) {
        this.currentHealth = Math.min(this.currentHealth + amount, this.maxHealth);
    }
    
    die() {
        if (this.entity && this.entity.engine) {
            this.entity.engine.events.emit('entityDeath', {
                entity: this.entity,
                x: this.entity.x,
                y: this.entity.y
            });
        }
        this.entity.destroy();
    }
    
    getHealthPercent() {
        return this.currentHealth / this.maxHealth;
    }
}

class MovementComponent {
    constructor(speed = 1) {
        this.speed = speed;
        this.target = null;
        this.path = [];
        this.pathIndex = 0;
        this.slowFactor = 1;
        this.slowTimer = 0;
        this.entity = null;
    }
    
    setPath(path) {
        this.path = path;
        this.pathIndex = 0;
    }
    
    applySlow(factor, duration) {
        this.slowFactor = factor;
        this.slowTimer = duration;
    }
    
    update(dt) {
        // Handle slow effect
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
        } else {
            this.slowFactor = 1;
        }
        
        if (!this.path || this.pathIndex >= this.path.length - 1) return;
        
        const target = this.path[this.pathIndex + 1];
        const dx = target.x - this.entity.x;
        const dy = target.y - this.entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const moveSpeed = this.speed * this.slowFactor * (dt / 16);
        
        if (dist < moveSpeed) {
            this.pathIndex++;
            if (this.pathIndex >= this.path.length - 1) {
                this.onPathComplete();
            }
        } else {
            this.entity.x += (dx / dist) * moveSpeed;
            this.entity.y += (dy / dist) * moveSpeed;
            this.entity.rotation = Math.atan2(dy, dx);
        }
    }
    
    onPathComplete() {
        if (this.entity && this.entity.engine) {
            this.entity.engine.events.emit('enemyReachedEnd', {
                entity: this.entity
            });
        }
        this.entity.destroy();
    }
}

class SpriteComponent {
    constructor(options = {}) {
        this.color = options.color || '#ffffff';
        this.size = options.size || 20;
        this.emoji = options.emoji || '';
        this.glow = options.glow || false;
        this.glowColor = options.glowColor || this.color;
        this.entity = null;
    }
    
    render(ctx, alpha) {
        ctx.save();
        
        const x = this.entity.x;
        const y = this.entity.y;
        
        // Glow effect
        if (this.glow) {
            ctx.shadowColor = this.glowColor;
            ctx.shadowBlur = 15;
        }
        
        // Draw shape based on entity type
        ctx.fillStyle = this.color;
        
        if (this.entity.type === 'enemy') {
            // Flying enemies are triangles
            if (this.entity.flying) {
                ctx.beginPath();
                ctx.moveTo(x, y - this.size);
                ctx.lineTo(x - this.size * 0.8, y + this.size * 0.5);
                ctx.lineTo(x + this.size * 0.8, y + this.size * 0.5);
                ctx.closePath();
                ctx.fill();
            } else {
                // Ground enemies are circles
                ctx.beginPath();
                ctx.arc(x, y, this.size * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (this.entity.type === 'tower') {
            // Towers are squares with rounded corners
            const halfSize = this.size * 0.8;
            ctx.beginPath();
            ctx.roundRect(x - halfSize, y - halfSize, halfSize * 2, halfSize * 2, 5);
            ctx.fill();
            
            // Tower base
            ctx.fillStyle = '#333';
            ctx.fillRect(x - halfSize * 0.8, y - halfSize * 0.8, halfSize * 1.6, halfSize * 1.6);
        } else if (this.entity.type === 'projectile') {
            // Projectiles are small circles
            ctx.beginPath();
            ctx.arc(x, y, this.size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw emoji/icon
        if (this.emoji) {
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.font = `${this.size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, x, y);
        }
        
        ctx.restore();
    }
}

class HealthBarComponent {
    constructor(width = 30, height = 4) {
        this.width = width;
        this.height = height;
        this.offsetY = -25;
        this.entity = null;
    }
    
    render(ctx) {
        const health = this.entity.getComponent('health');
        if (!health) return;
        
        const x = this.entity.x - this.width / 2;
        const y = this.entity.y + this.offsetY;
        const percent = health.getHealthPercent();
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, this.width, this.height);
        
        // Health fill
        ctx.fillStyle = percent > 0.5 ? '#0f0' : percent > 0.25 ? '#ff0' : '#f00';
        ctx.fillRect(x, y, this.width * percent, this.height);
    }
}

export { 
    Entity, 
    TransformComponent, 
    HealthComponent, 
    MovementComponent,
    SpriteComponent,
    HealthBarComponent
 };