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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  let path = url.pathname.split('/dashboard')[1] || '/';
  // normalize: remove trailing slashes
  path = path.replace(/\/+$/, '');




  try {
    // Dashboard metrics
    if (path === '/metrics' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('dashboard_metrics')
        .select('*')
        .limit(1)
        .single();

      return new Response(
        JSON.stringify(data || {}),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Active loans
    if (path === '/active-loans' && req.method === 'GET') {
      const { data, error } = await supabase
        .from('active_loans_view')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cutoffs
    if (path === '/cutoffs' && req.method === 'GET') {
      const { data } = await supabase
        .from('cutoff_summary_view')
        .select('*')
        .order('cutoff_date', { ascending: false })
        .limit(10);

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analytics
    if (path === '/analytics/monthly-collections' && req.method === 'GET') {
      const { data } = await supabase
        .from('dashboard_monthly_collections')
        .select('*')
        .order('month', { ascending: true });

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/analytics/loan-distribution' && req.method === 'GET') {

      const { data } = await supabase
        .from('dashboard_loan_distribution')
        .select('*');

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/analytics/financial-trends' && req.method === 'GET') {
      const { data } = await supabase
        .from('dashboard_financial_trends')
        .select('*')
        .order('month', { ascending: true });

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/analytics/earnings-trends' && req.method === 'GET') {
      const { data } = await supabase
        .from('dashboard_earnings_trends')
        .select('*')
        .order('month', { ascending: true });

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (path === '/analytics/delinquency-reports' && req.method === 'GET') {
      const { data } = await supabase
        .from('dashboard_delinquency_reports')
        .select('*');

      return new Response(
        JSON.stringify(data || []),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );


  } catch (error) {
    console.error('Dashboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
