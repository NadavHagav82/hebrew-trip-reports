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
    const { recipientEmails, reportId, reportData }: SendReportEmailRequest = await req.json();

    console.log("Sending report email to:", recipientEmails);
    console.log("Report data received:", {
      reportId,
      recipientsCount: recipientEmails.length,
      expensesCount: reportData.expenses.length,
      hasProfile: !!reportData.profile,
    });

    const { report, expenses, profile } = reportData;

    const reportDetails = {
      destination: report.trip_destination,
      startDate: new Date(report.trip_start_date).toLocaleDateString('he-IL'),
      endDate: new Date(report.trip_end_date).toLocaleDateString('he-IL'),
      purpose: report.trip_purpose,
      totalAmount: report.total_amount_ils || 0,
      createdAt: new Date(report.created_at).toLocaleDateString('he-IL') + ' ' + new Date(report.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    };

    // Calculate trip duration
    const start = new Date(report.trip_start_date);
    const end = new Date(report.trip_end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const tripDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Create PDF HTML content
    const pdfHtmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');
          
          body {
            font-family: 'Heebo', Arial, sans-serif;
            direction: rtl;
            margin: 40px;
            color: #1a1a1a;
          }
          
          .header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .header h1 {
            font-size: 28px;
            margin: 0;
            color: #1a1a1a;
          }
          
          .info-section {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e0e0e0;
          }
          
          .info-row:last-child {
            border-bottom: none;
          }
          
          .info-label {
            font-weight: 500;
            color: #666;
          }
          
          .info-value {
            font-weight: 600;
            color: #1a1a1a;
          }
          
          .expenses-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
          
          .expenses-table thead {
            background: #3b82f6;
            color: white;
          }
          
          .expenses-table th {
            padding: 12px;
            text-align: right;
            font-weight: 600;
          }
          
          .expenses-table td {
            padding: 10px 12px;
            text-align: right;
            border-bottom: 1px solid #f0f0f0;
          }
          
          .expenses-table tbody tr:last-child td {
            border-bottom: none;
          }
          
          .expenses-table tbody tr:nth-child(even) {
            background: #f9f9f9;
          }
          
          .total-row {
            background: #e8f4ff !important;
            font-weight: 700;
            color: #1a1a1a;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          
          h2 {
            color: #1a1a1a;
            font-size: 20px;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>דוח נסיעה עסקית</h1>
          ${profile ? `<p style="margin: 10px 0; font-size: 16px;">${profile.full_name} | ${profile.employee_id}</p>` : ''}
        </div>
        
        <div class="info-section">
          <h2>פרטי הנסיעה</h2>
          <div class="info-row">
            <span class="info-label">:יעד</span>
            <span class="info-value">${reportDetails.destination}</span>
          </div>
          <div class="info-row">
            <span class="info-label">:מטרת הנסיעה</span>
            <span class="info-value">${reportDetails.purpose}</span>
          </div>
          <div class="info-row">
            <span class="info-label">:תאריך התחלה</span>
            <span class="info-value">${reportDetails.startDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">:תאריך סיום</span>
            <span class="info-value">${reportDetails.endDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">:משך הנסיעה</span>
            <span class="info-value">${tripDuration} ימים</span>
          </div>
          ${report.daily_allowance ? `
          <div class="info-row">
            <span class="info-label">:אש"ל ליום</span>
            <span class="info-value">$${report.daily_allowance} (סה"כ $${report.daily_allowance * tripDuration})</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">:תאריך יצירה</span>
            <span class="info-value">${reportDetails.createdAt}</span>
          </div>
        </div>
        
        <h2>סיכום הוצאות</h2>
        <table class="expenses-table">
          <thead>
            <tr>
              <th>#</th>
              <th>תאריך</th>
              <th>קטגוריה</th>
              <th>תיאור</th>
              <th>סכום</th>
              <th>סכום בש"ח</th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map((exp: any, idx: number) => {
              const categoryLabels: Record<string, string> = {
                flights: 'טיסות',
                accommodation: 'לינה',
                food: 'מזון',
                transportation: 'תחבורה',
                miscellaneous: 'שונות',
              };
              return `
              <tr>
                <td>${idx + 1}</td>
                <td>${new Date(exp.expense_date).toLocaleDateString('he-IL')}</td>
                <td>${categoryLabels[exp.category] || exp.category}</td>
                <td>${exp.description}</td>
                <td>${exp.amount.toFixed(2)} ${exp.currency}</td>
                <td>₪${exp.amount_in_ils.toFixed(2)}</td>
              </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="5" style="text-align: left;">סה"כ:</td>
              <td>₪${reportDetails.totalAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>דוח זה נוצר אוטומטית ממערכת ניהול דוחות נסיעות</p>
          <p>נוצר בתאריך: ${new Date().toLocaleDateString('he-IL')} ${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </body>
      </html>
    `;

    // Convert HTML to PDF using Puppeteer (via browserless service)
    // For simplicity, we'll use an HTML-to-PDF API or attach the HTML directly
    // Since Deno doesn't have native PDF generation, we'll send the HTML content as attachment
    
    const emailResponse = await resend.emails.send({
      from: "דוחות נסיעות <onboarding@resend.dev>",
      to: recipientEmails,
      subject: `דוח נסיעה - ${reportDetails.destination}`,
      html: `
        <div dir="rtl" style="font-family: 'Heebo', Arial, sans-serif; direction: rtl; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">דוח נסיעה - ${reportDetails.destination}</h2>
          
          <p style="font-size: 16px; color: #333;">שלום,</p>
          <p style="font-size: 14px; color: #666;">מצורף דוח הנסיעה המלא כקובץ HTML. ניתן לפתוח אותו בדפדפן ולהדפיס ל-PDF.</p>
          
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
          filename: `דוח-נסיעה-${reportDetails.destination.replace(/[^א-תa-zA-Z0-9]/g, '-')}.html`,
          content: btoa(String.fromCharCode(...new TextEncoder().encode(pdfHtmlContent))),
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
