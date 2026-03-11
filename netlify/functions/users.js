// netlify/functions/users.js
// POST /api/users - Create/update anonymous user
// GET /api/users/me - Get current user stats

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export default async (request, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /api/users/me?user_id=xxx
    if (request.method === 'GET' && path.endsWith('/me')) {
      const userId = url.searchParams.get('user_id');
      const timeframe = url.searchParams.get('timeframe') || 'monthly';
      
      if (!userId) {
        return new Response(JSON.stringify({ error: 'user_id required' }), {
          headers,
          status: 400
        });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Get user info
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Get user stats
      const { data: stats, error: statsError } = await supabase.rpc('get_user_stats', {
        p_user_id: userId,
        p_timeframe: timeframe
      });

      if (statsError) throw statsError;

      // Get user's rank
      const { data: rankings } = await supabase.rpc('generate_leaderboard', {
        p_timeframe: timeframe
      });

      const userRank = rankings?.findIndex(r => r.user_id === userId);

      return new Response(JSON.stringify({
        user,
        stats: stats?.[0] || {},
        rank: userRank !== -1 ? userRank + 1 : null,
        timeframe
      }), { headers });
    }

    // POST /api/users - Create or update anonymous user
    if (request.method === 'POST') {
      const body = await request.json();
      const { user_id, display_name } = body;

      // Validate display_name if provided
      if (display_name) {
        if (display_name.length < 3 || display_name.length > 32) {
          return new Response(JSON.stringify({ 
            error: 'display_name must be 3-32 characters' 
          }), { headers, status: 400 });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(display_name)) {
          return new Response(JSON.stringify({ 
            error: 'display_name can only contain letters, numbers, and underscores' 
          }), { headers, status: 400 });
        }
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // If user_id provided, update existing user
      if (user_id) {
        const updates = {};
        if (display_name) updates.display_name = display_name;
        
        const { data, error } = await supabase
          .from('users')
          .update(updates)
          .eq('id', user_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({
          success: true,
          user: data,
          message: 'User updated'
        }), { headers });
      }

      // Create new anonymous user
      const { data, error } = await supabase
        .from('users')
        .insert({ 
          display_name: display_name || `Trader_${Math.random().toString(36).substring(2, 8)}`
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          return new Response(JSON.stringify({ 
            error: 'Display name already taken' 
          }), { headers, status: 409 });
        }
        throw error;
      }

      return new Response(JSON.stringify({
        success: true,
        user: data,
        message: 'Anonymous user created',
        notice: 'Your trader ID is stored in this browser. Clearing cookies will create a new identity.'
      }), { headers, status: 201 });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers,
      status: 405
    });

  } catch (error) {
    console.error('Users error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers,
      status: 500
    });
  }
};
