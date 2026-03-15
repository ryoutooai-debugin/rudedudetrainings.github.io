#!/usr/bin/env python3
"""
SamOwl Game Server
Fetches stock prices every 5 minutes and saves to prices.json
Serves leaderboard API
"""

import json
import time
import requests
import threading
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

# Configuration
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

def fetch_yahoo_prices():
    """Fetch prices from Yahoo Finance (5-min delayed, free)"""
    prices = {}
    
    print(f"[{datetime.now()}] Fetching prices from Yahoo Finance...")
    
    # Yahoo Finance allows batch requests
    symbols = ','.join(STOCKS)
    url = f'https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols}'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if data.get('quoteResponse') and data['quoteResponse'].get('result'):
                for quote in data['quoteResponse']['result']:
                    symbol = quote.get('symbol')
                    price = quote.get('regularMarketPrice')
                    if symbol and price:
                        prices[symbol] = {
                            'price': price,
                            'open': quote.get('regularMarketOpen', price),
                            'high': quote.get('regularMarketDayHigh', price),
                            'low': quote.get('regularMarketDayLow', price),
                            'volume': quote.get('regularMarketVolume', 0),
                            'updated': datetime.now().isoformat()
                        }
                        print(f"  {symbol}: ${price:.2f}")
            print(f"[{datetime.now()}] Fetched {len(prices)} prices")
        else:
            print(f"[{datetime.now()}] Yahoo Finance returned status {response.status_code}")
    except Exception as e:
        print(f"[{datetime.now()}] Error fetching prices: {e}")
    
    return prices

def save_prices(prices):
    """Save prices to JSON file"""
    data = {
        'last_update': datetime.now().isoformat(),
        'stocks': prices
    }
    with open(PRICES_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"[{datetime.now()}] Saved {len(prices)} prices to prices.json")

def price_updater():
    """Background thread - fetch prices every 5 minutes"""
    # Fetch immediately on startup
    prices = fetch_yahoo_prices()
    save_prices(prices)
    
    while True:
        time.sleep(PRICE_UPDATE_INTERVAL)
        try:
            prices = fetch_yahoo_prices()
            save_prices(prices)
        except Exception as e:
            print(f"[{datetime.now()}] Price update error: {e}")

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
