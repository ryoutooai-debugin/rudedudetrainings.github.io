// netlify/functions/trades.js
// POST /api/trades - Submit a new trade

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Service role for writes

export default async (request, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers,
      status: 405
    });
  }

  try {
    const body = await request.json();
    const {
      user_id,
      symbol,
      strategy = 'EWO',
      entry_price,
      exit_price,
      quantity = 1,
      pnl,
      pnl_pct,
      entry_time,
      exit_time,
      status = 'open',
      metadata = {}
    } = body;

    // Validation
    if (!user_id || !symbol || !entry_price || !entry_time) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: user_id, symbol, entry_price, entry_time' 
      }), { headers, status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('trades')
      .insert({
        user_id,
        symbol: symbol.toUpperCase(),
        strategy,
        entry_price,
        exit_price,
        quantity,
        pnl,
        pnl_pct,
        entry_time,
        exit_time,
        status,
        metadata
      })
      .select()
      .single();

    if (error) throw error;

    // Update user's last_trade_at
    await supabase
      .from('users')
      .update({ last_trade_at: new Date().toISOString() })
      .eq('id', user_id);

    return new Response(JSON.stringify({
      success: true,
      trade: data
    }), { headers, status: 201 });

  } catch (error) {
    console.error('Trade submission error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers,
      status: 500
    });
  }
};
