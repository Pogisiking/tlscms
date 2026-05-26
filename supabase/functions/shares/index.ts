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
    // GET - List share capitals
    if (req.method === 'GET') {
      const memberId = searchParams.get('member_id');

      let query = supabase
        .from('share_capitals')
        .select('*, member:members(id, employee_id, full_name, position)')
        .order('payment_date', { ascending: false });

      if (memberId) {
        query = query.eq('member_id', memberId);
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

    // POST - Create share capital
    if (req.method === 'POST') {
      const body = await req.json();
      const { member_id, amount, payment_date, notes } = body;

      if (!member_id || !amount || !payment_date) {
        return new Response(
          JSON.stringify({ error: 'Member ID, amount, and payment date are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate receipt number
      const receiptNumber = `SC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-5)}`;

      // Create share capital record
      const { data, error } = await supabase
        .from('share_capitals')
        .insert({
          member_id,
          amount: Number(amount),
          payment_date,
          notes: notes || null,
          receipt_number: receiptNumber,
          created_by: userId,
        })
        .select('*, member:members(id, employee_id, full_name, position)')
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update member's share capital amount
      await supabase
        .from('members')
        .update({
          share_capital_amount: Number(amount),
          updated_at: new Date().toISOString()
        })
        .eq('id', member_id);

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'INSERT',
        table_name: 'share_capitals',
        record_id: data.id,
        new_values: data
      });

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Shares error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
