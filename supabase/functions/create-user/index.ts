import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// This function's real access control is the admin bearer-token check below
// (lines ~66-77) — that runs for every caller, browser or not, since CORS is
// a browser-only enforcement mechanism. `Access-Control-Allow-Origin: '*'`
// still mattered as defense-in-depth: it let ANY web page embed a call to
// this user-creation endpoint using an admin's authenticated browser session
// (a CSRF-adjacent vector) and actually read the response. Locking it to the
// app's own origin closes that off without weakening the real check.
//
// ALLOWED_ORIGINS can be overridden by setting the ALLOWED_ORIGINS secret
// (comma-separated) via `supabase secrets set` or the dashboard, e.g. when a
// custom domain is added later — no code change needed for that case.
const DEFAULT_ALLOWED_ORIGINS = ['https://qtech-crm.vercel.app'];
const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',').map((o) => o.trim()).filter(Boolean);
const ALLOWED_ORIGINS = new Set(configuredOrigins.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS);

function corsHeadersFor(req: Request): HeadersInit {
  const origin = req.headers.get('Origin');
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { name, email, password, role } = await req.json();

    // Validate inputs
    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: 'name, email, password and role are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['sales', 'engineer'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Role must be sales or engineer' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create admin client with service_role key (server-side only)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify the calling user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller is admin in public.users
    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Only admins can create users' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can log in immediately
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert profile — handles the case where a DB trigger auto-created
    // a blank row before this function ran (trigger conflict)
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .upsert({ id: authData.user.id, name, email, role }, { onConflict: 'id' });

    if (profileError) {
      // Rollback: delete the auth user if profile creation failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: authData.user.id, name, email, role } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
