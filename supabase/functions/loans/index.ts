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

// Generate loan schedules
function generateSchedules(principalAmount: number, releaseDate: string, installmentAmount: number) {
  const schedules = [];
  const startDate = new Date(releaseDate);

  for (let i = 1; i <= 10; i++) {
    // Add 15 days for each installment (mid-month or end-month)
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (i * 15));

    schedules.push({
      installment_number: i,
      due_date: dueDate.toISOString().split('T')[0],
      amount_due: installmentAmount,
      status: 'pending',
      amount_paid: 0,
      is_missed: false,
      missed_carryover: 0
    });
  }

  return schedules;
}

// Get or create cutoff period
async function getOrCreateCutoff(releaseDate: string, userId: string | null) {
  const date = new Date(releaseDate);
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();

  // Determine cutoff type
  const cutoffType = day <= 15 ? 'mid_month' : 'end_month';
  let cutoffDate: Date;

  if (cutoffType === 'mid_month') {
    cutoffDate = new Date(year, month, 15);
  } else {
    // Last day of month
    cutoffDate = new Date(year, month + 1, 0);
  }

  // Check if cutoff exists
  const { data: existingCutoff } = await supabase
    .from('cutoff_periods')
    .select('*')
    .eq('cutoff_date', cutoffDate.toISOString().split('T')[0])
    .eq('cutoff_type', cutoffType)
    .single();

  if (existingCutoff) {
    return existingCutoff;
  }

  // Create new cutoff
  const { data: newCutoff, error } = await supabase
    .from('cutoff_periods')
    .insert({
      cutoff_date: cutoffDate.toISOString().split('T')[0],
      cutoff_type: cutoffType,
      status: 'open',
      max_lending: 10000,
      created_by: userId
    })
    .select()
    .single();

  return newCutoff;
}

async function shouldEnforceCutoffRules() {
  const { data } = await supabase
    .from('system_config')
    .select('config_value')
    .eq('config_key', 'enforce_cutoff_rules')
    .single();

  return data?.config_value !== false && data?.config_value !== 'false';
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/loans')[1] || '/';
  const userId = getUserId(req);

  try {
    // List loans
    if (path === '/' && req.method === 'GET') {
      const { search } = url;
      const params = new URLSearchParams(search);

      let query = supabase
        .from('loans')
        .select('*, member:members(*), cutoff_period:cutoff_periods(*)')
        .order('created_at', { ascending: false });

      // Apply filters
      const status = params.get('status');
      if (status) {
        query = query.eq('status', status);
      }

      const memberId = params.get('member_id');
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

    // Get single loan with schedules
    const match = path.match(/^\/([a-f0-9-]+)$/);
    if (match && req.method === 'GET') {
      const loanId = match[1];

      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('*, member:members(*), cutoff_period:cutoff_periods(*)')
        .eq('id', loanId)
        .single();

      if (loanError) {
        return new Response(
          JSON.stringify({ error: 'Loan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get schedules
      const { data: schedules } = await supabase
        .from('loan_schedules')
        .select('*')
        .eq('loan_id', loanId)
        .order('installment_number', { ascending: true });

      // Get payments
      const { data: payments } = await supabase
        .from('loan_payments')
        .select('*')
        .eq('loan_id', loanId)
        .order('payment_date', { ascending: false });

      return new Response(
        JSON.stringify({ ...loan, schedules, payments }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new loan
    if (path === '/' && req.method === 'POST') {
      const body = await req.json();
      const { member_id, principal_amount, release_date } = body;
      const enforceCutoffRules = await shouldEnforceCutoffRules();

      // Validate principal amount
      if (principal_amount !== 5000 && principal_amount !== 10000) {
        return new Response(
          JSON.stringify({ error: 'Invalid loan amount. Only ₱5,000 or ₱10,000 allowed.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // In historical/backfill mode, allow recording older loans even if the
      // member already has another active loan in the current records.
      if (enforceCutoffRules) {
        const { data: activeLoans } = await supabase
          .from('loans')
          .select('*')
          .eq('member_id', member_id)
          .in('status', ['active', 'delayed', 'pending']);

        if (activeLoans && activeLoans.length > 0) {
          return new Response(
            JSON.stringify({ error: 'Member already has an active loan.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Get or create cutoff period
      const cutoff = await getOrCreateCutoff(release_date, userId);

      if (!cutoff) {
        return new Response(
          JSON.stringify({ error: 'Could not create or find cutoff period' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if cutoff is still open and has capacity
      if (enforceCutoffRules && cutoff.status === 'closed') {
        return new Response(
          JSON.stringify({ error: 'CUTOFF CLOSED - Maximum lending reached for this period' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const remainingCapacity = cutoff.max_lending - cutoff.total_released;
      if (enforceCutoffRules && principal_amount > remainingCapacity) {
        return new Response(
          JSON.stringify({
            error: `INSUFFICIENT CUTOFF CAPACITY - Only ₱${remainingCapacity.toLocaleString()} remaining`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate loan details
      const totalPayable = principal_amount * 1.2;
      const installmentAmount = totalPayable / 10;

      // Generate loan ID
      const { data: loanIdResult } = await supabase.rpc('generate_loan_id');

      // Create loan
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert({
          loan_id: loanIdResult,
          member_id,
          cutoff_period_id: cutoff.id,
          principal_amount,
          total_payable: totalPayable,
          installment_amount: installmentAmount,
          remaining_balance: totalPayable,
          release_date,
          status: 'active',
          next_due_date: new Date(new Date(release_date).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single();

      if (loanError) {
        return new Response(
          JSON.stringify({ error: loanError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate and create schedules
      const schedules = generateSchedules(principal_amount, release_date, installmentAmount);
      const schedulesWithLoanId = schedules.map(s => ({ ...s, loan_id: loan.id }));

      await supabase
        .from('loan_schedules')
        .insert(schedulesWithLoanId);

      // Update member summary
      await supabase.rpc('update_member_summary', { target_member_id: member_id });

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'INSERT',
        table_name: 'loans',
        record_id: loan.id,
        new_values: { ...loan, schedules }
      });

      return new Response(
        JSON.stringify({ ...loan, schedules: schedulesWithLoanId }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Loans error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
