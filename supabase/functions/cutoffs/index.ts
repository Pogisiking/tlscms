import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
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
  const path = url.pathname.split('/cutoffs')[1] || '/';
  const userId = getUserId(req);

  try {
    // GET - List all cutoffs
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('cutoff_summary_view')
        .select('*')
        .order('cutoff_date', { ascending: false });

      if (error) {
        // If view doesn't exist, create it and return data
        console.log('Creating cutoff_summary_view...');

        await supabase.rpc('exec_sql', {
          query: `
            CREATE OR REPLACE VIEW cutoff_summary_view AS
            SELECT
              cp.*,
              COUNT(l.id) as borrower_count
            FROM cutoff_periods cp
            LEFT JOIN loans l ON cp.id = l.cutoff_period_id
            GROUP BY cp.id
            ORDER BY cp.cutoff_date DESC
          `
        });

        const { data: retryData } = await supabase
          .from('cutoff_summary_view')
          .select('*')
          .order('cutoff_date', { ascending: false });

        return new Response(
          JSON.stringify(retryData || []),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get single cutoff details
    const match = path.match(/^\/([a-f0-9-]+)$/);
    if (match && req.method === 'GET') {
      const cutoffId = match[1];

      const { data: cutoff, error } = await supabase
        .from('cutoff_periods')
        .select('*')
        .eq('id', cutoffId)
        .single();

      if (error || !cutoff) {
        return new Response(
          JSON.stringify({ error: 'Cutoff not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get loans for this cutoff
      const { data: loans } = await supabase
        .from('loans')
        .select('*, member:members(full_name, employee_id)')
        .eq('cutoff_period_id', cutoffId);

      return new Response(
        JSON.stringify({ ...cutoff, loans: loans || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update cutoff status
    const statusMatch = path.match(/^\/([a-f0-9-]+)\/status$/);
    if (statusMatch && req.method === 'PATCH') {
      const cutoffId = statusMatch[1];
      const body = await req.json();
      const { status } = body;

      if (!['open', 'closed'].includes(status)) {
        return new Response(
          JSON.stringify({ error: 'Invalid status. Must be "open" or "closed"' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('cutoff_periods')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', cutoffId)
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
        table_name: 'cutoff_periods',
        record_id: cutoffId,
        new_values: { status }
      });

      return new Response(
        JSON.stringify(data),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cutoffs error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
