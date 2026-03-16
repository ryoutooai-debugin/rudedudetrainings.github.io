/**
 * GameManager.js - Coordinates all systems and handles game flow
 */

import { GameEngine } from './core/GameEngine.js';
import { PathSystem } from './systems/PathSystem.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { WaveSystem } from './systems/WaveSystem.js';
import { Enemy } from './entities/Enemy.js';
import { Tower, TowerTypes } from './entities/Tower.js';
import { Projectile } from './entities/Projectile.js';

class GameManager {
    constructor() {
        this.engine = null;
        this.gameState = {
            cash: 500,
            health: 20,
            maxHealth: 20,
            selectedTower: null,
            wave: 1
        };
        
        this.difficultySettings = {
            easy: { startCash: 600, startHealth: 25 },
            medium: { startCash: 500, startHealth: 20 },
            hard: { startCash: 400, startHealth: 15 }
        };
    }
    
    init(canvasId, difficulty = 'medium') {
        // Create engine
        this.engine = new GameEngine(canvasId);
        this.engine.difficulty = difficulty;
        
        // Apply difficulty settings
        const settings = this.difficultySettings[difficulty];
        this.gameState.cash = settings.startCash;
        this.gameState.health = settings.startHealth;
        this.gameState.maxHealth = settings.startHealth;
        
        // Register systems
        this.engine.registerSystem('paths', new PathSystem());
        this.engine.registerSystem('particles', new ParticleSystem());
        this.engine.registerSystem('waves', new WaveSystem());
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start game loop
        this.engine.start();
        
        // Initial UI update
        this.updateUI();
    }
    
    setupEventListeners() {
        // Enemy spawn
        this.engine.events.on('spawnEnemy', ({ waveData }) => {
            const pathSystem = this.engine.getSystem('paths');
            const enemy = new Enemy(waveData, pathSystem.currentPath);
            this.engine.addEntity(enemy);
        });
        
        // Projectile spawn
        this.engine.events.on('spawnProjectile', ({ x, y, target, towerType, stats }) => {
            const projectile = new Projectile(x, y, target, towerType, stats);
            this.engine.addEntity(projectile);
        });
        
        // Cash earned
        this.engine.events.on('cashEarned', ({ amount, x, y }) => {
            this.gameState.cash += amount;
            this.updateUI();
        });
        
        // Player damage
        this.engine.events.on('playerDamage', ({ damage }) => {
            this.gameState.health -= damage;
            this.updateUI();
            
            // Screen shake effect
            this.shakeScreen();
            
            if (this.gameState.health <= 0) {
                this.gameOver();
            }
        });
        
        // Wave events
        this.engine.events.on('waveStart', ({ wave, waveData }) => {
            this.updateWaveDisplay(waveData);
        });
        
        this.engine.events.on('waveComplete', ({ wave, bonus }) => {
            this.gameState.cash += bonus;
            this.gameState.wave = wave + 1;
            this.updateUI();
            
            // Enable start wave button
            document.getElementById('startWaveBtn').disabled = false;
        });
        
        // Path change
        this.engine.events.on('pathChanged', ({ pathName }) => {
            this.showPathChangeNotification(pathName);
        });
        
        // Canvas click for tower placement
        this.engine.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }
    
    handleCanvasClick(e) {
        if (!this.gameState.selectedTower) return;
        
        const rect = this.engine.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if valid placement (not on path, not on existing tower)
        if (this.isValidPlacement(x, y)) {
            this.placeTower(x, y, this.gameState.selectedTower);
        }
    }
    
    isValidPlacement(x, y) {
        // Check distance from path
        const pathSystem = this.engine.getSystem('paths');
        const minPathDist = 40;
        
        for (let i = 0; i < pathSystem.currentPath.length - 1; i++) {
            const p1 = pathSystem.currentPath[i];
            const p2 = pathSystem.currentPath[i + 1];
            const dist = this.pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
            if (dist < minPathDist) return false;
        }
        
        // Check distance from other towers
        for (const entity of this.engine.entities) {
            if (entity.type === 'tower') {
                const dist = Math.hypot(entity.x - x, entity.y - y);
                if (dist < 35) return false;
            }
        }
        
        return true;
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    placeTower(x, y, towerType) {
        const stats = TowerTypes[towerType];
        
        if (this.gameState.cash >= stats.cost) {
            this.gameState.cash -= stats.cost;
            
            const tower = new Tower(x, y, towerType, stats);
            this.engine.addEntity(tower);
            
            // Spawn build effect
            this.engine.getSystem('particles').spawn('towerBuild', x, y);
            
            this.updateUI();
        }
    }
    
    selectTower(type) {
        this.gameState.selectedTower = 
            this.gameState.selectedTower === type ? null : type;
        this.updateUI();
    }
    
    startWave() {
        this.engine.getSystem('waves').startWave();
        document.getElementById('startWaveBtn').disabled = true;
    }
    
    shakeScreen() {
        const canvas = this.engine.canvas;
        canvas.style.transform = 'translate(5px, 5px)';
        setTimeout(() => {
            canvas.style.transform = 'translate(-5px, -5px)';
            setTimeout(() => {
                canvas.style.transform = 'translate(0, 0)';
            }, 50);
        }, 50);
    }
    
    showPathChangeNotification(pathName) {
        const names = {
            beginner: 'Standard Path',
            intermediate: 'Figure-8 Path',
            advanced: 'Dual Lane',
            nightmare: 'SPIRAL OF DOOM'
        };
        
        // Could show a toast notification here
        console.log(`Path changed to: ${names[pathName]}`);
    }
    
    updateUI() {
        document.getElementById('cash').textContent = `$${this.gameState.cash}`;
        document.getElementById('health').textContent = 
            `${this.gameState.health}/${this.gameState.maxHealth}`;
        document.getElementById('wave').textContent = this.gameState.wave;
        
        const healthPercent = (this.gameState.health / this.gameState.maxHealth) * 100;
        document.getElementById('healthBar').style.width = `${healthPercent}%`;
    }
    
    updateWaveDisplay(waveData) {
        document.getElementById('waveTitle').textContent = 
            `Wave ${this.gameState.wave}: ${waveData.name}`;
        document.getElementById('waveDesc').textContent = waveData.desc;
    }
    
    gameOver() {
        this.engine.setState('GAME_OVER');
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('finalWave').textContent = this.gameState.wave;
    }
    
    reset() {
        // Reset game state
        const settings = this.difficultySettings[this.engine.difficulty];
        this.gameState.cash = settings.startCash;
        this.gameState.health = settings.startHealth;
        this.gameState.wave = 1;
        this.gameState.selectedTower = null;
        
        // Clear entities
        this.engine.entities = [];
        
        // Reset systems
        this.engine.getSystem('waves').reset();
        this.engine.getSystem('particles').clear();
        
        // Hide game over
        document.getElementById('gameOver').style.display = 'none';
        
        // Reset to playing
        this.engine.setState('PLAYING');
        this.updateUI();
    }
    
    pause() {
        this.engine.pause();
    }
}

export { GameManager };