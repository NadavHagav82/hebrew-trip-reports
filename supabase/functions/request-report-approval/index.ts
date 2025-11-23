import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestApprovalRequest {
  reportId: string;
  managerEmail: string;
  managerName: string;
  employeeName: string;
  reportDetails: {
    destination: string;
    startDate: string;
    endDate: string;
    purpose: string;
    totalAmount: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, managerEmail, managerName, employeeName, reportDetails }: RequestApprovalRequest = await req.json();

    console.log("Requesting approval for report:", reportId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique approval token
    const approvalToken = crypto.randomUUID();
    
    // Update report with approval token and status
    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'pending_approval',
        manager_approval_token: approvalToken,
        manager_approval_requested_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    if (updateError) {
      console.error("Error updating report:", updateError);
      throw updateError;
    }

    // Create approval URL
    const approvalUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app')}/approve-report/${approvalToken}`;

    // Send email to manager
    const emailResponse = await resend.emails.send({
      from: "דוחות נסיעות <onboarding@resend.dev>",
      to: [managerEmail],
      subject: `בקשת אישור דוח נסיעה - ${reportDetails.destination}`,
      html: `
        <div dir="rtl" style="font-family: 'Heebo', Arial, sans-serif; direction: rtl; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">בקשת אישור דוח נסיעה</h2>
          
          <p style="font-size: 16px; color: #333;">שלום ${managerName},</p>
          <p style="font-size: 14px; color: #666;">${employeeName} שלח/ה דוח נסיעה לאישור שלך.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">פרטי הדוח:</h3>
            <p style="margin: 10px 0;"><strong>יעד:</strong> ${reportDetails.destination}</p>
            <p style="margin: 10px 0;"><strong>תאריכים:</strong> ${reportDetails.startDate} - ${reportDetails.endDate}</p>
            <p style="margin: 10px 0;"><strong>מטרת הנסיעה:</strong> ${reportDetails.purpose}</p>
            <p style="margin: 10px 0;"><strong>סה"כ הוצאות:</strong> ₪${reportDetails.totalAmount.toFixed(2)}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${approvalUrl}" style="background-color: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              צפה ואשר דוח
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
            קישור זה תקף לצורך אישור דוח זה בלבד. אם לא ביקשת אישור זה, אנא התעלם ממייל זה.
          </p>
        </div>
      `,
    });

    console.log("Approval request email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in request-report-approval function:", error);
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
