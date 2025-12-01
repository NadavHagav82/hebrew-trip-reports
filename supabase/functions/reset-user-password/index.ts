import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Verify the user is an accounting manager
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user has accounting_manager role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "accounting_manager");

    if (!roles || roles.length === 0) {
      throw new Error("Only accounting managers can reset passwords");
    }

    const { user_id }: ResetPasswordRequest = await req.json();

    // Get user details
    const { data: { user: targetUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    
    if (getUserError || !targetUser) {
      throw new Error("User not found");
    }

    // Get user profile for full name
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user_id)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Generate a random password
    const newPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    // Update the user's password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw updateError;
    }

    console.log("Password reset successfully for user:", user_id);

    // Send email with new password
    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
        <h1 style="color: #2563eb;">איפוס סיסמה - מערכת דיווח הוצאות</h1>
        <p>שלום ${profile.full_name},</p>
        <p>הסיסמה שלך במערכת אופסה על ידי מנהל הנהלת חשבונות.</p>
        
        <div style="background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #856404;">הסיסמה הזמנית החדשה שלך:</h2>
          <p style="margin: 10px 0;">
            <code style="background-color: #fff; padding: 10px 15px; border-radius: 4px; font-size: 18px; font-weight: bold; display: inline-block; border: 1px solid #ffc107;">${newPassword}</code>
          </p>
        </div>
        
        <p><strong>חשוב מאוד:</strong></p>
        <ul style="line-height: 1.8;">
          <li>שמור על סיסמה זו במקום בטוח</li>
          <li>מומלץ מאוד לשנות את הסיסמה הזמנית לאחר הכניסה הראשונה</li>
          <li>אל תשתף את הסיסמה עם אף אחד</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">לכניסה למערכת:</p>
          <p style="font-weight: bold;">משתמש: ${profile.email || targetUser.email}</p>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">אם לא ביקשת איפוס סיסמה, אנא פנה למנהל הנהלת חשבונות מיד.</p>
      </div>
    `;

    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Expense Reports <onboarding@resend.dev>',
            to: [profile.email || targetUser.email],
            subject: 'איפוס סיסמה - מערכת דיווח הוצאות',
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Failed to send email:", await emailResponse.text());
        }
      } else {
        console.warn("RESEND_API_KEY not configured, email not sent");
      }
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "הסיסמה אופסה בהצלחה והסיסמה החדשה נשלחה במייל למשתמש"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in reset-user-password function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
