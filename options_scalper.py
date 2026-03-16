#!/usr/bin/env python3
"""
RSI Mean Reversion Options Scalper - Simplified Version
Trades both CALLs (oversold bounces) and PUTs (overbought drops)
"""

import json
import time
import requests
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, Literal
from pathlib import Path

@dataclass
class Trade:
    symbol: str
    direction: Literal["CALL", "PUT"]
    entry: float
    exit: Optional[float]
    entry_time: str
    exit_time: Optional[str]
    pnl: Optional[float]
    exit_reason: Optional[str]
    strike: float
    expiration: str
    contracts: int

@dataclass
class Position:
    symbol: str
    direction: Literal["CALL", "PUT"]
    entry_price: float
    strike: float
    expiration: str
    entry_time: str
    contracts: int
    stop_loss: float
    take_profit: float

class OptionsScalper:
    def __init__(self, symbol: str = "SPY", capital_per_trade: float = 500):
        self.symbol = symbol
        self.capital_per_trade = capital_per_trade
        self.position: Optional[Position] = None
        self.trades: list[Trade] = []
        self.price_history: list[dict] = []
        self.max_history = 100
        
        # EWO parameters
        self.fast_period = 5
        self.slow_period = 35
        
        # Exit rules
        self.stop_loss_pct = 30.0
        self.take_profit_pct = 50.0
        
        # RSI parameters
        self.rsi_period = 14
        self.ema_fast = 9
        self.ema_slow = 21
        self.oversold = 30
        self.overbought = 70
        self.sl_mult = 1.0
        self.tp_mult = 2.0
        
        # Data file
        self.data_file = Path("/root/rudedudetrainings.github.io/scalper_options_data.json")
        
        # Load existing data
        self.load_data()
    
    def load_data(self):
        """Load existing data from file"""
        if self.data_file.exists():
            try:
                with open(self.data_file, 'r') as f:
                    data = json.load(f)
                    self.trades = [
                        Trade(
                            symbol=t['symbol'],
                            direction=t['direction'],
                            entry=t['entry'],
                            exit=t.get('exit'),
                            entry_time=t['time'],
                            exit_time=None,
                            pnl=t.get('pnl'),
                            exit_reason=t.get('exitReason'),
                            strike=t.get('strike', 0),
                            expiration=t.get('expiration', ''),
                            contracts=t.get('contracts', 1)
                        )
                        for t in data.get('trades', [])
                    ]
                    self.price_history = data.get('price_history', [])
            except Exception as e:
                print(f"Error loading data: {e}")
    
    def calculate_rsi(self, prices: list[float]) -> float:
        """Calculate RSI from price history"""
        if len(prices) < self.rsi_period + 1:
            return 50.0
        
        deltas = np.diff(prices[-self.rsi_period-1:])
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        
        avg_gain = np.mean(gains)
        avg_loss = np.mean(losses)
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return float(rsi)
    
    def calculate_ema(self, prices: list[float], period: int) -> float:
        """Calculate EMA"""
        if len(prices) < period:
            return prices[-1] if prices else 0.0
        
        multiplier = 2 / (period + 1)
        ema = np.mean(prices[:period])
        
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        
        return float(ema)
    
    def calculate_atr(self, highs: list[float], lows: list[float], closes: list[float]) -> float:
        """Calculate Average True Range"""
        if len(closes) < 2:
            return 0.5
        
        tr_list = []
        for i in range(1, len(closes)):
            high = highs[i] if i < len(highs) else closes[i]
            low = lows[i] if i < len(lows) else closes[i]
            prev_close = closes[i-1]
            
            tr1 = high - low
            tr2 = abs(high - prev_close)
            tr3 = abs(low - prev_close)
            
            tr_list.append(max(tr1, tr2, tr3))
        
        return float(np.mean(tr_list[-14:])) if tr_list else 0.5
    
    def get_option_strike(self, price: float, direction: Literal["CALL", "PUT"]) -> float:
        """Get ATM or slightly OTM strike price"""
        atm = round(price)
        if direction == "CALL":
            return atm + 1
        else:
            return atm - 1
    
    def get_friday_expiration(self) -> str:
        """Get this Friday's expiration date"""
        today = datetime.now()
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0:
            days_until_friday = 7
        friday = today + timedelta(days=days_until_friday)
        return friday.strftime("%Y-%m-%d")
    
    def check_entry_signal(self, price: float, rsi: float, ema9: float, ema21: float, 
                          prev_price: float) -> Optional[Literal["CALL", "PUT"]]:
        """Check for entry signals"""
        if self.position:
            return None
        
        if rsi < self.oversold and price > ema9 and prev_price <= ema9:
            return "CALL"
        
        if rsi > self.overbought and price < ema9 and prev_price >= ema9:
            return "PUT"
        
        return None
    
    def check_exit_signal(self, price: float, position: Position, atr: float) -> Optional[str]:
        """Check for exit signals"""
        if position.direction == "CALL":
            if price <= position.stop_loss:
                return "STOP_LOSS"
            if price >= position.take_profit:
                return "TAKE_PROFIT"
        elif position.direction == "PUT":
            if price >= position.stop_loss:
                return "STOP_LOSS"
            if price <= position.take_profit:
                return "TAKE_PROFIT"
        return None
    
    def calculate_option_pnl(self, entry_price: float, exit_price: float, 
                            direction: Literal["CALL", "PUT"], 
                            contracts: int) -> float:
        """Calculate P&L for options trade"""
        if direction == "CALL":
            price_diff = exit_price - entry_price
        else:
            price_diff = entry_price - exit_price
        
        pnl = price_diff * 100 * contracts
        return round(pnl, 2)
    
    def fetch_price_data(self) -> dict:
        """Fetch price data from Yahoo Finance"""
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{self.symbol}"
            params = {"interval": "1m", "range": "1d"}
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            result = data["chart"]["result"][0]
            meta = result["meta"]
            timestamps = result["timestamp"]
            ohlcv = result["indicators"]["quote"][0]
            
            current_price = meta.get("regularMarketPrice", ohlcv["close"][-1])
            
            return {
                "price": current_price,
                "high": [h for h in ohlcv["high"] if h is not None],
                "low": [l for l in ohlcv["low"] if l is not None],
                "close": [c for c in ohlcv["close"] if c is not None]
            }
        except Exception as e:
            print(f"Error fetching data: {e}")
            # Fallback to last known price or default
            if self.price_history:
                last_price = self.price_history[-1]["price"]
                return {"price": last_price, "high": [last_price], "low": [last_price], "close": [last_price]}
            return {"price": 668.0, "high": [668.0], "low": [668.0], "close": [668.0]}
    
    def update_data_file(self):
        """Update the JSON data file for the dashboard"""
        prices = [p["price"] for p in self.price_history]
        
        if len(prices) >= 2:
            rsi = self.calculate_rsi(prices)
            ema9 = self.calculate_ema(prices, self.ema_fast)
            ema21 = self.calculate_ema(prices, self.ema_slow)
            
            highs = self.price_history[-1].get("highs", [])
            lows = self.price_history[-1].get("lows", [])
            atr = self.calculate_atr(highs, lows, prices) if highs and lows else 0.5
        else:
            rsi = 50.0
            ema9 = prices[-1] if prices else 668.0
            ema21 = prices[-1] if prices else 668.0
            atr = 0.5
        
        if self.position:
            signal = f"HOLDING {self.position.direction}"
        elif rsi < self.oversold:
            signal = "CALL SETUP"
        elif rsi > self.overbought:
            signal = "PUT SETUP"
        else:
            signal = "WAIT"
        
        data = {
            "status": "active" if self.position else "scanning",
            "total_trades": len(self.trades),
            "wins": sum(1 for t in self.trades if t.pnl and t.pnl > 0),
            "losses": sum(1 for t in self.trades if t.pnl and t.pnl < 0),
            "total_pnl": sum(t.pnl for t in self.trades if t.pnl),
            "trades": [
                {
                    "symbol": t.symbol,
                    "direction": t.direction,
                    "entry": t.entry,
                    "exit": t.exit,
                    "pnl": t.pnl,
                    "time": t.entry_time,
                    "exitReason": t.exit_reason,
                    "strike": t.strike,
                    "expiration": t.expiration,
                    "contracts": t.contracts
                }
                for t in self.trades[-10:]
            ],
            "current_position": {
                "symbol": self.position.symbol,
                "direction": self.position.direction,
                "entry_price": self.position.entry_price,
                "strike": self.position.strike,
                "expiration": self.position.expiration,
                "contracts": self.position.contracts,
                "stop_loss": self.position.stop_loss,
                "take_profit": self.position.take_profit,
                "entry_time": self.position.entry_time
            } if self.position else None,
            "metrics": {
                "spy_price": round(prices[-1], 2) if prices else 668.0,
                "rsi": round(rsi, 2),
                "atr": round(atr, 2),
                "ema9": round(ema9, 2),
                "ema21": round(ema21, 2),
                "signal": signal,
                "option_type": self.position.direction if self.position else None,
                "strike": self.position.strike if self.position else None,
                "expiration": self.position.expiration if self.position else None
            },
            "strategy": {
                "name": "RSI Mean Reversion Options Scalper",
                "description": "Trades CALLs on oversold bounces, PUTs on overbought drops",
                "call_entry": {
                    "condition": f"RSI < {self.oversold} (oversold) + price crosses above EMA9",
                    "option": "ATM or slightly OTM CALL",
                    "target": f"{self.tp_mult}x ATR move up",
                    "stop": f"{self.sl_mult}x ATR move down"
                },
                "put_entry": {
                    "condition": f"RSI > {self.overbought} (overbought) + price crosses below EMA9",
                    "option": "ATM or slightly OTM PUT",
                    "target": f"{self.tp_mult}x ATR move down",
                    "stop": f"{self.sl_mult}x ATR move up"
                },
                "position_size": f"${self.capital_per_trade} per trade (1-2 contracts)",
                "max_hold_time": "30 minutes"
            },
            "price_history": [
                {
                    "time": p["time"],
                    "price": p["price"],
                    "ema9": p.get("ema9"),
                    "ema21": p.get("ema21")
                }
                for p in self.price_history[-50:]
            ]
        }
        
        with open(self.data_file, 'w') as f:
            json.dump(data, f, indent=2)
    
    def run_cycle(self):
        """Run one trading cycle"""
        try:
            data = self.fetch_price_data()
            current_price = data["price"]
            highs = data["high"]
            lows = data["low"]
            closes = data["close"]
            
            self.price_history.append({
                "time": datetime.now().isoformat(),
                "price": current_price,
                "highs": highs,
                "lows": lows
            })
            
            if len(self.price_history) > self.max_history:
                self.price_history = self.price_history[-self.max_history:]
            
            prices = [p["price"] for p in self.price_history]
            rsi = self.calculate_rsi(prices)
            ema9 = self.calculate_ema(prices, self.ema_fast)
            ema21 = self.calculate_ema(prices, self.ema_slow)
            atr = self.calculate_atr(highs, lows, closes)
            
            self.price_history[-1]["ema9"] = ema9
            self.price_history[-1]["ema21"] = ema21
            
            prev_price = prices[-2] if len(prices) >= 2 else current_price
            
            if self.position:
                exit_reason = self.check_exit_signal(current_price, self.position, atr)
                if exit_reason:
                    pnl = self.calculate_option_pnl(
                        self.position.entry_price,
                        current_price,
                        self.position.direction,
                        self.position.contracts
                    )
                    
                    trade = Trade(
                        symbol=self.symbol,
                        direction=self.position.direction,
                        entry=self.position.entry_price,
                        exit=current_price,
                        entry_time=self.position.entry_time,
                        exit_time=datetime.now().strftime("%H:%M"),
                        pnl=pnl,
                        exit_reason=exit_reason,
                        strike=self.position.strike,
                        expiration=self.position.expiration,
                        contracts=self.position.contracts
                    )
                    self.trades.append(trade)
                    
                    print(f"🔔 EXIT: {self.position.direction} @ ${current_price:.2f} | {exit_reason} | P&L: ${pnl:.2f}")
                    self.position = None
            else:
                signal = self.check_entry_signal(current_price, rsi, ema9, ema21, prev_price)
                if signal:
                    strike = self.get_option_strike(current_price, signal)
                    expiration = self.get_friday_expiration()
                    contracts = max(1, int(self.capital_per_trade / 500))
                    
                    if signal == "CALL":
                        stop = current_price - (atr * self.sl_mult)
                        target = current_price + (atr * self.tp_mult)
                    else:
                        stop = current_price + (atr * self.sl_mult)
                        target = current_price - (atr * self.tp_mult)
                    
                    self.position = Position(
                        symbol=self.symbol,
                        direction=signal,
                        entry_price=current_price,
                        strike=strike,
                        expiration=expiration,
                        entry_time=datetime.now().strftime("%H:%M"),
                        contracts=contracts,
                        stop_loss=stop,
                        take_profit=target
                    )
                    
                    print(f"🚀 ENTRY: {signal} ${strike} {expiration} @ ${current_price:.2f} | Contracts: {contracts}")
            
            self.update_data_file()
            print(f"✅ Updated - Price: ${current_price:.2f} | RSI: {rsi:.1f} | Signal: {signal if not self.position else 'HOLDING ' + self.position.direction}")
            
        except Exception as e:
            print(f"Error in cycle: {e}")
    
    def run(self):
        """Main loop"""
        print(f"🦉 Options Scalper Started - Trading {self.symbol}")
        print(f"Strategy: RSI Mean Reversion (CALLs on oversold, PUTs on overbought)")
        print(f"Capital per trade: ${self.capital_per_trade}")
        print("-" * 50)
        
        while True:
            self.run_cycle()
            time.sleep(30)


if __name__ == "__main__":
    scalper = OptionsScalper(symbol="SPY", capital_per_trade=500)
    scalper.run()
