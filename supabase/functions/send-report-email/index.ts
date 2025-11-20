import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import React from "https://esm.sh/react@18.3.1";
import { renderToStream } from "https://esm.sh/@react-pdf/renderer@4.3.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendReportEmailRequest {
  recipientEmail: string;
  reportId: string;
  reportData: {
    report: any;
    expenses: any[];
    profile: any;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, reportId, reportData }: SendReportEmailRequest = await req.json();

    console.log("Sending report email to:", recipientEmail);
    console.log("Report data received:", {
      reportId,
      expensesCount: reportData.expenses.length,
      hasProfile: !!reportData.profile,
    });

    const { report, expenses } = reportData;

    // Generate PDF in the edge function (server-side) - will be implemented separately
    // For now, send email without PDF attachment
    const reportDetails = {
      destination: report.trip_destination,
      startDate: new Date(report.trip_start_date).toLocaleDateString('he-IL'),
      endDate: new Date(report.trip_end_date).toLocaleDateString('he-IL'),
      purpose: report.trip_purpose,
      totalAmount: report.total_amount_ils || 0,
    };

    const emailResponse = await resend.emails.send({
      from: "דוחות נסיעות <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `דוח נסיעה - ${reportDetails.destination}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; direction: rtl; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">דוח נסיעה - ${reportDetails.destination}</h2>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>יעד:</strong> ${reportDetails.destination}</p>
            <p style="margin: 10px 0;"><strong>תאריכים:</strong> ${reportDetails.startDate} - ${reportDetails.endDate}</p>
            <p style="margin: 10px 0;"><strong>מטרת הנסיעה:</strong> ${reportDetails.purpose}</p>
            <p style="margin: 10px 0;"><strong>סה"כ הוצאות:</strong> ${reportDetails.totalAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪</p>
          </div>
          
          <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #1a1a1a; margin-bottom: 15px;">פירוט הוצאות:</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9f9f9; border-bottom: 2px solid #e0e0e0;">
                  <th style="padding: 10px; text-align: right; font-size: 14px;">#</th>
                  <th style="padding: 10px; text-align: right; font-size: 14px;">תאריך</th>
                  <th style="padding: 10px; text-align: right; font-size: 14px;">תיאור</th>
                  <th style="padding: 10px; text-align: right; font-size: 14px;">סכום</th>
                </tr>
              </thead>
              <tbody>
                ${expenses.map((exp: any, idx: number) => `
                  <tr style="border-bottom: 1px solid #f0f0f0;">
                    <td style="padding: 8px; text-align: right; font-size: 13px;">${idx + 1}</td>
                    <td style="padding: 8px; text-align: right; font-size: 13px;">${new Date(exp.expense_date).toLocaleDateString('he-IL')}</td>
                    <td style="padding: 8px; text-align: right; font-size: 13px;">${exp.description}</td>
                    <td style="padding: 8px; text-align: right; font-size: 13px; font-weight: 600;">₪${exp.amount_in_ils.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
            דוח זה נוצר אוטומטית ממערכת ניהול דוחות נסיעות.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-report-email function:", error);
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
