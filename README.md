# Leaderboard System

Pseudonymous trading leaderboard with monthly & all-time rankings.

## Stack
- **Frontend:** React + Vite (deployed to Netlify)
- **Backend:** Netlify Edge Functions (serverless)
- **Database:** Supabase (PostgreSQL)

## Setup

### 1. Supabase Setup
```bash
# Create tables in Supabase SQL Editor
\i database/schema.sql
```

### 2. Environment Variables (Netlify)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 3. Deploy
```bash
# Push to GitHub, Netlify auto-deploys
git push origin main
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leaderboard` | GET | Get rankings (monthly/all_time) |
| `/api/trades` | POST | Submit a new trade |
| `/api/users` | POST | Register new user |
| `/api/users/me` | GET | Get current user stats |

## Database Schema

See `database/schema.sql`
