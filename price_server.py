#!/usr/bin/env python3
"""
Polygon Price Server
Fetches real-time prices and serves them to the game
Runs continuously, updates every 5 minutes
"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

# Configuration
API_KEY = 'hZajhu43KW9bwuLMdpbtBww7KqeU1bad'
STOCKS = [
    'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX', 'TSLA',
    'BRK-B', 'JPM', 'V', 'MA', 'LLY', 'JNJ', 'UNH', 'PFE',
    'WMT', 'COST', 'HD', 'PG', 'KO', 'PEP', 'XOM', 'CAT', 'BA'
]
PRICES_FILE = Path('/root/rudedudetrainings.github.io/prices.json')
UPDATE_INTERVAL = 60  # 1 minute

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
                time.sleep(12)  # Wait and retry
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
                    print(f"  {symbol}: No data")
            else:
                print(f"  {symbol}: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"  {symbol}: Error - {e}")
        
        # Small delay to be nice to the API
        time.sleep(0.5)
    
    return prices

def save_prices(prices):
    """Save prices to JSON file"""
    data = {
        'last_update': datetime.now().isoformat(),
        'stocks': prices
    }
    
    PRICES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PRICES_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"[{datetime.now()}] Saved {len(prices)} prices to {PRICES_FILE}")

def main():
    """Main loop - fetch prices every 5 minutes"""
    print("=" * 60)
    print("🦉 Polygon Price Server Starting")
    print(f"Stocks: {len(STOCKS)}")
    print(f"Update interval: {UPDATE_INTERVAL} seconds ({UPDATE_INTERVAL/60} minutes)")
    print("=" * 60)
    
    while True:
        try:
            prices = fetch_prices()
            save_prices(prices)
            print(f"[{datetime.now()}] Sleeping for {UPDATE_INTERVAL} seconds...")
            print("-" * 60)
        except Exception as e:
            print(f"[{datetime.now()}] Error in main loop: {e}")
        
        time.sleep(UPDATE_INTERVAL)

if __name__ == '__main__':
    main()
