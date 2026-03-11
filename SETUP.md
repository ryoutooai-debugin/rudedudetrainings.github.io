# Leaderboard Setup Guide

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Sign up (free tier)
3. Create new project
4. Wait for database to provision (~2 minutes)
5. Go to SQL Editor
6. Copy/paste contents of `database/schema.sql`
7. Click "Run"

## Step 2: Get Supabase Credentials

1. In Supabase, go to Settings → API
2. Copy:
   - **Project URL** (e.g., `https://abcdefgh12345678.supabase.co`)
   - **anon public** key
   - **service_role** key (keep secret!)

## Step 3: Create Netlify Account

1. Go to https://netlify.com
2. Sign up (free tier)
3. Connect GitHub account
4. "Add new site" → "Import an existing project"
5. Select your GitHub repo with this leaderboard code

## Step 4: Configure Environment Variables

In Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add these:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

## Step 5: Deploy

1. Push code to GitHub
2. Netlify auto-deploys
3. Your site is live at `https://your-site.netlify.app`

## Step 6: Test the API

```bash
# Create a test user
curl -X POST https://your-site.netlify.app/api/users \
  -H "Content-Type: application/json" \
  -d '{"display_name": "TestTrader"}'

# Submit a trade
curl -X POST https://your-site.netlify.app/api/trades \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID_FROM_ABOVE",
    "symbol": "SPY",
    "entry_price": 500.00,
    "exit_price": 510.00,
    "pnl": 100.00,
    "pnl_pct": 2.0,
    "entry_time": "2024-03-11T14:30:00Z",
    "exit_time": "2024-03-11T15:30:00Z",
    "status": "closed"
  }'

# View leaderboard
curl https://your-site.netlify.app/api/leaderboard?timeframe=monthly
```

## Python Integration

Add this to your trading bot to report trades:

```python
import requests
import os

LEADERBOARD_API = "https://your-site.netlify.app/api"

def report_trade(user_id, symbol, entry_price, exit_price, pnl, pnl_pct, 
                 entry_time, exit_time, status="closed", metadata=None):
    """Report a trade to the leaderboard"""
    
    payload = {
        "user_id": user_id,
        "symbol": symbol,
        "entry_price": entry_price,
        "exit_price": exit_price,
        "pnl": pnl,
        "pnl_pct": pnl_pct,
        "entry_time": entry_time.isoformat(),
        "exit_time": exit_time.isoformat() if exit_time else None,
        "status": status,
        "metadata": metadata or {}
    }
    
    try:
        response = requests.post(
            f"{LEADERBOARD_API}/trades",
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Failed to report trade: {e}")
        return None
```

## Free Tier Limits

**Supabase Free:**
- 500MB database
- 2GB egress/month
- 100,000 API calls/day

**Netlify Free:**
- 100GB bandwidth/month
- 125,000 function calls/month
- 300 build minutes/month

**Realistic usage:**
- 100 users × 10 trades/day = 1,000 trades/day
- Well within free limits

## Next Steps

1. Add user registration flow
2. Add authentication (optional)
3. Add real-time updates via WebSocket
4. Add more stats (drawdown, sharpe ratio, etc.)
