import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportEmailRequest {
  reportId: string;
  accountingEmail: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { reportId, accountingEmail }: ReportEmailRequest = await req.json();

    console.log('Fetching report details for:', reportId);

    // Fetch report details with user profile
    const { data: report, error: reportError } = await supabaseClient
      .from('reports')
      .select(`
        *,
        profiles!reports_user_id_fkey (
          full_name,
          employee_id,
          department
        )
      `)
      .eq('id', reportId)
      .single();

    if (reportError) {
      console.error('Error fetching report:', reportError);
      throw new Error(`Failed to fetch report: ${reportError.message}`);
    }

    if (!report) {
      throw new Error('Report not found');
    }

    // Fetch expenses for this report
    const { data: expenses, error: expensesError } = await supabaseClient
      .from('expenses')
      .select('*')
      .eq('report_id', reportId);

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
    }

    const totalExpenses = expenses?.length || 0;
    const totalAmount = report.total_amount_ils || 0;

    // Format dates
    const startDate = new Date(report.trip_start_date).toLocaleDateString('he-IL');
    const endDate = new Date(report.trip_end_date).toLocaleDateString('he-IL');
    const submittedDate = report.submitted_at 
      ? new Date(report.submitted_at).toLocaleDateString('he-IL', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'לא הוגש';

    const approvedDate = report.approved_at
      ? new Date(report.approved_at).toLocaleDateString('he-IL', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : null;

    const statusText = report.status === 'closed' ? 'אושר' : 'הוגש';
    const statusColor = report.status === 'closed' ? '#10b981' : '#f59e0b';

    console.log('Sending email to:', accountingEmail);

    const emailResponse = await resend.emails.send({
      from: "Travel Reports <onboarding@resend.dev>",
      to: [accountingEmail],
      subject: `דוח נסיעה ${statusText} - ${report.profiles.full_name}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
          <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: ${statusColor}; margin: 0;">דוח נסיעה ${statusText}</h1>
              <div style="display: inline-block; background-color: ${statusColor}; color: white; padding: 8px 20px; border-radius: 20px; margin-top: 15px; font-weight: bold;">
                ${statusText}
              </div>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                פרטי העובד
              </h2>
              <p style="margin: 10px 0;"><strong>שם:</strong> ${report.profiles.full_name}</p>
              <p style="margin: 10px 0;"><strong>מספר עובד:</strong> ${report.profiles.employee_id}</p>
              <p style="margin: 10px 0;"><strong>מחלקה:</strong> ${report.profiles.department}</p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                פרטי הנסיעה
              </h2>
              <p style="margin: 10px 0;"><strong>יעד:</strong> ${report.trip_destination}</p>
              <p style="margin: 10px 0;"><strong>מטרה:</strong> ${report.trip_purpose}</p>
              <p style="margin: 10px 0;"><strong>תאריכי הנסיעה:</strong> ${startDate} - ${endDate}</p>
              ${report.notes ? `<p style="margin: 10px 0;"><strong>הערות:</strong> ${report.notes}</p>` : ''}
            </div>

            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #10b981;">
              <h2 style="color: #059669; margin-top: 0; font-size: 18px; border-bottom: 2px solid #86efac; padding-bottom: 10px;">
                סיכום כספי
              </h2>
              <p style="margin: 10px 0;"><strong>מספר הוצאות:</strong> ${totalExpenses}</p>
              <p style="margin: 10px 0; font-size: 20px; color: #059669;">
                <strong>סה"כ לתשלום:</strong> ₪${totalAmount.toLocaleString('he-IL')}
              </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e293b; margin-top: 0; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">
                מידע נוסף
              </h2>
              <p style="margin: 10px 0;"><strong>תאריך הגשה:</strong> ${submittedDate}</p>
              ${approvedDate ? `<p style="margin: 10px 0;"><strong>תאריך אישור:</strong> ${approvedDate}</p>` : ''}
              <p style="margin: 10px 0;"><strong>סטטוס:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
                מייל זה נשלח אוטומטית ממערכת דוחות הנסיעה
              </p>
              <p style="color: #64748b; font-size: 14px; margin: 5px 0;">
                לצפייה מלאה בדוח ובקבלות, אנא היכנסו למערכת
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.data?.id }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-accounting-report function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
