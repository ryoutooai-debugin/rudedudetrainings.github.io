/**
 * GameEngine.js - Core game loop and state management
 * Handles the main game loop, state transitions, and system coordination
 */

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1000 / 60; // 60 FPS target
        
        // Game state
        this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAME_OVER
        this.difficulty = 'medium';
        
        // Systems
        this.systems = new Map();
        this.entities = [];
        
        // Event bus for system communication
        this.events = new EventBus();
        
        // Bind methods
        this.loop = this.loop.bind(this);
        
        // Handle resize
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.events.emit('resize', { width: this.canvas.width, height: this.canvas.height });
    }
    
    registerSystem(name, system) {
        this.systems.set(name, system);
        system.init(this);
    }
    
    getSystem(name) {
        return this.systems.get(name);
    }
    
    start() {
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }
    
    loop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Prevent spiral of death on lag
        const maxDelta = 100;
        const dt = Math.min(deltaTime, maxDelta);
        
        this.accumulator += dt;
        
        // Fixed time step updates
        while (this.accumulator >= this.timeStep) {
            this.update(this.timeStep);
            this.accumulator -= this.timeStep;
        }
        
        // Render with interpolation
        const alpha = this.accumulator / this.timeStep;
        this.render(alpha);
        
        requestAnimationFrame(this.loop);
    }
    
    update(dt) {
        if (this.state !== 'PLAYING') return;
        
        // Update all systems
        for (const [name, system] of this.systems) {
            system.update(dt);
        }
        
        // Update entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            entity.update(dt);
            
            if (entity.markedForDeletion) {
                this.entities.splice(i, 1);
            }
        }
    }
    
    render(alpha) {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render all systems
        for (const [name, system] of this.systems) {
            if (system.render) {
                system.render(this.ctx, alpha);
            }
        }
        
        // Render entities
        for (const entity of this.entities) {
            entity.render(this.ctx, alpha);
        }
    }
    
    addEntity(entity) {
        entity.engine = this;
        this.entities.push(entity);
        return entity;
    }
    
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.events.emit('stateChange', { oldState, newState });
    }
    
    pause() {
        if (this.state === 'PLAYING') {
            this.setState('PAUSED');
        } else if (this.state === 'PAUSED') {
            this.setState('PLAYING');
        }
    }
}

/**
 * EventBus - Simple pub/sub for system communication
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
    }
    
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        for (const callback of this.listeners.get(event)) {
            callback(data);
        }
    }
}

export { GameEngine, EventBus };