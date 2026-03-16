/**
 * WaveSystem.js - Manages enemy spawning and wave progression
 * Supports infinite waves with scaling difficulty
 */

class WaveSystem {
    constructor() {
        this.wave = 1;
        this.waveActive = false;
        this.enemiesSpawned = 0;
        this.totalEnemies = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 1000;
        this.waveData = null;
        
        // Base wave definitions (first 8 handcrafted)
        this.baseWaves = [
            { name: 'The Paper Hands', desc: 'Weak enemies that panic easily', count: 10, interval: 1500, health: 30, speed: 1.5, reward: 15, color: '#ff9999', emoji: '📄' },
            { name: 'FOMO Traders', desc: 'Swarm in groups', count: 15, interval: 800, health: 25, speed: 2, reward: 12, color: '#ffcc99', emoji: '🚀' },
            { name: 'The Whales', desc: 'Slow but tanky', count: 5, interval: 2500, health: 150, speed: 0.7, reward: 50, color: '#99ccff', emoji: '🐋' },
            { name: 'Market Makers', desc: 'Mess with your towers', count: 8, interval: 1200, health: 60, speed: 1.2, reward: 25, color: '#cc99ff', emoji: '🏦' },
            { name: 'Flash Crash', desc: 'Flying enemies!', count: 12, interval: 600, health: 20, speed: 3, reward: 20, color: '#ff6666', emoji: '⚡', flying: true },
            { name: 'The Bulls', desc: 'Aggressive bull market', count: 20, interval: 500, health: 40, speed: 2.5, reward: 18, color: '#00ff00', emoji: '🐂' },
            { name: 'The Bears', desc: 'Crushing bear market', count: 18, interval: 700, health: 80, speed: 1.8, reward: 30, color: '#ff0000', emoji: '🐻' },
            { name: 'MOASS', desc: 'The final wave', count: 30, interval: 400, health: 100, speed: 2, reward: 25, color: '#ffd700', emoji: '🌙' }
        ];
        
        // Scaling factors for infinite waves
        this.scaling = {
            healthGrowth: 1.15,    // 15% more HP per wave after 8
            speedGrowth: 1.02,     // 2% faster per wave
            countGrowth: 1.1,      // 10% more enemies
            rewardGrowth: 1.05,    // 5% more reward
            intervalDecay: 0.98    // Spawn faster
        };
    }
    
    init(engine) {
        this.engine = engine;
        this.difficulty = engine.difficulty;
        this.diffConfig = this.getDifficultyConfig();
    }
    
    getDifficultyConfig() {
        const configs = {
            easy: { healthMult: 0.7, speedMult: 0.8, rewardMult: 1.3 },
            medium: { healthMult: 1.0, speedMult: 1.0, rewardMult: 1.0 },
            hard: { healthMult: 1.4, speedMult: 1.2, rewardMult: 0.8 }
        };
        return configs[this.difficulty] || configs.medium;
    }
    
    generateWaveData(waveNum) {
        // Use base waves for first 8
        if (waveNum <= this.baseWaves.length) {
            return this.baseWaves[waveNum - 1];
        }
        
        // Generate procedural waves after 8
        const baseWave = this.baseWaves[(waveNum - 1) % this.baseWaves.length];
        const cycles = Math.floor((waveNum - 1) / this.baseWaves.length);
        
        // Apply scaling
        const scale = Math.pow;
        const healthMult = scale(this.scaling.healthGrowth, cycles);
        const speedMult = scale(this.scaling.speedGrowth, cycles);
        const countMult = scale(this.scaling.countGrowth, cycles);
        const rewardMult = scale(this.scaling.rewardGrowth, cycles);
        const intervalMult = scale(this.scaling.intervalDecay, cycles);
        
        // Special waves every 10
        const isBossWave = waveNum % 10 === 0;
        const isEliteWave = waveNum % 5 === 0 && !isBossWave;
        
        let name = `Wave ${waveNum}`;
        let desc = 'Procedurally generated';
        let emoji = '👾';
        
        if (isBossWave) {
            name = `BOSS WAVE ${waveNum}`;
            desc = 'EXTREME DIFFICULTY';
            emoji = '👹';
        } else if (isEliteWave) {
            name = `Elite Wave ${waveNum}`;
            desc = 'Stronger enemies';
            emoji: '💀';
        }
        
        return {
            name,
            desc,
            count: Math.floor(baseWave.count * countMult * (isBossWave ? 0.5 : 1)),
            interval: Math.max(200, baseWave.interval * intervalMult),
            health: Math.floor(baseWave.health * healthMult * (isEliteWave ? 1.5 : 1) * (isBossWave ? 3 : 1)),
            speed: baseWave.speed * speedMult * (isBossWave ? 0.8 : 1),
            reward: Math.floor(baseWave.reward * rewardMult * (isBossWave ? 5 : 1)),
            color: baseWave.color,
            emoji,
            flying: baseWave.flying || (waveNum > 20 && Math.random() > 0.7),
            isBoss: isBossWave,
            isElite: isEliteWave
        };
    }
    
    startWave() {
        if (this.waveActive) return;
        
        this.waveData = this.generateWaveData(this.wave);
        this.waveActive = true;
        this.enemiesSpawned = 0;
        this.totalEnemies = this.waveData.count;
        this.spawnTimer = 0;
        this.spawnInterval = this.waveData.interval;
        
        // Apply difficulty multipliers
        this.waveData.health = Math.floor(this.waveData.health * this.diffConfig.healthMult);
        this.waveData.speed = this.waveData.speed * this.diffConfig.speedMult;
        this.waveData.reward = Math.floor(this.waveData.reward * this.diffConfig.rewardMult);
        
        this.engine.events.emit('waveStart', { 
            wave: this.wave, 
            waveData: this.waveData 
        });
    }
    
    update(dt) {
        if (!this.waveActive || !this.waveData) return;
        
        this.spawnTimer += dt;
        
        // Spawn enemies
        if (this.spawnTimer >= this.spawnInterval && this.enemiesSpawned < this.totalEnemies) {
            this.spawnEnemy();
            this.spawnTimer = 0;
            this.enemiesSpawned++;
        }
        
        // Check wave completion
        const enemiesRemaining = this.engine.entities.filter(e => 
            e.type === 'enemy' && !e.markedForDeletion
        ).length;
        
        if (this.enemiesSpawned >= this.totalEnemies && enemiesRemaining === 0) {
            this.completeWave();
        }
    }
    
    spawnEnemy() {
        this.engine.events.emit('spawnEnemy', { waveData: this.waveData });
    }
    
    completeWave() {
        this.waveActive = false;
        
        // Wave completion bonus
        const bonus = 100 + (this.wave * 10);
        this.engine.events.emit('waveComplete', { 
            wave: this.wave, 
            bonus,
            nextWave: this.wave + 1
        });
        
        this.wave++;
    }
    
    getProgress() {
        if (!this.waveActive || !this.waveData) return 0;
        return this.enemiesSpawned / this.totalEnemies;
    }
    
    reset() {
        this.wave = 1;
        this.waveActive = false;
        this.enemiesSpawned = 0;
        this.waveData = null;
    }
}

export { WaveSystem };