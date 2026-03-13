#!/usr/bin/env python3
"""
Yahoo Finance Price Server
Fetches real-time prices and serves them to the game
Runs continuously, updates every 5 minutes
"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

# Configuration
STOCKS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX', 'TSLA',
    'JPM', 'V', 'MA', 'LLY', 'JNJ', 'UNH', 'PFE',
    'WMT', 'COST', 'HD', 'PG', 'KO', 'PEP', 'XOM', 'CAT', 'BA'
]
PRICES_FILE = Path('/root/rudedudetrainings.github.io/prices.json')
UPDATE_INTERVAL = 300  # 5 minutes

def fetch_yahoo_prices():
    """Fetch prices for all stocks from Yahoo Finance (batch request)"""
    prices = {}
    
    print(f"[{datetime.now()}] Fetching prices from Yahoo Finance...")
    
    # Yahoo Finance API endpoint for batch quotes
    # Using the query1.finance.yahoo.com endpoint
    symbols_str = ','.join(STOCKS)
    url = f'https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbols_str}'
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            quotes = data.get('quoteResponse', {}).get('result', [])
            
            for quote in quotes:
                symbol = quote.get('symbol')
                if symbol:
                    prices[symbol] = {
                        'price': quote.get('regularMarketPrice', 0),
                        'open': quote.get('regularMarketOpen', 0),
                        'high': quote.get('regularMarketDayHigh', 0),
                        'low': quote.get('regularMarketDayLow', 0),
                        'volume': quote.get('regularMarketVolume', 0),
                        'updated': datetime.now().isoformat()
                    }
                    print(f"  {symbol}: ${prices[symbol]['price']:.2f}")
            
            print(f"[{datetime.now()}] Fetched {len(prices)} stocks")
        else:
            print(f"  Error: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"  Error fetching prices: {e}")
    
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
    print("🦉 Yahoo Finance Price Server Starting")
    print(f"Stocks: {len(STOCKS)}")
    print(f"Update interval: {UPDATE_INTERVAL} seconds ({UPDATE_INTERVAL/60} minutes)")
    print("=" * 60)
    
    while True:
        try:
            prices = fetch_yahoo_prices()
            if prices:
                save_prices(prices)
            print(f"[{datetime.now()}] Sleeping for {UPDATE_INTERVAL} seconds...")
            print("-" * 60)
        except Exception as e:
            print(f"[{datetime.now()}] Error in main loop: {e}")
        
        time.sleep(UPDATE_INTERVAL)

if __name__ == '__main__':
    main()
