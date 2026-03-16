// Bulls vs Bears TD - Enhanced Edition
// Bundled version for GitHub Pages compatibility

// ============================================
// CORE: GameEngine & EventBus
// ============================================

class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
    }
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        for (const cb of this.listeners.get(event)) cb(data);
    }
}

class GameEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.lastTime = 0;
        this.accumulator = 0;
        this.timeStep = 1000 / 60;
        this.state = 'PLAYING';
        this.systems = new Map();
        this.entities = [];
        this.events = new EventBus();
        this.loop = this.loop.bind(this);
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
    getSystem(name) { return this.systems.get(name); }
    start() {
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }
    loop(currentTime) {
        const dt = Math.min(currentTime - this.lastTime, 100);
        this.lastTime = currentTime;
        this.accumulator += dt;
        while (this.accumulator >= this.timeStep) {
            this.update(this.timeStep);
            this.accumulator -= this.timeStep;
        }
        this.render(this.accumulator / this.timeStep);
        requestAnimationFrame(this.loop);
    }
    update(dt) {
        if (this.state !== 'PLAYING') return;
        for (const [, system] of this.systems) system.update(dt);
        for (let i = this.entities.length - 1; i >= 0; i--) {
            this.entities[i].update(dt);
            if (this.entities[i].markedForDeletion) this.entities.splice(i, 1);
        }
    }
    render(alpha) {
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (const [, system] of this.systems) {
            if (system.render) system.render(this.ctx, alpha);
        }
        for (const entity of this.entities) entity.render(this.ctx, alpha);
    }
    addEntity(entity) {
        entity.engine = this;
        this.entities.push(entity);
        return entity;
    }
    pause() {
        this.state = this.state === 'PLAYING' ? 'PAUSED' : 'PLAYING';
    }
}

// ============================================
// SYSTEMS: PathSystem with Dynamic Paths
// ============================================

class PathSystem {
    constructor() {
        this.currentPath = [];
        this.currentPathName = 'beginner';
        this.paths = {
            beginner: [{x:0,y:0.25},{x:0.25,y:0.25},{x:0.25,y:0.75},{x:0.5,y:0.75},{x:0.5,y:0.375},{x:0.75,y:0.375},{x:0.75,y:0.875},{x:1,y:0.875}],
            intermediate: [{x:0,y:0.5},{x:0.2,y:0.5},{x:0.3,y:0.2},{x:0.4,y:0.2},{x:0.5,y:0.5},{x:0.6,y:0.8},{x:0.7,y:0.8},{x:0.8,y:0.5},{x:0.9,y:0.5},{x:1,y:0.5}],
            advanced: [{x:0,y:0.2},{x:0.3,y:0.2},{x:0.3,y:0.4},{x:0.7,y:0.4},{x:0.7,y:0.2},{x:1,y:0.2}],
            nightmare: [{x:0.5,y:0.5},{x:0.5,y:0.3},{x:0.7,y:0.3},{x:0.7,y:0.7},{x:0.3,y:0.7},{x:0.3,y:0.2},{x:0.8,y:0.2},{x:0.8,y:0.8},{x:0.2,y:0.8},{x:0.2,y:0.5},{x:1,y:0.5}]
        };
    }
    init(engine) {
        this.engine = engine;
        this.canvas = engine.canvas;
        engine.events.on('waveComplete', ({wave}) => this.updatePathForWave(wave+1));
        engine.events.on('resize', () => this.recalculatePath());
        this.recalculatePath();
    }
    recalculatePath() {
        const w = this.canvas.width, h = this.canvas.height;
        this.currentPath = this.paths[this.currentPathName].map(p => ({x:p.x*w, y:p.y*h}));
    }
    updatePathForWave(wave) {
        let newPath = this.currentPathName;
        if (wave > 24) newPath = 'nightmare';
        else if (wave > 16) newPath = 'advanced';
        else if (wave > 8) newPath = 'intermediate';
        else newPath = 'beginner';
        
        if (newPath !== this.currentPathName) {
            this.currentPathName = newPath;
            this.recalculatePath();
            this.engine.events.emit('pathChanged', {pathName:newPath});
        }
    }
    render(ctx) {
        ctx.save();
        ctx.shadowColor = 'rgba(233,69,96,0.3)'; ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(233,69,96,0.08)'; ctx.lineWidth = 40;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        this.drawPath(ctx);
        ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(233,69,96,0.15)'; ctx.lineWidth = 20;
        this.drawPath(ctx);
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(233,69,96,0.4)'; ctx.lineWidth = 4;
        ctx.setLineDash([10,10]); this.drawPath(ctx); ctx.setLineDash([]);
        for (let i=0; i<this.currentPath.length; i++) {
            const p=this.currentPath[i];
            ctx.beginPath(); ctx.arc(p.x,p.y,i===0||i===this.currentPath.length-1?8:4,0,Math.PI*2);
            ctx.fillStyle=i===0?'#0f0':i===this.currentPath.length-1?'#f00':'#e94560'; ctx.fill();
        }
        ctx.restore();
    }
    drawPath(ctx) {
        if (this.currentPath.length<2) return;
        ctx.beginPath(); ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        for (let i=1; i<this.currentPath.length; i++) ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
        ctx.stroke();
    }
    update() {}
}

// ============================================
// SYSTEMS: ParticleSystem
// ============================================

class ParticleSystem {
    constructor() {
        this.particles = []; this.pool = []; this.maxParticles = 500;
        this.presets = {
            explosion: {count:20, speed:{min:2,max:6}, life:{min:30,max:60}, size:{min:2,max:6}, colors:['#ff6b6b','#feca57','#ff9ff3','#54a0ff'], gravity:0.1, fade:true},
            hit: {count:8, speed:{min:1,max:3}, life:{min:15,max:30}, size:{min:1,max:3}, colors:['#fff','#fcc'], gravity:0, fade:true},
            towerBuild: {count:30, speed:{min:1,max:4}, life:{min:40,max:80}, size:{min:2,max:5}, colors:['#0f0','#0c0','#9f9'], gravity:-0.05, fade:true}
        };
    }
    init(engine) {
        this.engine = engine;
        engine.events.on('enemyDeath', ({x,y,color}) => this.spawn('explosion',x,y,color));
        engine.events.on('towerBuilt', ({x,y}) => this.spawn('towerBuild',x,y));
    }
    spawn(presetName, x, y, overrideColor) {
        const preset = this.presets[presetName]; if (!preset) return;
        for (let i=0; i<preset.count; i++) {
            let p = this.pool.pop() || {};
            p.x=x; p.y=y; p.vx=(Math.random()-0.5)*(preset.speed.max-preset.speed.min)+preset.speed.min;
            p.vy=(Math.random()-0.5)*(preset.speed.max-preset.speed.min)+preset.speed.min;
            p.life=Math.random()*(preset.life.max-preset.life.min)+preset.life.min; p.maxLife=p.life;
            p.size=Math.random()*(preset.size.max-preset.size.min)+preset.size.min;
            p.color=overrideColor||preset.colors[Math.floor(Math.random()*preset.colors.length)];
            p.gravity=preset.gravity; p.fade=preset.fade; this.particles.push(p);
        }
        if (this.particles.length>this.maxParticles) this.pool.push(...this.particles.splice(0,this.particles.length-this.maxParticles));
    }
    update(dt) {
        for (let i=this.particles.length-1; i>=0; i--) {
            const p=this.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=p.gravity; p.life-=dt/16;
            if (p.life<=0) this.pool.push(this.particles.splice(i,1)[0]);
        }
    }
    render(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.fade ? p.life/p.maxLife : 1;
            ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(p.life/p.maxLife),0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    }
    clear() { this.pool.push(...this.particles); this.particles=[]; }
}

// ============================================
// SYSTEMS: WaveSystem with Infinite Scaling
// ============================================

class WaveSystem {
    constructor() {
        this.wave=1; this.waveActive=false; this.enemiesSpawned=0; this.spawnTimer=0;
        this.baseWaves=[
            {name:'The Paper Hands',desc:'Weak enemies',count:10,interval:1500,health:30,speed:1.5,reward:15,color:'#ff9999',emoji:'📄'},
            {name:'FOMO Traders',desc:'Swarm groups',count:15,interval:800,health:25,speed:2,reward:12,color:'#ffcc99',emoji:'🚀'},
            {name:'The Whales',desc:'Slow & tanky',count:5,interval:2500,health:150,speed:0.7,reward:50,color:'#99ccff',emoji:'🐋'},
            {name:'Market Makers',desc:'Fast & tricky',count:8,interval:1200,health:60,speed:1.2,reward:25,color:'#cc99ff',emoji:'🏦'},
            {name:'Flash Crash',desc:'Flying!',count:12,interval:600,health:20,speed:3,reward:20,color:'#ff6666',emoji:'⚡',flying:true},
            {name:'The Bulls',desc:'Aggressive',count:20,interval:500,health:40,speed:2.5,reward:18,color:'#0f0',emoji:'🐂'},
            {name:'The Bears',desc:'Crushing',count:18,interval:700,health:80,speed:1.8,reward:30,color:'#f00',emoji:'🐻'},
            {name:'MOASS',desc:'FINAL WAVE',count:30,interval:400,health:100,speed:2,reward:25,color:'#ffd700',emoji:'🌙'}
        ];
    }
    init(engine) {
        this.engine=engine; this.diffConfig={healthMult:1,speedMult:1,rewardMult:1};
    }
    generateWaveData(waveNum) {
        if (waveNum<=this.baseWaves.length) return this.baseWaves[waveNum-1];
        const base=this.baseWaves[(waveNum-1)%this.baseWaves.length];
        const cycles=Math.floor((waveNum-1)/this.baseWaves.length);
        const isBoss=waveNum%10===0, isElite=waveNum%5===0&&!isBoss;
        return {
            name:isBoss?`BOSS WAVE ${waveNum}`:isElite?`Elite Wave ${waveNum}`:`Wave ${waveNum}`,
            desc:isBoss?'EXTREME DIFFICULTY':'Procedural',
            count:Math.floor(base.count*Math.pow(1.1,cycles)*(isBoss?0.5:1)),
            interval:Math.max(200,base.interval*Math.pow(0.98,cycles)),
            health:Math.floor(base.health*Math.pow(1.15,cycles)*(isElite?1.5:1)*(isBoss?3:1)),
            speed:base.speed*Math.pow(1.02,cycles)*(isBoss?0.8:1),
            reward:Math.floor(base.reward*Math.pow(1.05,cycles)*(isBoss?5:1)),
            color:base.color, emoji:isBoss?'👹':isElite?'💀':base.emoji,
            flying:base.flying||(waveNum>20&&Math.random()>0.7), isBoss, isElite
        };
    }
    startWave() {
        if (this.waveActive) return;
        this.waveData=this.generateWaveData(this.wave);
        this.waveData.health=Math.floor(this.waveData.health*this.diffConfig.healthMult);
        this.waveData.speed*=this.diffConfig.speedMult;
        this.waveData.reward=Math.floor(this.waveData.reward*this.diffConfig.rewardMult);
        this.waveActive=true; this.enemiesSpawned=0; this.totalEnemies=this.waveData.count; this.spawnTimer=0;
        this.engine.events.emit('waveStart',{wave:this.wave,waveData:this.waveData});
    }
    update(dt) {
        if (!this.waveActive) return;
        this.spawnTimer+=dt;
        if (this.spawnTimer>=this.waveData.interval&&this.enemiesSpawned<this.totalEnemies) {
            this.engine.events.emit('spawnEnemy',{waveData:this.waveData}); this.spawnTimer=0; this.enemiesSpawned++;
        }
        const remaining=this.engine.entities.filter(e=>e.type==='enemy'&&!e.markedForDeletion).length;
        if (this.enemiesSpawned>=this.totalEnemies&&remaining===0) {
            this.waveActive=false; this.engine.events.emit('waveComplete',{wave:this.wave,bonus:100+this.wave*10}); this.wave++;
        }
    }
    reset() { this.wave=1; this.waveActive=false; this.enemiesSpawned=0; }
}

// ============================================
// ENTITIES: Enemy, Tower, Projectile
// ============================================

class Entity {
    constructor(x,y) { this.x=x; this.y=y; this.vx=0; this.vy=0; this.type='entity'; this.markedForDeletion=false; this.engine=null; }
    update(dt) { this.x+=this.vx; this.y+=this.vy; }
    render(ctx) {}
    destroy() { this.markedForDeletion=true; }
}

class Enemy extends Entity {
    constructor(waveData, path) {
        super(path[0].x, path[0].y);
        this.type='enemy'; this.waveData=waveData; this.flying=waveData.flying||false;
        this.health=waveData.health; this.maxHealth=waveData.health; this.speed=waveData.speed;
        this.reward=waveData.reward; this.path=path; this.pathIndex=0; this.slowTimer=0; this.slowFactor=1;
    }
    update(dt) {
        if (this.slowTimer>0) { this.slowTimer-=dt; } else { this.slowFactor=1; }
        if (this.pathIndex>=this.path.length-1) return;
        const target=this.path[this.pathIndex+1], dx=target.x-this.x, dy=target.y-this.y, dist=Math.hypot(dx,dy);
        const moveSpeed=this.speed*this.slowFactor*(dt/16);
        if (dist<moveSpeed) {
            this.pathIndex++;
            if (this.pathIndex>=this.path.length-1) { this.engine.events.emit('playerDamage',{damage:1}); this.destroy(); }
        } else { this.x+=(dx/dist)*moveSpeed; this.y+=(dy/dist)*moveSpeed; }
    }
    render(ctx) {
        // Health bar
        const barW=30, barH=4; ctx.fillStyle='#333'; ctx.fillRect(this.x-barW/2,this.y-25,barW,barH);
        ctx.fillStyle=this.health>this.maxHealth*0.5?'#0f0':this.health>this.maxHealth*0.25?'#ff0':'#f00';
        ctx.fillRect(this.x-barW/2,this.y-25,barW*(this.health/this.maxHealth),barH);
        // Body
        ctx.fillStyle=this.waveData.color;
        if (this.flying) {
            ctx.beginPath(); ctx.moveTo(this.x,this.y-15); ctx.lineTo(this.x-12,this.y+10); ctx.lineTo(this.x+12,this.y+10); ctx.closePath(); ctx.fill();
        } else { ctx.beginPath(); ctx.arc(this.x,this.y,12,0,Math.PI*2); ctx.fill(); }
        // Emoji
        ctx.fillStyle='#fff'; ctx.font='14px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.waveData.emoji,this.x,this.y);
    }
    takeDamage(dmg, type) {
        if (type==='execute'&&this.health>50) dmg=this.health;
        if (type==='slow') { this.slowFactor=0.5; this.slowTimer=2000; }
        this.health-=dmg;
        if (this.health<=0) { this.engine.events.emit('cashEarned',{amount:this.reward,x:this.x,y:this.y}); this.engine.events.emit('enemyDeath',{x:this.x,y:this.y,color:this.waveData.color}); this.destroy(); }
    }
}

const TowerTypes = {
    EWO: {name:'EWO',cost:100,damage:15,range:120,fireRate:1000,color:'#0f0',emoji:'📊',splash:true,splashRadius:50,splashDamage:0.5},
    Scalper: {name:'Scalper',cost:150,damage:8,range:100,fireRate:200,color:'#ff0',emoji:'⚡'},
    CC: {name:'CC',cost:200,damage:12,range:130,fireRate:800,color:'#f0f',emoji:'💵',income:5},
    VWAP: {name:'VWAP',cost:250,damage:5,range:140,fireRate:500,color:'#0ff',emoji:'🎯',slow:true},
    StopLoss: {name:'StopLoss',cost:300,damage:100,range:150,fireRate:2000,color:'#f00',emoji:'🛑',execute:true}
};

class Tower extends Entity {
    constructor(x,y,type,stats) {
        super(x,y); this.type='tower'; this.towerType=type; this.stats=stats; this.lastFire=0; this.target=null; this.angle=0;
    }
    update(dt) {
        // Find target
        this.target=null; let minDist=Infinity;
        for (const e of this.engine.entities) {
            if (e.type!=='enemy') continue;
            const dist=Math.hypot(e.x-this.x,e.y-this.y);
            if (dist<=this.stats.range&&dist<minDist) { minDist=dist; this.target=e; }
        }
        if (this.target) {
            this.angle=Math.atan2(this.target.y-this.y,this.target.x-this.x);
            this.lastFire+=dt;
            if (this.lastFire>=this.stats.fireRate) { this.fire(); this.lastFire=0; }
        }
    }
    fire() {
        if (!this.target) return;
        this.engine.events.emit('spawnProjectile',{x:this.x,y:this.y,target:this.target,towerType:this.towerType,stats:this.stats});
        if (this.stats.income) this.engine.events.emit('cashEarned',{amount:this.stats.income,x:this.x,y:this.y-30});
    }
    hexToRgba(hex,alpha) {
        let r,g,b;
        if (hex.length===4) { r=parseInt(hex[1]+hex[1],16); g=parseInt(hex[2]+hex[2],16); b=parseInt(hex[3]+hex[3],16); }
        else { r=parseInt(hex.slice(1,3),16); g=parseInt(hex.slice(3,5),16); b=parseInt(hex.slice(5,7),16); }
        return `rgba(${r},${g},${b},${alpha})`;
    }
    render(ctx) {
        // Range
        ctx.beginPath(); ctx.arc(this.x,this.y,this.stats.range,0,Math.PI*2); ctx.fillStyle=this.hexToRgba(this.stats.color,0.02); ctx.fill(); ctx.strokeStyle=this.hexToRgba(this.stats.color,0.08); ctx.lineWidth=1; ctx.stroke();
        // Base
        ctx.fillStyle='#333'; ctx.fillRect(this.x-16,this.y-16,32,32);
        // Body
        ctx.fillStyle=this.stats.color; ctx.beginPath(); ctx.arc(this.x,this.y,15,0,Math.PI*2); ctx.fill();
        // Barrel
        ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.angle); ctx.strokeStyle='#fff'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(20,0); ctx.stroke(); ctx.restore();
        // Icon
        ctx.fillStyle='#fff'; ctx.font='16px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.stats.emoji,this.x,this.y);
    }
}

class Projectile extends Entity {
    constructor(x,y,target,towerType,stats) { super(x,y); this.type='projectile'; this.target=target; this.towerType=towerType; this.stats=stats; this.speed=8; }
    update(dt) {
        if (!this.target||this.target.markedForDeletion) { this.destroy(); return; }
        const dx=this.target.x-this.x, dy=this.target.y-this.y, dist=Math.hypot(dx,dy);
        const moveSpeed=this.speed*(dt/16);
        if (dist<moveSpeed) {
            let dmgType='normal'; if (this.stats.execute) dmgType='execute'; if (this.stats.slow) dmgType='slow';
            this.target.takeDamage(this.stats.damage,dmgType);
            if (this.stats.splash) {
                for (const e of this.engine.entities) {
                    if (e.type==='enemy'&&e!==this.target&&Math.hypot(e.x-this.x,e.y-this.y)<=50) e.takeDamage(this.stats.damage*0.5,'splash');
                }
            }
            this.destroy();
        } else { this.x+=(dx/dist)*moveSpeed; this.y+=(dy/dist)*moveSpeed; }
    }
    render(ctx) {
        ctx.fillStyle=this.stats.color; ctx.shadowColor=this.stats.color; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(this.x,this.y,4,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    }
}

// ============================================
// GAME MANAGER
// ============================================

class GameManager {
    constructor() {
        this.engine=null;
        this.gameState={cash:500,health:20,maxHealth:20,selectedTower:null,wave:1};
        this.diffSettings={easy:{startCash:600,startHealth:25},medium:{startCash:500,startHealth:20},hard:{startCash:400,startHealth:15}};
    }
    init(canvasId,difficulty) {
        this.engine=new GameEngine(canvasId); this.engine.difficulty=difficulty;
        const s=this.diffSettings[difficulty];
        this.gameState.cash=s.startCash; this.gameState.health=s.startHealth; this.gameState.maxHealth=s.startHealth;
        this.engine.registerSystem('paths',new PathSystem());
        this.engine.registerSystem('particles',new ParticleSystem());
        this.engine.registerSystem('waves',new WaveSystem());
        this.setupEvents();
        this.engine.start(); this.updateUI();
    }
    setupEvents() {
        this.engine.events.on('spawnEnemy',({waveData})=>{
            const path=this.engine.getSystem('paths').currentPath;
            this.engine.addEntity(new Enemy(waveData,path));
        });
        this.engine.events.on('spawnProjectile',({x,y,target,towerType,stats})=>{
            this.engine.addEntity(new Projectile(x,y,target,towerType,stats));
        });
        this.engine.events.on('cashEarned',({amount})=>{this.gameState.cash+=amount; this.updateUI();});
        this.engine.events.on('playerDamage',({damage})=>{
            this.gameState.health-=damage; this.updateUI(); this.shakeScreen();
            if (this.gameState.health<=0) this.gameOver();
        });
        this.engine.events.on('waveStart',({wave,waveData})=>{this.updateWaveDisplay(waveData);});
        this.engine.events.on('waveComplete',({wave,bonus})=>{this.gameState.cash+=bonus; this.gameState.wave=wave+1; this.updateUI(); document.getElementById('startWaveBtn').disabled=false;});
        this.engine.events.on('pathChanged',({pathName})=>{console.log('Path changed to:',pathName);});
        this.engine.canvas.addEventListener('click',(e)=>this.handleClick(e));
        this.engine.canvas.addEventListener('contextmenu',(e)=>{e.preventDefault(); this.handleRightClick(e);});
    }
    handleClick(e) {
        if (!this.gameState.selectedTower) return;
        const rect=this.engine.canvas.getBoundingClientRect();
        const x=e.clientX-rect.left, y=e.clientY-rect.top;
        if (this.isValidPlacement(x,y)) this.placeTower(x,y,this.gameState.selectedTower);
    }
    isValidPlacement(x,y) {
        const path=this.engine.getSystem('paths').currentPath;
        for (let i=0; i<path.length-1; i++) {
            const p1=path[i], p2=path[i+1];
            const A=x-p1.x, B=y-p1.y, C=p2.x-p1.x, D=p2.y-p1.y;
            const dot=A*C+B*D, lenSq=C*C+D*D;
            let param=lenSq!==0?dot/lenSq:-1;
            let xx,yy;
            if (param<0) {xx=p1.x; yy=p1.y;} else if (param>1) {xx=p2.x; yy=p2.y;} else {xx=p1.x+param*C; yy=p1.y+param*D;}
            if (Math.hypot(x-xx,y-yy)<40) return false;
        }
        for (const e of this.engine.entities) if (e.type==='tower'&&Math.hypot(e.x-x,e.y-y)<35) return false;
        return true;
    }
    placeTower(x,y,towerType) {
        const stats=TowerTypes[towerType];
        if (this.gameState.cash>=stats.cost) {
            this.gameState.cash-=stats.cost;
            this.engine.addEntity(new Tower(x,y,towerType,stats));
            this.engine.getSystem('particles').spawn('towerBuild',x,y);
            this.updateUI();
        }
    }
    handleRightClick(e) {
        const rect=this.engine.canvas.getBoundingClientRect();
        const x=e.clientX-rect.left, y=e.clientY-rect.top;
        for (let i=this.engine.entities.length-1; i>=0; i--) {
            const entity=this.engine.entities[i];
            if (entity.type==='tower'&&Math.hypot(entity.x-x,entity.y-y)<25) {
                const sellPrice=Math.floor(TowerTypes[entity.towerType].cost*0.5);
                this.gameState.cash+=sellPrice;
                this.engine.getSystem('particles').spawn('cash',entity.x,entity.y);
                entity.destroy();
                this.updateUI();
                return;
            }
        }
    }
    selectTower(type) { this.gameState.selectedTower=this.gameState.selectedTower===type?null:type; this.updateUI(); }
    startWave() {
        const wave=this.gameState.wave;
        const wavesystem=this.engine.getSystem('waves');
        if ([6,7,14,15,22,23].includes(wave)) {
            const warnings={6:'💰 MARKET SHIFT INCOMING - Spend Wisely!',7:'🚨 NEW ROUTE NEXT WAVE!',14:'💰 DIVERSIFY YOUR DEFENSES!',15:'🚨 PATH CHANGE IMMINENT!',22:'💰 PORTFOLIO REBALANCE TIME!',23:'🚨 THE MARKET IS EVOLVING!'};
            const msg=warnings[wave]||'💰 Position for the next market shift!';
            this.showWarning(msg);
        }
        wavesystem.startWave();
        document.getElementById('startWaveBtn').disabled=true;
    }
    showWarning(msg) {
        const warning=document.createElement('div');
        warning.textContent=msg;
        warning.style.cssText='position:fixed;top:100px;left:50%;transform:translateX(-50%);background:rgba(233,69,96,0.95);color:#fff;padding:15px 30px;border-radius:10px;font-weight:bold;z-index:1000;animation:slideDown 0.5s ease;';
        document.body.appendChild(warning);
        setTimeout(()=>{warning.style.animation='fadeOut 0.5s ease'; setTimeout(()=>warning.remove(),500);},3000);
    }
    shakeScreen() {
        const c=this.engine.canvas; c.style.transform='translate(5px,5px)';
        setTimeout(()=>{c.style.transform='translate(-5px,-5px)'; setTimeout(()=>c.style.transform='translate(0,0)',50);},50);
    }
    updateUI() {
        document.getElementById('cash').textContent='$'+this.gameState.cash;
        document.getElementById('health').textContent=this.gameState.health+'/'+this.gameState.maxHealth;
        document.getElementById('wave').textContent=this.gameState.wave;
        document.getElementById('healthBar').style.width=((this.gameState.health/this.gameState.maxHealth)*100)+'%';
        document.querySelectorAll('.tower-card').forEach(card=>card.classList.remove('selected'));
        if (this.gameState.selectedTower) document.getElementById('tower'+this.gameState.selectedTower)?.classList.add('selected');
    }
    updateWaveDisplay(waveData) {
        document.getElementById('waveTitle').textContent='Wave '+this.gameState.wave+': '+waveData.name;
        document.getElementById('waveDesc').textContent=waveData.desc;
    }
    gameOver() {
        this.engine.state='GAME_OVER';
        document.getElementById('gameOver').style.display='block';
        document.getElementById('finalWave').textContent=this.gameState.wave;
    }
    reset() {
        const s=this.diffSettings[this.engine.difficulty];
        this.gameState.cash=s.startCash; this.gameState.health=s.startHealth; this.gameState.wave=1; this.gameState.selectedTower=null;
        this.engine.entities=[];
        this.engine.getSystem('waves').reset();
        this.engine.getSystem('particles').clear();
        document.getElementById('gameOver').style.display='none';
        this.engine.state='PLAYING';
        this.updateUI();
    }
    pause() { this.engine.pause(); }
}

// Export for global access
window.GameManager = GameManager;
window.TowerTypes = TowerTypes;
