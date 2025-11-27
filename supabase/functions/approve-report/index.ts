import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpenseReview {
  expenseId: string;
  status: 'approved' | 'rejected';
  comment: string;
}

interface ApproveReportRequest {
  token: string;
  expenseReviews: ExpenseReview[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, expenseReviews }: ApproveReportRequest = await req.json();

    console.log(`Processing expense reviews for report with token:`, token);
    console.log(`Number of reviews:`, expenseReviews?.length);

    if (!expenseReviews || expenseReviews.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "לא התקבלו ביקורות הוצאות" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find report by token
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*, profiles!reports_user_id_fkey(username, accounting_manager_email, full_name)')
      .eq('manager_approval_token', token)
      .single();

    if (fetchError || !report) {
      console.error("Report not found or error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "דוח לא נמצא או אישור לא תקף" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if already processed
    if (report.status !== 'pending_approval') {
      return new Response(
        JSON.stringify({ success: false, error: "דוח כבר אושר או נדחה" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update each expense with its review
    for (const review of expenseReviews) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          approval_status: review.status,
          manager_comment: review.comment || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', review.expenseId)
        .eq('report_id', report.id);

      if (updateError) {
        console.error(`Error updating expense ${review.expenseId}:`, updateError);
        throw updateError;
      }
    }

    // Check if all expenses were approved
    const approvedCount = expenseReviews.filter(r => r.status === 'approved').length;
    const rejectedCount = expenseReviews.filter(r => r.status === 'rejected').length;
    const allApproved = rejectedCount === 0;

    let newStatus = allApproved ? 'closed' : 'open';
    let updateData: any = {
      status: newStatus,
      manager_approval_token: null, // Clear token after use
    };

    if (allApproved) {
      updateData.approved_at = new Date().toISOString();
    } else {
      // Create a summary of rejected expenses for the rejection reason
      const rejectedExpenses = expenseReviews
        .filter(r => r.status === 'rejected')
        .map(r => `- ${r.comment}`)
        .join('\n');
      updateData.rejection_reason = `חלק מההוצאות נדחו:\n${rejectedExpenses}`;
      updateData.manager_approval_requested_at = null;
    }

    // Update report status
    const { error: reportUpdateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', report.id);

    if (reportUpdateError) {
      console.error("Error updating report:", reportUpdateError);
      throw reportUpdateError;
    }

    // If all approved, send to accounting
    if (allApproved) {
      const { error: emailError } = await supabase.functions.invoke('send-accounting-report', {
        body: {
          userEmail: report.profiles.username,
          accountingEmail: report.profiles.accounting_manager_email,
          reportId: report.id,
          reportDetails: {
            destination: report.trip_destination,
            startDate: report.trip_start_date,
            endDate: report.trip_end_date,
            totalAmount: report.total_amount_ils,
            employeeName: report.profiles.full_name,
          }
        }
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    console.log(`Report review completed: ${approvedCount} approved, ${rejectedCount} rejected`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        allApproved,
        approvedCount,
        rejectedCount,
        message: allApproved ? 'הדוח אושר בהצלחה' : 'הביקורת הושלמה, הדוח הוחזר לעובד'
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in approve-report function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
