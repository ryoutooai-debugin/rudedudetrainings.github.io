#!/usr/bin/env python3
"""
SamOwl Leaderboard + OWL Store Server
Receives scores, tracks OWL currency, and manages store purchases
"""

import json
import time
import os
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Configuration
REPO_DIR = Path(os.environ.get('RAILWAY_VOLUME_MOUNT_PATH', '/app'))
LEADERBOARD_FILE = REPO_DIR / 'leaderboard.json'
SERVER_PORT = int(os.environ.get('PORT', 8080))

# Store items configuration
STORE_ITEMS = {
    'baby_owl': {'name': '🐣 Baby Owl', 'price': 50, 'description': 'Just hatched! Welcome to trading.'},
    'wise_owl': {'name': '🦉 Wise Owl', 'price': 100, 'description': 'You\'re learning the markets.'},
    'eagle_owl': {'name': '🦅 Eagle Owl', 'price': 250, 'description': 'Sharp eyes for opportunities.'},
    'king_owl': {'name': '👑 King Owl', 'price': 500, 'description': 'Ruling the trading roost.'},
    'legendary_owl': {'name': '🌟 Legendary Owl', 'price': 1000, 'description': 'A trading master.'},
    'custom_badge': {'name': '🎨 Custom Badge', 'price': 200, 'description': 'Design your own badge.'},
    'trophy_sticker': {'name': '🏆 Trophy Sticker', 'price': 150, 'description': 'For your achievements.'},
    'diamond_owl': {'name': '💎 Diamond Owl', 'price': 2000, 'description': 'Rare and valuable.'},
}

# OWL earning rules
OWL_RULES = {
    'trade': 1,
    'profit_trade': 5,
    'reach_10k': 50,
    'reach_50k': 100,
    'reach_100k': 250,
    'top_10_leaderboard': 100,
    'streak_7_days': 25,
    'streak_30_days': 100,
}

# Ensure the directory exists
REPO_DIR.mkdir(parents=True, exist_ok=True)

def load_leaderboard():
    """Load leaderboard from file"""
    if LEADERBOARD_FILE.exists():
        try:
            with open(LEADERBOARD_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {
        'entries': [],
        'store_items': STORE_ITEMS,
        'owl_rules': OWL_RULES,
        'last_update': datetime.now().isoformat()
    }

def save_leaderboard(data):
    """Save leaderboard to file"""
    data['last_update'] = datetime.now().isoformat()
    with open(LEADERBOARD_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_or_create_user(leaderboard, user_id):
    """Get user or create if not exists"""
    if 'users' not in leaderboard:
        leaderboard['users'] = {}
    
    if user_id not in leaderboard['users']:
        leaderboard['users'][user_id] = {
            'name': user_id,
            'portfolio_value': 0,
            'cash': 0,
            'owls': 0,
            'inventory': [],
            'stats': {
                'trades': 0,
                'profit_trades': 0,
                'streak_days': 0,
                'last_played': None
            },
            'created': datetime.now().isoformat(),
            'updated': datetime.now().isoformat()
        }
    
    return leaderboard['users'][user_id]

def calculate_owls_from_trade(user, portfolio_value, cash):
    """Calculate OWLs earned from a trade"""
    owls_earned = 0
    reasons = []
    
    # Base trade OWL
    owls_earned += OWL_RULES['trade']
    reasons.append(f"+{OWL_RULES['trade']} for trading")
    
    # Check for profit (portfolio increased)
    old_value = user.get('portfolio_value', 0)
    if portfolio_value > old_value:
        profit = portfolio_value - old_value
        if profit > 0:
            owls_earned += OWL_RULES['profit_trade']
            reasons.append(f"+{OWL_RULES['profit_trade']} for profit")
            user['stats']['profit_trades'] += 1
    
    # Check milestones
    if portfolio_value >= 100000 and old_value < 100000:
        owls_earned += OWL_RULES['reach_100k']
        reasons.append(f"+{OWL_RULES['reach_100k']} for reaching $100k!")
    elif portfolio_value >= 50000 and old_value < 50000:
        owls_earned += OWL_RULES['reach_50k']
        reasons.append(f"+{OWL_RULES['reach_50k']} for reaching $50k!")
    elif portfolio_value >= 10000 and old_value < 10000:
        owls_earned += OWL_RULES['reach_10k']
        reasons.append(f"+{OWL_RULES['reach_10k']} for reaching $10k!")
    
    user['stats']['trades'] += 1
    user['portfolio_value'] = portfolio_value
    user['cash'] = cash
    user['updated'] = datetime.now().isoformat()
    
    return owls_earned, reasons

def add_score(name, portfolio_value, cash):
    """Add a new score and calculate OWLs"""
    leaderboard = load_leaderboard()
    user = get_or_create_user(leaderboard, name)
    
    # Calculate OWLs earned
    owls_earned, reasons = calculate_owls_from_trade(user, portfolio_value, cash)
    user['owls'] += owls_earned
    
    # Update leaderboard entries (for backwards compatibility)
    existing = None
    for entry in leaderboard['entries']:
        if entry['name'] == name:
            existing = entry
            break
    
    if existing:
        if portfolio_value > existing['portfolio_value']:
            existing['portfolio_value'] = portfolio_value
            existing['cash'] = cash
            existing['updated'] = datetime.now().isoformat()
    else:
        leaderboard['entries'].append({
            'name': name,
            'portfolio_value': portfolio_value,
            'cash': cash,
            'updated': datetime.now().isoformat()
        })
    
    # Sort by portfolio value and keep top 100
    leaderboard['entries'].sort(key=lambda x: x['portfolio_value'], reverse=True)
    leaderboard['entries'] = leaderboard['entries'][:100]
    
    save_leaderboard(leaderboard)
    return leaderboard, owls_earned, reasons

def buy_item(user_id, item_id):
    """Purchase an item from the store"""
    leaderboard = load_leaderboard()
    
    if 'users' not in leaderboard or user_id not in leaderboard['users']:
        return {'success': False, 'error': 'User not found'}
    
    user = leaderboard['users'][user_id]
    
    if item_id not in STORE_ITEMS:
        return {'success': False, 'error': 'Item not found'}
    
    item = STORE_ITEMS[item_id]
    
    # Check if already owned
    if item_id in user['inventory']:
        return {'success': False, 'error': 'Item already owned'}
    
    # Check balance
    if user['owls'] < item['price']:
        return {'success': False, 'error': f"Not enough OWLs. Need {item['price']}, have {user['owls']}"}
    
    # Deduct OWLs and add to inventory
    user['owls'] -= item['price']
    user['inventory'].append(item_id)
    user['updated'] = datetime.now().isoformat()
    
    save_leaderboard(leaderboard)
    
    return {
        'success': True,
        'message': f"Purchased {item['name']}!",
        'remaining_owls': user['owls'],
        'inventory': user['inventory']
    }

def commit_to_github():
    """Commit leaderboard changes to GitHub"""
    github_token = os.environ.get('GITHUB_TOKEN')
    if not github_token:
        print(f"[{datetime.now()}] No GITHUB_TOKEN set, skipping GitHub commit")
        return False
    
    try:
        import urllib.request
        import base64
        
        with open(LEADERBOARD_FILE, 'r') as f:
            content = f.read()
        
        repo = 'ryoutooai-debugin/rudedudetrainings.github.io'
        path = 'leaderboard.json'
        url = f'https://api.github.com/repos/{repo}/contents/{path}'
        
        # Get current SHA
        req = urllib.request.Request(url, headers={
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json'
        })
        
        sha = None
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                sha = data.get('sha')
        except urllib.error.HTTPError as e:
            if e.code != 404:
                raise
        
        # Create or update file
        data = {
            'message': f'Update leaderboard - {datetime.now().strftime("%Y-%m-%d %H:%M")}',
            'content': base64.b64encode(content.encode()).decode(),
        }
        if sha:
            data['sha'] = sha
        
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers={
            'Authorization': f'token {github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }, method='PUT')
        
        with urllib.request.urlopen(req) as response:
            print(f"[{datetime.now()}] Committed leaderboard to GitHub")
            return True
            
    except Exception as e:
        print(f"[{datetime.now()}] GitHub error: {e}")
        return False

class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for leaderboard and OWL store API"""
    
    def log_message(self, format, *args):
        pass
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        if path == '/leaderboard':
            leaderboard = load_leaderboard()
            self.send_json(leaderboard)
        
        elif path == '/owls':
            user_id = params.get('user_id', [''])[0]
            if not user_id:
                self.send_json({'error': 'user_id required'}, 400)
                return
            
            leaderboard = load_leaderboard()
            user = get_or_create_user(leaderboard, user_id)
            
            self.send_json({
                'user_id': user_id,
                'owls': user['owls'],
                'stats': user['stats'],
                'next_milestone': self.get_next_milestone(user)
            })
        
        elif path == '/inventory':
            user_id = params.get('user_id', [''])[0]
            if not user_id:
                self.send_json({'error': 'user_id required'}, 400)
                return
            
            leaderboard = load_leaderboard()
            user = get_or_create_user(leaderboard, user_id)
            
            # Get full item details for inventory
            inventory_details = []
            for item_id in user['inventory']:
                if item_id in STORE_ITEMS:
                    item = STORE_ITEMS[item_id].copy()
                    item['id'] = item_id
                    inventory_details.append(item)
            
            self.send_json({
                'user_id': user_id,
                'owls': user['owls'],
                'inventory': inventory_details,
                'item_count': len(user['inventory'])
            })
        
        elif path == '/store':
            self.send_json({
                'items': STORE_ITEMS,
                'rules': OWL_RULES
            })
        
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self.send_json({'error': 'No data provided'}, 400)
            return
        
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data)
        except:
            self.send_json({'error': 'Invalid JSON'}, 400)
            return
        
        path = urlparse(self.path).path
        
        if path == '/leaderboard':
            name = data.get('name', 'Anonymous')
            portfolio_value = data.get('portfolio_value', 0)
            cash = data.get('cash', 0)
            
            print(f"[{datetime.now()}] New score: {name} - ${portfolio_value:,.2f}")
            
            leaderboard, owls_earned, reasons = add_score(name, portfolio_value, cash)
            
            # Commit to GitHub (async)
            import threading
            threading.Thread(target=commit_to_github, daemon=True).start()
            
            self.send_json({
                'status': 'ok',
                'message': 'Score submitted!',
                'owls_earned': owls_earned,
                'owl_reasons': reasons,
                'rank': next((i+1 for i, e in enumerate(leaderboard['entries']) if e['name'] == name), None)
            })
        
        elif path == '/buy':
            user_id = data.get('user_id')
            item_id = data.get('item_id')
            
            if not user_id or not item_id:
                self.send_json({'error': 'user_id and item_id required'}, 400)
                return
            
            result = buy_item(user_id, item_id)
            
            if result['success']:
                # Commit to GitHub (async)
                import threading
                threading.Thread(target=commit_to_github, daemon=True).start()
            
            self.send_json(result, 200 if result['success'] else 400)
        
        else:
            self.send_response(404)
            self.end_headers()
    
    def send_json(self, data, status=200):
        """Send JSON response"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def get_next_milestone(self, user):
        """Get next OWL milestone for user"""
        portfolio = user.get('portfolio_value', 0)
        if portfolio < 10000:
            return {'target': 10000, 'reward': OWL_RULES['reach_10k'], 'label': '$10k Club'}
        elif portfolio < 50000:
            return {'target': 50000, 'reward': OWL_RULES['reach_50k'], 'label': '$50k Club'}
        elif portfolio < 100000:
            return {'target': 100000, 'reward': OWL_RULES['reach_100k'], 'label': '$100k Club'}
        else:
            return None

def run_server():
    """Run HTTP server"""
    server = HTTPServer(('0.0.0.0', SERVER_PORT), RequestHandler)
    print(f"[{datetime.now()}] SamOwl server running on port {SERVER_PORT}")
    print(f"[{datetime.now()}] Endpoints:")
    print(f"  GET  /leaderboard     - Get all scores")
    print(f"  GET  /owls?user_id=xx - Get OWL balance")
    print(f"  GET  /inventory?user_id=xx - Get inventory")
    print(f"  GET  /store           - Get store items")
    print(f"  POST /leaderboard     - Submit score")
    print(f"  POST /buy             - Buy item")
    server.serve_forever()

def main():
    """Main function"""
    print("=" * 60)
    print("🦉 SamOwl Leaderboard + OWL Store Server")
    print(f"Port: {SERVER_PORT}")
    print(f"Data: {LEADERBOARD_FILE}")
    print("=" * 60)
    
    # Initialize leaderboard file
    if not LEADERBOARD_FILE.exists():
        save_leaderboard({
            'entries': [],
            'users': {},
            'store_items': STORE_ITEMS,
            'owl_rules': OWL_RULES
        })
    
    run_server()

if __name__ == '__main__':
    main()
