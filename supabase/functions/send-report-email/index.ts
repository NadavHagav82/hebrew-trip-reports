import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendReportEmailRequest {
  recipientEmails: string[];
  reportId: string;
  pdfBase64: string;
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
    const { recipientEmails, reportId, pdfBase64, reportData }: SendReportEmailRequest = await req.json();

    console.log("Sending report email to:", recipientEmails);
    console.log("Report data received:", {
      reportId,
      recipientsCount: recipientEmails.length,
      hasPDF: !!pdfBase64,
      pdfSize: pdfBase64 ? pdfBase64.length : 0,
    });

    const { report } = reportData;

    const reportDetails = {
      destination: report.trip_destination,
      startDate: new Date(report.trip_start_date).toLocaleDateString('he-IL'),
      endDate: new Date(report.trip_end_date).toLocaleDateString('he-IL'),
      purpose: report.trip_purpose,
      totalAmount: report.total_amount_ils || 0,
    };

    const emailResponse = await resend.emails.send({
      from: "דוחות נסיעות <onboarding@resend.dev>",
      to: recipientEmails,
      subject: `דוח נסיעה - ${reportDetails.destination}`,
      html: `
        <div dir="rtl" style="font-family: 'Heebo', Arial, sans-serif; direction: rtl; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">דוח נסיעה - ${reportDetails.destination}</h2>
          
          <p style="font-size: 16px; color: #333;">שלום,</p>
          <p style="font-size: 14px; color: #666;">מצורף דוח הנסיעה המלא כקובץ PDF.</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>יעד:</strong> ${reportDetails.destination}</p>
            <p style="margin: 10px 0;"><strong>תאריכים:</strong> ${reportDetails.startDate} - ${reportDetails.endDate}</p>
            <p style="margin: 10px 0;"><strong>מטרת הנסיעה:</strong> ${reportDetails.purpose}</p>
            <p style="margin: 10px 0;"><strong>סה"כ הוצאות:</strong> ${reportDetails.totalAmount.toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪</p>
          </div>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
            דוח זה נוצר אוטומטית ממערכת ניהול דוחות נסיעות.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `דוח-נסיעה-${reportDetails.destination.replace(/[^א-תa-zA-Z0-9]/g, '-')}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    console.log("Email sent successfully to", recipientEmails.length, "recipients:", emailResponse);

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
