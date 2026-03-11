// netlify/functions/leaderboard.js
// GET /api/leaderboard?timeframe=monthly|all_time

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export default async (request, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers,
      status: 405
    });
  }

  try {
    const url = new URL(request.url);
    const timeframe = url.searchParams.get('timeframe') || 'monthly';
    
    if (!['daily', 'weekly', 'monthly', 'all_time'].includes(timeframe)) {
      return new Response(JSON.stringify({ error: 'Invalid timeframe' }), {
        headers,
        status: 400
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache first (updated every 5 minutes)
    const { data: cached } = await supabase
      .from('leaderboard_cache')
      .select('rankings, updated_at')
      .eq('timeframe', timeframe)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const cacheAge = cached ? Date.now() - new Date(cached.updated_at).getTime() : Infinity;
    const maxCacheAge = 5 * 60 * 1000; // 5 minutes

    if (cached && cacheAge < maxCacheAge) {
      return new Response(JSON.stringify({
        timeframe,
        rankings: cached.rankings,
        cached: true,
        updated_at: cached.updated_at
      }), { headers });
    }

    // Generate fresh leaderboard
    const { data: rankings, error } = await supabase.rpc('generate_leaderboard', {
      p_timeframe: timeframe
    });

    if (error) throw error;

    // Update cache
    await supabase.from('leaderboard_cache').insert({
      timeframe,
      rankings: rankings || [],
      period_start: timeframe === 'monthly' ? new Date().toISOString().slice(0, 7) + '-01' : null
    });

    return new Response(JSON.stringify({
      timeframe,
      rankings: rankings || [],
      cached: false,
      updated_at: new Date().toISOString()
    }), { headers });

  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers,
      status: 500
    });
  }
};
