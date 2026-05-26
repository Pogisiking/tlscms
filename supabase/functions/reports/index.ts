
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

  const path = url.pathname.split('/reports')[1] || '/';



  try {

    // Share Capital Report

    if (path === '/share-capital' && req.method === 'GET') {

      const { data, error } = await supabase

        .from('share_capitals')

        .select('*, member:members(employee_id, full_name, position)');



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



    // Active Loans Report

    if (path === '/active-loans' && req.method === 'GET') {

      const { data, error } = await supabase

        .from('active_loans_view')

        .select('*');



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



    // Fully Paid Loans Report

    if ((path === '/fully-paid-loans' || path === '/fully-paid') && req.method === 'GET') {



      const { data, error } = await supabase

        .from('loans')

        .select('*, member:members(employee_id, full_name, position), cutoff_period:cutoff_periods(*)')

        .eq('status', 'fully_paid');



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



    // Delayed Payments Report

    if (path === '/delayed-payments' && req.method === 'GET') {

      const { data, error } = await supabase

        .from('loans')

        .select('*, member:members(employee_id, full_name, position, contact_number)')

        .eq('status', 'delayed');



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



    // Collection Report

    if (path === '/collections' && req.method === 'GET') {

      const params = new URLSearchParams(url.search);

      const startDate = params.get('start_date');

      const endDate = params.get('end_date');



      let query = supabase

        .from('loan_payments')

        .select('*, loan:loans(loan_id, member:members(employee_id, full_name))')

        .order('payment_date', { ascending: false });



      if (startDate) {

        query = query.gte('payment_date', startDate);

      }

      if (endDate) {

        query = query.lte('payment_date', endDate);

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



    // Cutoff Summary Report

    if (path === '/cutoff-summary' && req.method === 'GET') {

      const { data, error } = await supabase

        .from('cutoff_summary_view')

        .select('*')

        .order('cutoff_date', { ascending: false });



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



    // Member Loan History

    // GET /member/:memberId

    const memberMatch = path.match(/^\/member\/([a-f0-9-]+)$/);

    if (memberMatch && req.method === 'GET') {

      const memberId = memberMatch[1];

      const params = new URLSearchParams(url.search);

      const startDate = params.get('start_date');

      const endDate = params.get('end_date');



      let query = supabase

        .from('loans')

        .select('*, cutoff_period:cutoff_periods(*)')

        .eq('member_id', memberId)

        .order('created_at', { ascending: false });



      if (startDate) query = query.gte('created_at', startDate);

      if (endDate) query = query.lte('created_at', endDate);



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



    // Missed Payment Report

    // GET /missed-payments?start_date=&end_date=

    if (path === '/missed-payments' && req.method === 'GET') {



      const params = new URLSearchParams(url.search);

      const startDate = params.get('start_date');

      const endDate = params.get('end_date');



      // Prefer a view if it exists; fallback to loan_payments criteria would be implemented later.

      let query = supabase.from('delayed_payments_view').select('*').order('due_date', { ascending: true });

      if (startDate) query = query.gte('due_date', startDate);

      if (endDate) query = query.lte('due_date', endDate);



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



   