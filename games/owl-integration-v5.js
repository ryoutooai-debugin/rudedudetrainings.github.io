// ============================================
// OWL STORE INTEGRATION - Shared across all games
// ============================================

const OWL_CONFIG = {
    apiUrl: 'https://rudedudetrainingsgithubio-production.up.railway.app',
    gameName: document.title || 'SamOwl Game'
};

// ============================================
// SOUND EFFECTS MANAGER
// ============================================
const SoundManager = {
    enabled: true,
    context: null,
    
    init() {
        if (!this.context) {
            this.context = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
    },
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    },
    
    play(type) {
        if (!this.enabled || !this.context) return;
        
        const sounds = {
            correct: { freq: 880, type: 'sine', duration: 0.15, slide: 1100 },
            wrong: { freq: 200, type: 'sawtooth', duration: 0.3, slide: 150 },
            levelUp: { freq: 523, type: 'sine', duration: 0.4, slide: 880 },
            coin: { freq: 1200, type: 'sine', duration: 0.1, slide: 1800 },
            click: { freq: 600, type: 'sine', duration: 0.05, slide: 600 },
            hoot: { freq: 400, type: 'sine', duration: 0.3, slide: 350 },
            buy: { freq: 660, type: 'sine', duration: 0.2, slide: 990 },
            earn: { freq: 523, type: 'sine', duration: 0.15, slide: 784 }
        };
        
        const sound = sounds[type];
        if (!sound) return;
        
        const osc = this.context.createOscillator();
        const gain = this.context.createGain();
        
        osc.type = sound.type;
        osc.frequency.setValueAtTime(sound.freq, this.context.currentTime);
        
        if (sound.slide) {
            osc.frequency.exponentialRampToValueAtTime(sound.slide, this.context.currentTime + sound.duration);
        }
        
        gain.gain.setValueAtTime(0.3, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + sound.duration);
        
        osc.connect(gain);
        gain.connect(this.context.destination);
        
        osc.start(this.context.currentTime);
        osc.stop(this.context.currentTime + sound.duration);
    }
};

document.addEventListener('click', () => SoundManager.init(), { once: true });
document.addEventListener('touchstart', () => SoundManager.init(), { once: true });
document.addEventListener('keydown', () => SoundManager.init(), { once: true });

// Also try to init immediately (might work if page was already interacted with)
setTimeout(() => SoundManager.init(), 100);

function getUserId() {
    let userId = localStorage.getItem('samowl_user_id');
    if (!userId) {
        userId = 'owl_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('samowl_user_id', userId);
    }
    return userId;
}

function getDisplayName() {
    return localStorage.getItem('samowl_username') || getUserId();
}

function setDisplayName(name) {
    localStorage.setItem('samowl_username', name);
}

function calculateOwls(gameType, score, level, streak, extras = {}) {
    let owls = 0;
    const reasons = [];
    
    switch(gameType) {
        case 'color-match':
            owls += Math.floor(score / 50);
            if (owls > 0) reasons.push(`+${owls} for ${score} stars`);
            if (streak >= 10) { owls += 5; reasons.push('+5 for 10+ streak!'); }
            if (level >= 5) { owls += 10; reasons.push('+10 for reaching level 5!'); }
            break;
        case 'market-match':
            owls += Math.floor(score / 100);
            if (owls > 0) reasons.push(`+${owls} for ${score} coins`);
            if (extras.accuracy >= 80) { owls += 5; reasons.push('+5 for 80%+ accuracy!'); }
            if (streak >= 5) { owls += 3; reasons.push('+3 for 5+ streak!'); }
            break;
        case 'trading-quest':
            const portfolio = extras.portfolio || score;
            owls += Math.floor(portfolio / 1000);
            if (owls > 0) reasons.push(`+${owls} for $${portfolio.toLocaleString()} portfolio`);
            if (portfolio >= 100000 && !extras.milestone100k) { owls += 250; reasons.push('+250 for $100k milestone!'); }
            else if (portfolio >= 50000 && !extras.milestone50k) { owls += 100; reasons.push('+100 for $50k milestone!'); }
            else if (portfolio >= 10000 && !extras.milestone10k) { owls += 50; reasons.push('+50 for $10k milestone!'); }
            if (extras.profitableTrades >= 10) { owls += 25; reasons.push('+25 for 10 profitable trades!'); }
            break;
        case 'portfolio-challenge':
            const timeBonus = Math.max(0, 300 - (extras.timeElapsed || 0));
            owls += Math.floor(score / 500) + Math.floor(timeBonus / 60);
            if (owls > 0) reasons.push(`+${owls} for challenge completion`);
            if (extras.rank && extras.rank <= 3) {
                const rankBonus = extras.rank === 1 ? 50 : extras.rank === 2 ? 30 : 20;
                owls += rankBonus;
                reasons.push(`+${rankBonus} for ${['1st', '2nd', '3rd'][extras.rank - 1]} place!`);
            }
            break;
        case 'bull-vs-bear':
            const correct = extras.correctPredictions || 0;
            const total = extras.totalPredictions || 1;
            const accuracy = (correct / total) * 100;
            owls += correct;
            if (correct > 0) reasons.push(`+${correct} for ${correct} correct predictions`);
            if (accuracy >= 70 && total >= 10) { owls += 10; reasons.push('+10 for 70%+ accuracy!'); }
            break;
        case 'pattern-master':
            owls += Math.floor(score / 200);
            if (owls > 0) reasons.push(`+${owls} for ${score} points`);
            if (extras.patternsLearned >= 5) { owls += 15; reasons.push('+15 for learning 5+ patterns!'); }
            break;
    }
    
    const lastPlay = localStorage.getItem('samowl_last_play');
    const today = new Date().toDateString();
    if (lastPlay !== today) {
        owls += 5;
        reasons.push('+5 daily bonus!');
        localStorage.setItem('samowl_last_play', today);
    }
    
    return { owls, reasons };
}

async function submitScore(gameType, score, level, streak, extras = {}) {
    const userId = getUserId();
    const displayName = getDisplayName();
    const { owls, reasons } = calculateOwls(gameType, score, level, streak, extras);
    
    try {
        const response = await fetch(`${OWL_CONFIG.apiUrl}/leaderboard`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: displayName,
                portfolio_value: score,
                cash: extras.cash || 0
            })
        });
        
        const data = await response.json();
        
        if (owls > 0) {
            showOwlNotification(owls, reasons);
            updateOwlButton(owls);
            SoundManager.play('earn');
        }
        
        return { ...data, owlsEarned: owls, owlReasons: reasons };
    } catch (error) {
        console.error('Failed to submit score:', error);
        // Still award OWLs locally even if server is down
        if (owls > 0) {
            const currentOwls = parseInt(localStorage.getItem('samowl_owls') || 0);
            localStorage.setItem('samowl_owls', currentOwls + owls);
            showOwlNotification(owls, [...reasons, '(saved locally - server down)']);
            updateOwlButton(owls);
            SoundManager.play('earn');
        }
        return { error: error.message, owlsEarned: owls, owlReasons: reasons };
    }
}

function showOwlNotification(owls, reasons) {
    const existing = document.getElementById('owl-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'owl-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f39c12, #e74c3c);
        color: white;
        padding: 20px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 300px;
        animation: owlSlideIn 0.5s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="font-size: 32px;">🦉</span>
            <div>
                <div style="font-size: 20px; font-weight: bold;">+${owls} OWLs!</div>
                <div style="font-size: 12px; opacity: 0.9;">Great job!</div>
            </div>
        </div>
        <div style="font-size: 12px; opacity: 0.9; line-height: 1.5;">
            ${reasons.map(r => `• ${r}`).join('<br>')}
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'owlSlideOut 0.5s ease';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

function updateOwlButton(additionalOwls = 0) {
    const button = document.getElementById('owl-store-floating-btn');
    if (button) {
        const current = parseInt(button.dataset.owls || 0);
        button.dataset.owls = current + additionalOwls;
        button.querySelector('.owl-count').textContent = (current + additionalOwls).toLocaleString();
    }
}

async function loadOwlBalance() {
    const userId = getUserId();
    const localOwls = parseInt(localStorage.getItem('samowl_owls') || 0);
    
    try {
        const response = await fetch(`${OWL_CONFIG.apiUrl}/owls?user_id=${encodeURIComponent(userId)}`);
        const data = await response.json();
        
        // Use the higher of server or local balance (don't lose progress!)
        const totalOwls = Math.max(data.owls || 0, localOwls);
        
        // Update localStorage with server value if it's higher
        if (data.owls > localOwls) {
            localStorage.setItem('samowl_owls', data.owls);
        }
        
        const button = document.getElementById('owl-store-floating-btn');
        if (button) {
            button.dataset.owls = totalOwls;
            button.querySelector('.owl-count').textContent = totalOwls.toLocaleString();
        }
        
        return totalOwls;
    } catch (error) {
        console.error('Failed to load OWLs:', error);
        // Use localStorage when server is down
        const button = document.getElementById('owl-store-floating-btn');
        if (button) {
            button.dataset.owls = localOwls;
            button.querySelector('.owl-count').textContent = localOwls.toLocaleString();
        }
        return localOwls;
    }
}

function openOwlStore() {
    const userId = getUserId();
    const displayName = getDisplayName();
    
    const modal = document.createElement('div');
    modal.id = 'owl-store-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.85);
        z-index: 10001;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            border-radius: 20px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            border: 2px solid #e94560;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 2px solid #e94560;
                background: rgba(233, 69, 96, 0.1);
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 32px;">🦉</span>
                    <span style="font-size: 24px; font-weight: bold; color: white;">OWL Store</span>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="
                        background: linear-gradient(135deg, #f39c12, #e74c3c);
                        padding: 10px 20px;
                        border-radius: 25px;
                        font-weight: bold;
                        color: white;
                    ">
                        🪙 <span id="store-owl-balance">...</span> OWLs
                    </div>
                    <button onclick="closeOwlStore()" style="
                        background: #e94560;
                        border: none;
                        color: white;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        font-size: 24px;
                        cursor: pointer;
                    ">×</button>
                </div>
            </div>
            
            <div style="padding: 20px;">
                <div id="store-items" style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 15px;
                ">
                    <p style="color: #aaa; text-align: center; grid-column: 1/-1;">Loading store...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    loadStoreItems();
    loadOwlBalance().then(owls => {
        document.getElementById('store-owl-balance').textContent = owls.toLocaleString();
    });
}

function closeOwlStore() {
    const modal = document.getElementById('owl-store-modal');
    if (modal) modal.remove();
}

async function loadStoreItems() {
    try {
        const response = await fetch(`${OWL_CONFIG.apiUrl}/store`);
        const data = await response.json();
        
        const container = document.getElementById('store-items');
        container.innerHTML = '';
        
        for (const [id, item] of Object.entries(data.items)) {
            const div = document.createElement('div');
            div.style.cssText = `
                background: #0f3460;
                border-radius: 15px;
                padding: 15px;
                text-align: center;
                border: 2px solid transparent;
                transition: all 0.3s;
                cursor: pointer;
            `;
            div.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 8px;">${item.name.split(' ')[0]}</div>
                <div style="font-weight: bold; color: white; margin-bottom: 5px;">${item.name.split(' ').slice(1).join(' ')}</div>
                <div style="font-size: 12px; color: #aaa; margin-bottom: 10px; min-height: 30px;">${item.description}</div>
                <div style="background: linear-gradient(135deg, #f39c12, #e74c3c); padding: 8px 16px; border-radius: 20px; font-weight: bold; color: white; display: inline-block;">
                    🪙 ${item.price}
                </div>
            `;
            div.onclick = () => buyItem(id, item);
            container.appendChild(div);
        }
    } catch (error) {
        console.error('Failed to load store:', error);
        // Show fallback message when server is down
        const container = document.getElementById('store-items');
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #aaa;">
                <div style="font-size: 48px; margin-bottom: 15px;">🔧</div>
                <div style="font-size: 18px; margin-bottom: 10px;">Store is temporarily unavailable</div>
                <div style="font-size: 14px; opacity: 0.7;">The OWL store server is waking up...</div>
                <div style="font-size: 12px; opacity: 0.5; margin-top: 15px;">Try again in a few moments!</div>
            </div>
        `;
    }
}

async function buyItem(itemId, item) {
    const userId = getUserId();
    
    try {
        const response = await fetch(`${OWL_CONFIG.apiUrl}/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, item_id: itemId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showOwlNotification(0, [`Purchased ${item.name}!`]);
            document.getElementById('store-owl-balance').textContent = data.remaining_owls.toLocaleString();
            updateOwlButton(0);
            loadOwlBalance();
            SoundManager.play('buy');
        } else {
            alert(data.error);
            SoundManager.play('wrong');
        }
    } catch (error) {
        console.error('Purchase failed:', error);
    }
}

const GAME_DESCRIPTIONS = {
    'color-match': {
        title: '🎨 Color Match',
        howToPlay: 'Tap the card that matches the target color! Each correct match earns stars. Build streaks for bonus points. Complete 5 correct matches to level up!',
        benefits: 'Kids learn color recognition, pattern matching, and quick decision-making. Builds focus and rewards careful observation.',
        ageGroup: 'Ages 4-6',
        owlEarning: 'Earn 1 OWL per 50 stars, plus bonuses for streaks and leveling up!'
    },
    'market-match': {
        title: '📊 Market Match',
        howToPlay: 'Look at the candlestick pattern and predict if the next candle will go UP or DOWN. Read the hint for clues! Get 5 right to level up!',
        benefits: 'Teaches basic market patterns, trend recognition, and probability. Kids learn that markets move in patterns but aren\'t always predictable.',
        ageGroup: 'Ages 7-9',
        owlEarning: 'Earn 1 OWL per 100 coins, plus bonuses for accuracy and streaks!'
    },
    'trading-quest': {
        title: '🏆 Trading Quest',
        howToPlay: 'Buy low, sell high! Watch stock prices move in real-time. Buy shares when prices dip, sell when they rise. Complete quests to earn XP and rank up!',
        benefits: 'Introduces real trading concepts: buying, selling, portfolio management, and patience. Teaches that timing matters in markets.',
        ageGroup: 'Ages 10+',
        owlEarning: 'Earn OWLs based on portfolio value, with big bonuses for $10k, $50k, and $100k milestones!'
    },
    'portfolio-challenge': {
        title: '💼 Portfolio Challenge',
        howToPlay: 'Build the best portfolio before time runs out! Research stocks, buy shares, and watch your portfolio grow. Compete on the global leaderboard!',
        benefits: 'Teaches diversification, research skills, and risk management. Kids learn to balance different investments and think long-term.',
        ageGroup: 'Ages 10+',
        owlEarning: 'Earn OWLs for portfolio performance and leaderboard ranking!'
    },
    'bull-vs-bear': {
        title: '🐂 Bull vs Bear',
        howToPlay: 'Will the market go UP (Bull) or DOWN (Bear)? Study the clues and make your prediction. Collect farm animals as you earn coins!',
        benefits: 'Introduces market sentiment (bullish/bearish), pattern recognition, and collecting rewards. Fun way to learn market direction concepts.',
        ageGroup: 'Ages 6-10',
        owlEarning: 'Earn 1 OWL per correct prediction, plus bonuses for high accuracy!'
    },
    'pattern-master': {
        title: '📈 Pattern Master',
        howToPlay: 'Study the candlestick patterns and identify what signal they show: Bullish (up), Bearish (down), or Neutral. Learn real trading patterns!',
        benefits: 'Teaches technical analysis and real chart patterns used by traders. Kids learn to read price action and understand market psychology.',
        ageGroup: 'Ages 10+',
        owlEarning: 'Earn OWLs for points and learning new patterns!'
    }
};

function showSamOwlHoot() {
    SoundManager.play('hoot');
    
    const path = window.location.pathname;
    let gameType = 'color-match';
    if (path.includes('market-match')) gameType = 'market-match';
    else if (path.includes('trading-quest')) gameType = 'trading-quest';
    else if (path.includes('portfolio')) gameType = 'portfolio-challenge';
    else if (path.includes('bull-vs-bear')) gameType = 'bull-vs-bear';
    else if (path.includes('pattern-master')) gameType = 'pattern-master';
    
    const game = GAME_DESCRIPTIONS[gameType];
    
    const existing = document.getElementById('samowl-hoot');
    if (existing) existing.remove();
    
    const hoot = document.createElement('div');
    hoot.id = 'samowl-hoot';
    hoot.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 25px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        border: 3px solid #e94560;
        box-shadow: 0 25px 80px rgba(0,0,0,0.6);
        z-index: 10002;
        animation: hootPop 0.4s ease;
    `;
    
    hoot.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 60px; animation: float 3s ease-in-out infinite;">🦉</div>
            <div style="font-size: 24px; font-weight: bold; color: #e94560; margin-top: 10px;">Hoot! Let me explain!</div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="background: rgba(233, 69, 96, 0.2); padding: 15px; border-radius: 15px; margin-bottom: 15px;">
                <div style="font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 5px;">${game.title}</div>
                <div style="font-size: 12px; color: #f39c12;">👶 ${game.ageGroup}</div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-size: 14px; font-weight: bold; color: #e94560; margin-bottom: 8px;">🎮 How to Play</div>
                <div style="font-size: 14px; color: #ddd; line-height: 1.6;">${game.howToPlay}</div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-size: 14px; font-weight: bold; color: #27ae60; margin-bottom: 8px;">🧠 What Kids Learn</div>
                <div style="font-size: 14px; color: #ddd; line-height: 1.6;">${game.benefits}</div>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(243, 156, 18, 0.2), rgba(231, 76, 60, 0.2)); padding: 15px; border-radius: 15px;">
                <div style="font-size: 14px; font-weight: bold; color: #f39c12; margin-bottom: 8px;">🦉 Earn OWLs!</div>
                <div style="font-size: 14px; color: #ddd; line-height: 1.6;">${game.owlEarning}</div>
                <div style="font-size: 12px; color: #aaa; margin-top: 8px;">💡 OWLs are shared across ALL games! Play any game, spend in any game!</div>
            </div>
        </div>
        
        <button onclick="closeSamOwlHoot()" style="
            width: 100%;
            background: linear-gradient(135deg, #e94560, #ff6b6b);
            border: none;
            color: white;
            padding: 15px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
        ">Got it! Let's play! 🎮</button>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'samowl-hoot-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 10001;
    `;
    overlay.onclick = closeSamOwlHoot;
    
    document.body.appendChild(overlay);
    document.body.appendChild(hoot);
}

function closeSamOwlHoot() {
    const hoot = document.getElementById('samowl-hoot');
    const overlay = document.getElementById('samowl-hoot-overlay');
    if (hoot) hoot.remove();
    if (overlay) overlay.remove();
}

function createOwlButton() {
    const container = document.createElement('div');
    // Check if mobile for positioning
    const isMobile = window.innerWidth <= 500;

    container.style.cssText = `
        position: fixed;
        bottom: ${isMobile ? '80px' : '20px'};
        right: ${isMobile ? '10px' : '20px'};
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: ${isMobile ? '5px' : '10px'};
        z-index: 1000;
    `;
    
    const hootBtn = document.createElement('button');
    hootBtn.id = 'owl-hoot-btn';
    hootBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea, #764ba2);
        border: none;
        color: white;
        padding: ${isMobile ? '8px 12px' : '12px 20px'};
        border-radius: 25px;
        font-size: ${isMobile ? '11px' : '14px'};
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: ${isMobile ? '4px' : '8px'};
        transition: transform 0.2s;
        animation: hootWiggle 2s ease-in-out infinite;
        white-space: nowrap;
    `;
    hootBtn.innerHTML = isMobile ? '🦉 Help' : '🦉 Hoot! (Help)';
    hootBtn.onclick = showSamOwlHoot;
    
    const storeBtn = document.createElement('button');
    storeBtn.id = 'owl-store-floating-btn';
    storeBtn.style.cssText = `
        background: linear-gradient(135deg, #f39c12, #e74c3c);
        border: none;
        color: white;
        padding: ${isMobile ? '8px 12px' : '15px 25px'};
        border-radius: 50px;
        font-size: ${isMobile ? '12px' : '16px'};
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        gap: ${isMobile ? '4px' : '8px'};
        transition: transform 0.2s;
        white-space: nowrap;
    `;
    storeBtn.innerHTML = isMobile ? '🪙 <span class="owl-count">0</span>' : '🪙 <span class="owl-count">0</span> OWLs';
    storeBtn.onclick = openOwlStore;
    
    const soundBtn = document.createElement('button');
    soundBtn.id = 'owl-sound-btn';
    soundBtn.style.cssText = `
        background: rgba(255,255,255,0.9);
        border: 2px solid rgba(0,0,0,0.1);
        color: #333;
        padding: ${isMobile ? '6px 10px' : '10px 15px'};
        border-radius: 20px;
        font-size: ${isMobile ? '10px' : '12px'};
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s;
        white-space: nowrap;
    `;
    soundBtn.innerHTML = isMobile ? '🔊 On' : '🔊 Sound On';
    soundBtn.onclick = () => {
        const enabled = SoundManager.toggle();
        soundBtn.innerHTML = enabled ? '🔊 Sound On' : '🔇 Sound Off';
        soundBtn.style.opacity = enabled ? '1' : '0.6';
        SoundManager.play('click');
    };
    
    container.appendChild(soundBtn);
    container.appendChild(hootBtn);
    container.appendChild(storeBtn);
    document.body.appendChild(container);
    
    loadOwlBalance();
    
    const hootStyle = document.createElement('style');
    hootStyle.textContent = `
        @keyframes hootWiggle {
            0%, 100% { transform: rotate(0deg); }
            10% { transform: rotate(-5deg); }
            20% { transform: rotate(5deg); }
            30% { transform: rotate(-5deg); }
            40% { transform: rotate(5deg); }
            50% { transform: rotate(0deg); }
        }
        @keyframes hootPop {
            0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(hootStyle);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes owlSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes owlSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOwlButton);
} else {
    createOwlButton();
}
