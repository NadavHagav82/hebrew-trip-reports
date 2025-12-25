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
  generalComment?: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get authorization header for user verification
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "לא מורשה - יש להתחבר למערכת" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create client with user's JWT to get authenticated user
    const supabaseAuth = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication failed:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "אימות נכשל - יש להתחבר מחדש" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    // Service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { token, expenseReviews, generalComment }: ApproveReportRequest = await req.json();

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

    // Find report by token
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*, profiles!reports_user_id_fkey(id, username, accounting_manager_email, full_name, manager_id)')
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

    // CRITICAL: Verify the authenticated user is the manager of the report owner
    const reportOwnerManagerId = report.profiles?.manager_id;
    
    if (reportOwnerManagerId !== user.id) {
      console.error(`Authorization failed: User ${user.id} is not the manager (${reportOwnerManagerId}) of report owner`);
      return new Response(
        JSON.stringify({ success: false, error: "אינך המנהל של עובד זה - אין הרשאה לאשר את הדוח" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Authorization verified: User ${user.id} is the manager of report owner`);

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
      manager_general_comment: generalComment || null,
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

    // Add history record with actual approver's user ID
    const historyAction = allApproved ? 'approved' : 'rejected';
    const historyNotes = allApproved 
      ? `המנהל אישר את כל ההוצאות${generalComment ? `: ${generalComment}` : ''}`
      : `המנהל דחה חלק מההוצאות. ${rejectedCount} נדחו, ${approvedCount} אושרו${generalComment ? `. הערה כללית: ${generalComment}` : ''}`;
    
    await supabase.from('report_history').insert({
      report_id: report.id,
      action: historyAction,
      performed_by: user.id, // Use authenticated manager's ID, not report owner
      notes: historyNotes,
    });

    // Send notification email to employee
    try {
      const { error: notifyError } = await supabase.functions.invoke('notify-employee-review', {
        body: {
          employeeEmail: report.profiles.username,
          employeeName: report.profiles.full_name,
          reportId: report.id,
          reportDetails: {
            destination: report.trip_destination,
            startDate: report.trip_start_date,
            endDate: report.trip_end_date,
            totalAmount: report.total_amount_ils,
          },
          expenseReviews,
          generalComment,
          allApproved,
        }
      });

      if (notifyError) {
        console.error('Error sending employee notification:', notifyError);
      }
    } catch (emailError) {
      console.error('Failed to send employee notification:', emailError);
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

    console.log(`Report review completed by manager ${user.id}: ${approvedCount} approved, ${rejectedCount} rejected`);

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
