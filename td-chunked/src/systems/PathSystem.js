/**
 * PathSystem.js - Manages multiple paths and waypoints
 * Supports dynamic path switching based on wave number
 */

class PathSystem {
    constructor() {
        this.currentPath = [];
        this.waypoints = [];
        this.progress = 0;
        
        // Define multiple paths for different difficulty phases
        this.paths = {
            // Phase 1: Simple S-curve (Waves 1-8)
            beginner: [
                { x: 0, y: 0.25 },      // Start left, 25% down
                { x: 0.25, y: 0.25 },   // Right
                { x: 0.25, y: 0.75 },   // Down
                { x: 0.5, y: 0.75 },    // Right
                { x: 0.5, y: 0.375 },   // Up
                { x: 0.75, y: 0.375 },  // Right
                { x: 0.75, y: 0.875 },  // Down
                { x: 1.0, y: 0.875 }    // End right
            ],
            
            // Phase 2: Figure-8 with loop (Waves 9-16)
            intermediate: [
                { x: 0, y: 0.5 },
                { x: 0.2, y: 0.5 },
                { x: 0.3, y: 0.2 },     // Up
                { x: 0.4, y: 0.2 },
                { x: 0.5, y: 0.5 },     // Center
                { x: 0.6, y: 0.8 },     // Down
                { x: 0.7, y: 0.8 },
                { x: 0.8, y: 0.5 },     // Back to center
                { x: 0.9, y: 0.5 },
                { x: 1.0, y: 0.5 }
            ],
            
            // Phase 3: Double lane (Waves 17-24)
            advanced: [
                // Top lane
                { x: 0, y: 0.2 },
                { x: 0.3, y: 0.2 },
                { x: 0.3, y: 0.4 },
                { x: 0.7, y: 0.4 },
                { x: 0.7, y: 0.2 },
                { x: 1.0, y: 0.2 }
            ],
            
            // Phase 4: Spiral from center (Waves 25+)
            nightmare: [
                { x: 0.5, y: 0.5 },     // Start center
                { x: 0.5, y: 0.3 },     // Up
                { x: 0.7, y: 0.3 },     // Right
                { x: 0.7, y: 0.7 },     // Down
                { x: 0.3, y: 0.7 },     // Left
                { x: 0.3, y: 0.2 },     // Up
                { x: 0.8, y: 0.2 },     // Right
                { x: 0.8, y: 0.8 },     // Down
                { x: 0.2, y: 0.8 },     // Left
                { x: 0.2, y: 0.5 },     // To center
                { x: 1.0, y: 0.5 }      // Exit right
            ]
        };
        
        this.currentPathName = 'beginner';
    }
    
    init(engine) {
        this.engine = engine;
        this.canvas = engine.canvas;
        
        // Listen for wave changes
        engine.events.on('waveComplete', ({ wave }) => {
            this.updatePathForWave(wave + 1);
        });
        
        engine.events.on('resize', () => this.recalculatePath());
        
        this.recalculatePath();
    }
    
    recalculatePath() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        // Convert normalized coordinates to pixels
        const normalizedPath = this.paths[this.currentPathName];
        this.currentPath = normalizedPath.map(p => ({
            x: p.x * w,
            y: p.y * h
        }));
        
        // Calculate path length for progress tracking
        this.pathLength = this.calculatePathLength();
    }
    
    calculatePathLength() {
        let length = 0;
        for (let i = 1; i < this.currentPath.length; i++) {
            const dx = this.currentPath[i].x - this.currentPath[i-1].x;
            const dy = this.currentPath[i].y - this.currentPath[i-1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    }
    
    updatePathForWave(wave) {
        let newPath = this.currentPathName;
        
        if (wave > 24) {
            newPath = 'nightmare';
        } else if (wave > 16) {
            newPath = 'advanced';
        } else if (wave > 8) {
            newPath = 'intermediate';
        } else {
            newPath = 'beginner';
        }
        
        if (newPath !== this.currentPathName) {
            this.currentPathName = newPath;
            this.recalculatePath();
            this.engine.events.emit('pathChanged', { 
                pathName: newPath, 
                path: this.currentPath 
            });
        }
    }
    
    getPositionAtDistance(distance) {
        // Find position along path at given distance
        let currentDist = 0;
        
        for (let i = 1; i < this.currentPath.length; i++) {
            const p1 = this.currentPath[i-1];
            const p2 = this.currentPath[i];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            
            if (currentDist + segmentLength >= distance) {
                // Interpolate within this segment
                const t = (distance - currentDist) / segmentLength;
                return {
                    x: p1.x + dx * t,
                    y: p1.y + dy * t,
                    angle: Math.atan2(dy, dx)
                };
            }
            
            currentDist += segmentLength;
        }
        
        // At end of path
        const last = this.currentPath[this.currentPath.length - 1];
        return { x: last.x, y: last.y, angle: 0, atEnd: true };
    }
    
    getNextWaypointIndex(currentIndex) {
        return Math.min(currentIndex + 1, this.currentPath.length - 1);
    }
    
    render(ctx) {
        // Draw path with glow effect
        ctx.save();
        
        // Outer glow
        ctx.shadowColor = 'rgba(233, 69, 96, 0.3)';
        ctx.shadowBlur = 20;
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.2)';
        ctx.lineWidth = 40;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.drawPathLine(ctx);
        
        // Main path
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.4)';
        ctx.lineWidth = 20;
        this.drawPathLine(ctx);
        
        // Center line
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        this.drawPathLine(ctx);
        ctx.setLineDash([]);
        
        // Waypoint markers
        for (let i = 0; i < this.currentPath.length; i++) {
            const p = this.currentPath[i];
            const isStart = i === 0;
            const isEnd = i === this.currentPath.length - 1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, isStart || isEnd ? 8 : 4, 0, Math.PI * 2);
            ctx.fillStyle = isStart ? '#00ff00' : isEnd ? '#ff0000' : '#e94560';
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawPathLine(ctx) {
        if (this.currentPath.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        
        for (let i = 1; i < this.currentPath.length; i++) {
            ctx.lineTo(this.currentPath[i].x, this.currentPath[i].y);
        }
        
        ctx.stroke();
    }
    
    update() {
        // Path doesn't change every frame
    }
}

export { PathSystem };