import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TravelRequestNotificationPayload {
  travel_request_id: string;
  approver_id: string;
  requester_name: string;
  destination: string;
  start_date: string;
  end_date: string;
  purpose: string;
  estimated_total: number;
  has_violations: boolean;
  violation_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: TravelRequestNotificationPayload = await req.json();
    
    console.log("Received travel request notification payload:", payload);

    // Get approver email
    const { data: approverProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", payload.approver_id)
      .single();

    if (profileError || !approverProfile?.email) {
      console.error("Error fetching approver profile:", profileError);
      throw new Error("Could not find approver email");
    }

    console.log("Sending notification to:", approverProfile.email);

    // Format dates
    const startDate = new Date(payload.start_date).toLocaleDateString("he-IL");
    const endDate = new Date(payload.end_date).toLocaleDateString("he-IL");

    // Create email content
    const violationWarning = payload.has_violations 
      ? `<div style="background-color: #FEF3C7; padding: 12px; border-radius: 8px; margin: 16px 0; border-right: 4px solid #F59E0B;">
          <strong style="color: #92400E;">⚠️ שים לב:</strong>
          <span style="color: #78350F;"> נמצאו ${payload.violation_count} חריגות מהמדיניות בבקשה זו</span>
        </div>`
      : '';

    const emailHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); padding: 24px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 24px; }
        .info-box { background-color: #F8FAFC; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E2E8F0; }
        .info-row:last-child { border-bottom: none; }
        .label { color: #64748B; }
        .value { font-weight: 600; color: #1E293B; }
        .total { font-size: 1.25em; color: #0EA5E9; }
        .button { display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px; }
        .footer { text-align: center; padding: 16px; color: #94A3B8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✈️ בקשת נסיעה חדשה לאישור</h1>
        </div>
        <div class="content">
          <p>שלום ${approverProfile.full_name || ""},</p>
          <p>התקבלה בקשה חדשה לאישור נסיעה מ-<strong>${payload.requester_name}</strong>:</p>
          
          ${violationWarning}
          
          <div class="info-box">
            <div class="info-row">
              <span class="label">יעד</span>
              <span class="value">${payload.destination}</span>
            </div>
            <div class="info-row">
              <span class="label">תאריכים</span>
              <span class="value">${startDate} - ${endDate}</span>
            </div>
            <div class="info-row">
              <span class="label">מטרה</span>
              <span class="value">${payload.purpose}</span>
            </div>
            <div class="info-row">
              <span class="label">תקציב מבוקש</span>
              <span class="value total">$${payload.estimated_total.toLocaleString()}</span>
            </div>
          </div>
          
          <center>
            <a href="${supabaseUrl.replace('.supabase.co', '.lovable.app')}/travel-requests/pending" class="button">
              צפה בבקשה ואשר
            </a>
          </center>
        </div>
        <div class="footer">
          הודעה זו נשלחה באופן אוטומטי ממערכת ניהול הנסיעות
        </div>
      </div>
    </body>
    </html>
    `;

    // Send email (non-blocking - continue even if email fails)
    let emailSent = false;
    try {
      const { error: emailError } = await resend.emails.send({
        from: "Travel System <onboarding@resend.dev>",
        to: [approverProfile.email],
        subject: `🔔 בקשת נסיעה חדשה לאישור - ${payload.destination}`,
        html: emailHtml,
      });

      if (emailError) {
        console.error("Error sending email (non-blocking):", emailError);
      } else {
        emailSent = true;
        console.log("Email sent successfully");
      }
    } catch (emailErr) {
      console.error("Email sending failed (non-blocking):", emailErr);
    }

    // Create in-app notification (this is the important part)
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: payload.approver_id,
      type: "travel_request_pending",
      title: "בקשת נסיעה חדשה לאישור",
      message: `${payload.requester_name} הגיש בקשה לנסיעה ל-${payload.destination}`,
      travel_request_id: payload.travel_request_id,
    });

    if (notifError) {
      console.error("Error creating notification:", notifError);
    }

    console.log("Notification process completed. Email sent:", emailSent);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-travel-request:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
