import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExpenseReview {
  expenseId: string;
  status: 'approved' | 'rejected';
  comment: string;
}

interface NotifyEmployeeRequest {
  employeeEmail: string;
  employeeName: string;
  reportId: string;
  reportDetails: {
    destination: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
  };
  expenseReviews: ExpenseReview[];
  generalComment?: string | null;
  allApproved: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      employeeEmail,
      employeeName,
      reportId,
      reportDetails,
      expenseReviews,
      generalComment,
      allApproved,
    }: NotifyEmployeeRequest = await req.json();

    console.log(`Sending review notification to employee: ${employeeEmail}`);

    const approvedCount = expenseReviews.filter(r => r.status === 'approved').length;
    const rejectedCount = expenseReviews.filter(r => r.status === 'rejected').length;

    // Build email content
    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: rtl;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">
            ${allApproved ? '✓ הדוח שלך אושר!' : '📋 הדוח שלך נבדק'}
          </h1>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px; margin-bottom: 20px;">שלום ${employeeName},</p>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            ${allApproved 
              ? 'המנהל שלך בדק את הדוח ואישר את כל ההוצאות! הדוח נשלח להנהלת חשבונות לעיבוד.' 
              : 'המנהל שלך בדק את הדוח. חלק מההוצאות אושרו וחלק נדחו. אנא בדוק את הפרטים והוסף הבהרות במידת הצורך.'}
          </p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #1f2937;">פרטי הדוח</h3>
            <p style="margin: 5px 0;"><strong>יעד:</strong> ${reportDetails.destination}</p>
            <p style="margin: 5px 0;"><strong>תאריכים:</strong> ${reportDetails.startDate} - ${reportDetails.endDate}</p>
            <p style="margin: 5px 0;"><strong>סכום כולל:</strong> ₪${reportDetails.totalAmount.toFixed(2)}</p>
          </div>
          
          ${generalComment ? `
            <div style="background: #fef3c7; border-right: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
              <h4 style="margin-top: 0; color: #92400e;">הערת מנהל על הדוח:</h4>
              <p style="margin: 0; color: #78350f; white-space: pre-wrap;">${generalComment}</p>
            </div>
          ` : ''}
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #1f2937;">תוצאות הביקורת</h3>
            <div style="display: flex; gap: 20px; margin-bottom: 15px;">
              <div style="flex: 1; text-align: center; padding: 15px; background: #dcfce7; border-radius: 8px;">
                <div style="font-size: 32px; font-weight: bold; color: #166534;">${approvedCount}</div>
                <div style="color: #166534; font-size: 14px;">הוצאות אושרו</div>
              </div>
              ${rejectedCount > 0 ? `
                <div style="flex: 1; text-align: center; padding: 15px; background: #fee2e2; border-radius: 8px;">
                  <div style="font-size: 32px; font-weight: bold; color: #991b1b;">${rejectedCount}</div>
                  <div style="color: #991b1b; font-size: 14px;">הוצאות נדחו</div>
                </div>
              ` : ''}
            </div>
          </div>
          
          ${rejectedCount > 0 ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #991b1b;">הוצאות שנדחו - נדרשת תשומת לב</h3>
              ${expenseReviews
                .filter(r => r.status === 'rejected')
                .map(review => `
                  <div style="background: #fee2e2; border-right: 4px solid #dc2626; padding: 12px; margin-bottom: 10px; border-radius: 4px;">
                    <p style="margin: 0; color: #7f1d1d; font-weight: bold;">הערת מנהל:</p>
                    <p style="margin: 5px 0 0 0; color: #991b1b;">${review.comment || 'ללא הערה'}</p>
                  </div>
                `).join('')}
            </div>
          ` : ''}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${Deno.env.get('SUPABASE_URL')?.replace('/rest/v1', '') || 'https://app.lovable.dev'}/reports/${reportId}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              ${allApproved ? 'צפה בדוח המאושר' : 'צפה בדוח ועדכן הבהרות'}
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #6b7280; text-align: center;">
            מייל אוטומטי ממערכת ניהול דוחות נסיעות
          </p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "דוחות נסיעות <onboarding@resend.dev>",
      to: [employeeEmail],
      subject: allApproved 
        ? `✓ הדוח שלך לנסיעה ל${reportDetails.destination} אושר!`
        : `📋 הדוח שלך לנסיעה ל${reportDetails.destination} נבדק`,
      html: emailHtml,
    });

    console.log("Employee notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-employee-review function:", error);
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
