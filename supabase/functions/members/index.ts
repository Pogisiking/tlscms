import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getUserId(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    const tokenData = JSON.parse(atob(token));
    return tokenData.user_id;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const userId = getUserId(req);

  try {
    // GET - List members or get single member
    if (req.method === 'GET') {
      const id = searchParams.get('id');

      // Get single member by ID
      if (id) {
        const { data, error } = await supabase
          .from('member_summary_view')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Member not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify(data),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // List members with filters
      let query = supabase
        .from('member_summary_view')
        .select('*')
        .order('created_at', { ascending: false });

      const status = searchParams.get('status');
      if (status) {
        query = query.eq('status', status);
      }

      const searchQuery = searchParams.get('search');
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,employee_id.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create member
    if (req.method === 'POST') {
      const body = await req.json();

      const { data, error } = await supabase
        .from('members')
        .insert({
          ...body,
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'INSERT',
        table_name: 'members',
        record_id: data.id,
        new_values: data
      });

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PUT - Update member
    if (req.method === 'PUT') {
      const body = await req.json();
      const memberId = body.id;

      if (!memberId) {
        return new Response(
          JSON.stringify({ error: 'Member ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get old values first
      const { data: oldData } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();

      const { data, error } = await supabase
        .from('members')
        .update({
          ...body,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', memberId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE',
        table_name: 'members',
        record_id: memberId,
        old_values: oldData,
        new_values: data
      });

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Deactivate member
    if (req.method === 'DELETE') {
      const memberId = searchParams.get('id');

      if (!memberId) {
        return new Response(
          JSON.stringify({ error: 'Member ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('members')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', memberId)
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'DEACTIVATE',
        table_name: 'members',
        record_id: memberId,
        old_values: { status: 'active' },
        new_values: { status: 'inactive' }
      });

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Members error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
