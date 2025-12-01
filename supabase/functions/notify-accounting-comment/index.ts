import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  reportId: string;
  commentText: string;
  commentAuthor: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, commentText, commentAuthor }: NotifyRequest = await req.json();

    console.log(`Sending accounting comment notification for report:`, reportId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get report details
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        *,
        profiles!reports_user_id_fkey(
          username,
          full_name,
          manager_id,
          profiles_manager:profiles!profiles_manager_id_fkey(
            username,
            full_name
          )
        )
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('Report not found:', reportError);
      throw new Error('דוח לא נמצא');
    }

    const employeeEmail = report.profiles.username;
    const employeeName = report.profiles.full_name;
    const managerEmail = report.profiles.profiles_manager?.username;
    const managerName = report.profiles.profiles_manager?.full_name;

    // Prepare email recipients
    const recipients = [employeeEmail];
    if (managerEmail) {
      recipients.push(managerEmail);
    }

    // Send email via Resend
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .comment-box { background: white; padding: 20px; border-right: 4px solid #667eea; border-radius: 8px; margin: 20px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">💬 הערה חדשה מהנהלת חשבונות</h1>
          </div>
          <div class="content">
            <p style="font-size: 16px;">שלום ${employeeName}${managerName ? ` ו-${managerName}` : ''},</p>
            
            <p>התקבלה הערה חדשה מ<strong>${commentAuthor}</strong> בנושא דוח הנסיעה:</p>
            
            <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <strong>יעד:</strong> ${report.trip_destination}<br>
              <strong>תאריכים:</strong> ${new Date(report.trip_start_date).toLocaleDateString('he-IL')} - ${new Date(report.trip_end_date).toLocaleDateString('he-IL')}
            </div>

            <div class="comment-box">
              <h3 style="margin-top: 0; color: #667eea;">הערה:</h3>
              <p style="white-space: pre-wrap;">${commentText}</p>
            </div>

            <p>ניתן לצפות בדוח ולהגיב על ידי לחיצה על הכפתור למטה:</p>

            <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/reports/${reportId}" class="button">
              צפה בדוח והגב
            </a>

            <div class="footer">
              <p>מערכת ניהול דוחות נסיעה</p>
              <p style="font-size: 12px; color: #9ca3af;">אימייל זה נשלח אוטומטית, אין להשיב עליו ישירות</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'דוחות נסיעה <onboarding@resend.dev>',
        to: recipients,
        subject: `הערה חדשה מהנהלת חשבונות - ${report.trip_destination}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Resend API error:', error);
      throw new Error('שגיאה בשליחת המייל');
    }

    console.log('Notification email sent successfully');

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in notify-accounting-comment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
