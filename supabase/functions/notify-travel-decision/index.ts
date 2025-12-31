import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TravelDecisionPayload {
  employee_id: string;
  decision: 'approved' | 'rejected' | 'partially_approved';
  destination: string;
  start_date: string;
  end_date: string;
  approver_name: string;
  comments?: string;
  approved_budget?: {
    flights: number;
    accommodation_per_night: number;
    meals_per_day: number;
    transport: number;
    total: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TravelDecisionPayload = await req.json();
    
    console.log("Received travel decision notification payload:", payload);

    // Get employee email
    const { data: employeeProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", payload.employee_id)
      .single();

    if (profileError || !employeeProfile?.email) {
      console.error("Error fetching employee profile:", profileError);
      throw new Error("Could not find employee email");
    }

    console.log("Sending decision notification to:", employeeProfile.email);

    // Format dates
    const startDate = new Date(payload.start_date).toLocaleDateString("he-IL");
    const endDate = new Date(payload.end_date).toLocaleDateString("he-IL");

    // Determine status styling
    const statusConfig = {
      approved: {
        color: '#22C55E',
        bgColor: '#F0FDF4',
        text: 'אושרה',
        icon: '✅',
        title: 'בקשת הנסיעה שלך אושרה!'
      },
      partially_approved: {
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        text: 'אושרה עם שינויים',
        icon: '⚠️',
        title: 'בקשת הנסיעה שלך אושרה עם שינויים'
      },
      rejected: {
        color: '#EF4444',
        bgColor: '#FEF2F2',
        text: 'נדחתה',
        icon: '❌',
        title: 'בקשת הנסיעה שלך נדחתה'
      }
    };

    const status = statusConfig[payload.decision];

    // Build budget section for approved requests
    let budgetSection = '';
    if (payload.approved_budget && payload.decision !== 'rejected') {
      budgetSection = `
        <div style="background-color: #F8FAFC; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin: 0 0 12px 0; color: #1E293B;">💰 תקציב מאושר:</h3>
          <div style="display: grid; gap: 8px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">✈️ טיסות</span>
              <span style="font-weight: 600;">$${payload.approved_budget.flights?.toLocaleString() || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">🏨 לינה ללילה</span>
              <span style="font-weight: 600;">$${payload.approved_budget.accommodation_per_night?.toLocaleString() || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">🍽️ ארוחות ליום</span>
              <span style="font-weight: 600;">$${payload.approved_budget.meals_per_day?.toLocaleString() || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">🚗 תחבורה</span>
              <span style="font-weight: 600;">$${payload.approved_budget.transport?.toLocaleString() || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 1px solid #E2E8F0; padding-top: 8px; margin-top: 8px;">
              <span style="font-weight: 600; color: #1E293B;">סה"כ</span>
              <span style="font-weight: 700; color: #0EA5E9; font-size: 1.1em;">$${payload.approved_budget.total?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Build comments section
    let commentsSection = '';
    if (payload.comments) {
      commentsSection = `
        <div style="background-color: #F1F5F9; padding: 12px; border-radius: 8px; margin: 16px 0; border-right: 4px solid #64748B;">
          <strong style="color: #475569;">💬 הערות המאשר:</strong>
          <p style="margin: 8px 0 0 0; color: #334155;">${payload.comments}</p>
        </div>
      `;
    }

    const emailHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: ${status.bgColor}; padding: 24px; text-align: center; border-bottom: 3px solid ${status.color}; }
        .header h1 { color: ${status.color}; margin: 0; font-size: 24px; }
        .content { padding: 24px; }
        .info-box { background-color: #F8FAFC; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #64748B; }
        .value { font-weight: 600; color: #1E293B; }
        .button { display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
        .footer { text-align: center; padding: 16px; color: #94A3B8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${status.icon} ${status.title}</h1>
        </div>
        <div class="content">
          <p>שלום ${employeeProfile.full_name || ""},</p>
          <p>בקשת הנסיעה שלך <strong>${status.text}</strong> על ידי ${payload.approver_name}.</p>
          
          <div class="info-box">
            <div class="info-row">
              <span class="label">יעד</span>
              <span class="value">${payload.destination}</span>
            </div>
            <div class="info-row">
              <span class="label">תאריכים</span>
              <span class="value">${startDate} - ${endDate}</span>
            </div>
          </div>
          
          ${budgetSection}
          ${commentsSection}
          
          ${payload.decision !== 'rejected' ? `
            <center>
              <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/approved-travels" class="button">
                צפה באישור הנסיעה
              </a>
            </center>
          ` : `
            <center>
              <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/travel-requests" class="button">
                צפה בבקשות הנסיעה שלי
              </a>
            </center>
          `}
        </div>
        <div class="footer">
          הודעה זו נשלחה באופן אוטומטי ממערכת ניהול הנסיעות
        </div>
      </div>
    </body>
    </html>
    `;

    // Determine email subject based on decision
    const subjects = {
      approved: `✅ בקשת הנסיעה ל-${payload.destination} אושרה`,
      partially_approved: `⚠️ בקשת הנסיעה ל-${payload.destination} אושרה עם שינויים`,
      rejected: `❌ בקשת הנסיעה ל-${payload.destination} נדחתה`
    };

    // Send email
    const { error: emailError } = await resend.emails.send({
      from: "Travel System <onboarding@resend.dev>",
      to: [employeeProfile.email],
      subject: subjects[payload.decision],
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw emailError;
    }

    console.log("Decision notification sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-travel-decision:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
