import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!jwt) {
      return json({ error: 'Missing/invalid Authorization Bearer token' }, 401);
    }

    let tokenData: any;
    try {
      // Robust base64 decoding for custom JWT format
      const base64 = jwt.replace(/-/g, '+').replace(/_/g, '/');
      tokenData = JSON.parse(atob(base64));
    } catch {
      return json({ error: 'Invalid or malformed token format' }, 401);
    }

    if (!tokenData) {
      return json({ error: 'Token decoded to empty/invalid JSON' }, 401);
    }

    if (!tokenData.exp) {
      return json({ error: 'Token missing expiration (exp)' }, 401);
    }

    if (tokenData.exp < Date.now()) {
      return json({ error: 'Token expired', exp: tokenData.exp }, 401);
    }

    if (!tokenData.user_id) {
      return json({ error: 'Token missing user_id' }, 403);
    }

    // Role Helper: Fetch role name for permission checks
    const getRole = async () => {
      if (!tokenData.user_id) return null;
      const { data: userRow } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', tokenData.user_id)
        .maybeSingle();
      if (!userRow?.role_id) return null;
      const { data: role } = await supabase
        .from('roles')
        .select('name')
        .eq('id', userRow.role_id)
        .maybeSingle();
      return role?.name ?? null;
    };

    // GET /shares - List all share capitals
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('share_capitals')
        .select('*, member:members(full_name, employee_id)')
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return json(data);
    }

    // POST /shares - Record new contribution
    if (req.method === 'POST') {
      const body = await req.json();
      
      // Resolve employee_id to member_id if needed (for Excel imports)
      if (body.employee_id && !body.member_id) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('employee_id', body.employee_id)
          .single();
        if (member) {
          body.member_id = member.id;
          delete body.employee_id;
        } else {
          return json({ error: `Member with employee ID ${body.employee_id} not found` }, 404);
        }
      }

      const { data, error } = await supabase
        .from('share_capitals')
        .insert({
          ...body,
          created_by: tokenData.user_id,
          updated_by: tokenData.user_id,
        })
        .select()
        .single();

      if (error) throw error;
      return json(data);
    }

    // DELETE /shares?id=... - Delete a contribution
    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id parameter is required' }, 400);

      const role = await getRole();
      if (role !== 'admin') {
        return json({ error: 'Forbidden: Only administrators can delete contributions' }, 403);
      }

      const { error } = await supabase
        .from('share_capitals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return json({ ok: true });
    }

    return json({ 
      error: `Method ${req.method} not allowed on this path`,
      path: url.pathname 
    }, 405);
  } catch (err) {
    console.error('Shares error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500);
  }
});