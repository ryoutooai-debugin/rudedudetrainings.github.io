#!/usr/bin/env python3
"""
SamOwl Game Server
Handles both price fetching and leaderboard
Runs continuously
"""

import json
import time
import requests
import threading
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
API_KEY = 'hZajhu43KW9bwuLMdpbtBww7KqeU1bad'
STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX', 'TSLA',
    'BRK-B', 'JPM', 'V', 'MA', 'LLY', 'JNJ', 'UNH', 'PFE',
    'WMT', 'COST', 'HD', 'PG', 'KO', 'PEP', 'XOM', 'CAT', 'BA'
]
DATA_DIR = Path('/root/rudedudetrainings.github.io')
PRICES_FILE = DATA_DIR / 'prices.json'
LEADERBOARD_FILE = DATA_DIR / 'leaderboard.json'
PRICE_UPDATE_INTERVAL = 300  # 5 minutes
SERVER_PORT = 8080

def load_leaderboard():
    """Load leaderboard from file"""
    if LEADERBOARD_FILE.exists():
        try:
            with open(LEADERBOARD_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {'entries': [], 'last_update': datetime.now().isoformat()}

def save_leaderboard(data):
    """Save leaderboard to file"""
    data['last_update'] = datetime.now().isoformat()
    with open(LEADERBOARD_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def add_score(name, portfolio_value, cash):
    """Add a new score to leaderboard"""
    leaderboard = load_leaderboard()
    
    # Check if player already exists
    existing = None
    for entry in leaderboard['entries']:
        if entry['name'] == name:
            existing = entry
            break
    
    if existing:
        # Update if new score is higher
        if portfolio_value > existing['portfolio_value']:
            existing['portfolio_value'] = portfolio_value
            existing['cash'] = cash
            existing['updated'] = datetime.now().isoformat()
    else:
        # Add new entry
        leaderboard['entries'].append({
            'name': name,
            'portfolio_value': portfolio_value,
            'cash': cash,
            'updated': datetime.now().isoformat()
        })
    
    # Sort by portfolio value (descending) and keep top 100
    leaderboard['entries'].sort(key=lambda x: x['portfolio_value'], reverse=True)
    leaderboard['entries'] = leaderboard['entries'][:100]
    
    save_leaderboard(leaderboard)
    return leaderboard

def fetch_prices():
    """Fetch prices for all stocks from Polygon"""
    prices = {}
    
    print(f"[{datetime.now()}] Fetching prices from Polygon.io...")
    
    for symbol in STOCKS:
        try:
            url = f'https://api.polygon.io/v2/aggs/ticker/{symbol}/prev?apiKey={API_KEY}'
            response = requests.get(url, timeout=10)
            
            if response.status_code == 429:
                print(f"  Rate limited on {symbol}, waiting...")
                time.sleep(12)
                response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get('results') and len(data['results']) > 0:
                    result = data['results'][0]
                    prices[symbol] = {
                        'price': result['c'],
                        'open': result['o'],
                        'high': result['h'],
                        'low': result['l'],
                        'volume': result['v'],
                        'updated': datetime.now().isoformat()
                    }
                    print(f"  {symbol}: ${result['c']:.2f}")
            else:
                print(f"  {symbol}: HTTP {response.status_code}")
        except Exception as e:
            print(f"  {symbol}: Error - {e}")
        
        time.sleep(0.3)
    
    return prices

def save_prices(prices):
    """Save prices to JSON file"""
    data = {
        'last_update': datetime.now().isoformat(),
        'stocks': prices
    }
    with open(PRICES_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"[{datetime.now()}] Saved {len(prices)} prices")

def price_updater():
    """Background thread - fetch prices every 5 minutes"""
    while True:
        try:
            prices = fetch_prices()
            save_prices(prices)
        except Exception as e:
            print(f"[{datetime.now()}] Price update error: {e}")
        
        time.sleep(PRICE_UPDATE_INTERVAL)

class RequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for leaderboard API"""
    
    def log_message(self, format, *args):
        """Suppress default logging"""
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
        if self.path == '/leaderboard':
            leaderboard = load_leaderboard()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(leaderboard).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_POST(self):
        """Handle POST requests"""
        if self.path == '/leaderboard':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                name = data.get('name', 'Anonymous')
                portfolio_value = data.get('portfolio_value', 0)
                cash = data.get('cash', 0)
                
                leaderboard = add_score(name, portfolio_value, cash)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'ok', 'leaderboard': leaderboard}).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    """Run HTTP server"""
    server = HTTPServer(('0.0.0.0', SERVER_PORT), RequestHandler)
    print(f"[{datetime.now()}] Leaderboard server running on port {SERVER_PORT}")
    server.serve_forever()

def main():
    """Main function"""
    print("=" * 60)
    print("🦉 SamOwl Game Server Starting")
    print(f"Stocks: {len(STOCKS)}")
    print(f"Price updates: Every {PRICE_UPDATE_INTERVAL/60} minutes")
    print(f"Leaderboard API: http://localhost:{SERVER_PORT}")
    print("=" * 60)
    
    # Initialize files
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not LEADERBOARD_FILE.exists():
        save_leaderboard({'entries': []})
    
    # Start price updater in background
    price_thread = threading.Thread(target=price_updater, daemon=True)
    price_thread.start()
    
    # Run server in main thread
    run_server()

if __name__ == '__main__':
    main()
