#!/usr/bin/env python3
"""
Yahoo Finance Price Server
Fetches real-time prices and serves them to the game
"""

import json
import time
import requests
from datetime import datetime
from pathlib import Path

# Configuration
STOCKS = [
    'SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX', 'TSLA'
]
PRICES_FILE = Path('/root/rudedudetrainings.github.io/prices.json')
UPDATE_INTERVAL = 60  # 1 minute

def fetch_yahoo_price(symbol):
    """Fetch live price from Yahoo Finance"""
    try:
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}'
        params = {'interval': '1m', 'range': '1d'}
        headers = {'User-Agent': 'Mozilla/5.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            result = data['chart']['result'][0]
            meta = result['meta']
            
            # Get current price
            current_price = meta.get('regularMarketPrice')
            if not current_price and result['indicators']['quote'][0]['close']:
                current_price = result['indicators']['quote'][0]['close'][-1]
            
            # Get open price
            open_price = meta.get('regularMarketOpen', current_price)
            
            return {
                'price': current_price,
                'open': open_price,
                'high': meta.get('regularMarketDayHigh', current_price),
                'low': meta.get('regularMarketDayLow', current_price),
                'volume': meta.get('regularMarketVolume', 0),
                'updated': datetime.now().isoformat()
            }
    except Exception as e:
        print(f"  Error fetching {symbol}: {e}")
    
    return None

def fetch_prices():
    """Fetch prices for all stocks from Yahoo Finance"""
    prices = {}
    
    print(f"[{datetime.now()}] Fetching live prices from Yahoo Finance...")
    
    for symbol in STOCKS:
        price_data = fetch_yahoo_price(symbol)
        if price_data:
            prices[symbol] = price_data
            print(f"  {symbol}: ${price_data['price']:.2f}")
        else:
            print(f"  {symbol}: Failed to fetch")
        
        time.sleep(0.5)  # Be nice to the API
    
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
    """Main loop"""
    print(f"Starting Price Server...")
    print(f"Stocks: {', '.join(STOCKS)}")
    print(f"Update interval: {UPDATE_INTERVAL} seconds")
    print("-" * 50)
    
    while True:
        try:
            prices = fetch_prices()
            if prices:
                save_prices(prices)
            else:
                print("No prices fetched, keeping previous data")
        except Exception as e:
            print(f"Error in main loop: {e}")
        
        time.sleep(UPDATE_INTERVAL)

if __name__ == '__main__':
    main()
