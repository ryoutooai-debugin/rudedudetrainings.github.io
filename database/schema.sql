-- Supabase Database Schema for Trading Leaderboard

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (pseudonymous)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name VARCHAR(32) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    last_trade_at TIMESTAMP WITH TIME ZONE
);

-- Trades table (every trade from every user)
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    strategy VARCHAR(32) DEFAULT 'EWO', -- 'EWO', 'CC', 'Manual', etc.
    entry_price DECIMAL(12, 4) NOT NULL,
    exit_price DECIMAL(12, 4),
    quantity INTEGER NOT NULL DEFAULT 1,
    pnl DECIMAL(12, 4), -- dollar amount
    pnl_pct DECIMAL(8, 4), -- percentage (e.g., 5.25 = 5.25%)
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    metadata JSONB DEFAULT '{}', -- signal data, confirmations, tier, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Leaderboard cache (updated periodically)
CREATE TABLE leaderboard_cache (
    id SERIAL PRIMARY KEY,
    timeframe VARCHAR(16) NOT NULL CHECK (timeframe IN ('daily', 'weekly', 'monthly', 'all_time')),
    period_start DATE,
    period_end DATE,
    rankings JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_trades_exit_time ON trades(exit_time);
CREATE INDEX idx_trades_entry_time ON trades(entry_time);
CREATE INDEX idx_leaderboard_cache_timeframe ON leaderboard_cache(timeframe, period_start);

-- Function to calculate user stats for a timeframe
CREATE OR REPLACE FUNCTION get_user_stats(
    p_user_id UUID,
    p_timeframe VARCHAR
)
RETURNS TABLE (
    total_pnl_pct DECIMAL,
    trade_count INTEGER,
    win_count INTEGER,
    win_rate DECIMAL,
    avg_return DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(t.pnl_pct), 0) as total_pnl_pct,
        COUNT(*)::INTEGER as trade_count,
        COUNT(*) FILTER (WHERE t.pnl_pct > 0)::INTEGER as win_count,
        CASE 
            WHEN COUNT(*) > 0 THEN 
                ROUND((COUNT(*) FILTER (WHERE t.pnl_pct > 0)::DECIMAL / COUNT(*) * 100), 2)
            ELSE 0 
        END as win_rate,
        COALESCE(AVG(t.pnl_pct), 0) as avg_return
    FROM trades t
    WHERE t.user_id = p_user_id
    AND t.status = 'closed'
    AND (
        p_timeframe = 'all_time' 
        OR (
            p_timeframe = 'monthly' 
            AND t.exit_time >= DATE_TRUNC('month', NOW())
        )
        OR (
            p_timeframe = 'weekly'
            AND t.exit_time >= DATE_TRUNC('week', NOW())
        )
        OR (
            p_timeframe = 'daily'
            AND t.exit_time >= DATE_TRUNC('day', NOW())
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to generate leaderboard rankings
CREATE OR REPLACE FUNCTION generate_leaderboard(p_timeframe VARCHAR)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
            'rank', row_number,
            'user_id', user_id,
            'display_name', display_name,
            'total_pnl_pct', total_pnl_pct,
            'trade_count', trade_count,
            'win_rate', win_rate,
            'avg_return', avg_return
        )
    ) INTO result
    FROM (
        SELECT 
            ROW_NUMBER() OVER (ORDER BY stats.total_pnl_pct DESC) as row_number,
            u.id as user_id,
            u.display_name,
            stats.total_pnl_pct,
            stats.trade_count,
            stats.win_rate,
            stats.avg_return
        FROM users u
        CROSS JOIN LATERAL get_user_stats(u.id, p_timeframe) stats
        WHERE stats.trade_count >= 5  -- Minimum 5 trades to qualify
        ORDER BY stats.total_pnl_pct DESC
        LIMIT 100
    ) ranked;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Users can read all users (for leaderboard)
CREATE POLICY "Users are viewable by everyone" ON users
    FOR SELECT USING (true);

-- Users can only insert their own user (handled by API)
CREATE POLICY "Users can create their own profile" ON users
    FOR INSERT WITH CHECK (true);

-- Trades are viewable by everyone (for leaderboard)
CREATE POLICY "Trades are viewable by everyone" ON trades
    FOR SELECT USING (true);

-- Only API can insert trades (using service role)
-- This is handled by the Netlify function using service key
