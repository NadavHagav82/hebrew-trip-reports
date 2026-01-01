import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovalSkippedPayload {
  travel_request_id: string;
  requester_id: string;
  requester_name: string;
  destination: string;
  skipped_level: number;
  skipped_level_type: string;
  skip_reason: string;
  estimated_total: number;
}

const levelTypeLabels: Record<string, string> = {
  direct_manager: "מנהל ישיר",
  org_admin: "מנהל ארגון",
  accounting_manager: "הנהלת חשבונות",
  specific_user: "משתמש ספציפי",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: ApprovalSkippedPayload = await req.json();
    
    console.log("Received approval skipped notification payload:", payload);

    // Get requester email
    const { data: requesterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", payload.requester_id)
      .single();

    if (profileError || !requesterProfile?.email) {
      console.error("Error fetching requester profile:", profileError);
      throw new Error("Could not find requester email");
    }

    console.log("Sending notification to:", requesterProfile.email);

    const levelName = levelTypeLabels[payload.skipped_level_type] || payload.skipped_level_type;

    const emailHtml = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%); padding: 24px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 22px; }
        .content { padding: 24px; }
        .info-box { background-color: #ECFDF5; padding: 16px; border-radius: 8px; margin: 16px 0; border-right: 4px solid #22C55E; }
        .skip-reason { background-color: #F0FDF4; padding: 12px; border-radius: 6px; margin-top: 12px; }
        .footer { text-align: center; padding: 16px; color: #94A3B8; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>⏭️ דילוג אוטומטי על רמת אישור</h1>
        </div>
        <div class="content">
          <p>שלום ${requesterProfile.full_name || ""},</p>
          <p>בקשת הנסיעה שלך ל-<strong>${payload.destination}</strong> עברה דילוג אוטומטי על רמת אישור:</p>
          
          <div class="info-box">
            <strong>רמה שדולגה:</strong> רמה ${payload.skipped_level} - ${levelName}
            <div class="skip-reason">
              <strong>סיבת הדילוג:</strong> ${payload.skip_reason}
            </div>
          </div>
          
          <p>הבקשה ממשיכה לרמת האישור הבאה בשרשרת.</p>
          <p>סכום הבקשה: <strong>$${payload.estimated_total.toLocaleString()}</strong></p>
        </div>
        <div class="footer">
          הודעה זו נשלחה באופן אוטומטי ממערכת ניהול הנסיעות
        </div>
      </div>
    </body>
    </html>
    `;

    // Send email
    try {
      const { error: emailError } = await resend.emails.send({
        from: "Travel System <onboarding@resend.dev>",
        to: [requesterProfile.email],
        subject: `⏭️ דילוג על רמת אישור - בקשה ל-${payload.destination}`,
        html: emailHtml,
      });

      if (emailError) {
        console.error("Error sending email (non-blocking):", emailError);
      } else {
        console.log("Email sent successfully");
      }
    } catch (emailErr) {
      console.error("Email sending failed (non-blocking):", emailErr);
    }

    // Create in-app notification
    const { error: notifError } = await supabase.from("notifications").insert({
      user_id: payload.requester_id,
      type: "approval_level_skipped",
      title: "דילוג על רמת אישור",
      message: `רמת אישור ${levelName} דולגה אוטומטית בבקשת הנסיעה ל-${payload.destination}`,
      travel_request_id: payload.travel_request_id,
    });

    if (notifError) {
      console.error("Error creating notification:", notifError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-approval-skipped:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});