import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotifyManagerRequest {
  employeeName: string;
  employeeEmail: string;
  employeeId: string | null;
  department: string;
  managerId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, employeeId, department, managerId }: NotifyManagerRequest = await req.json();

    console.log('Notifying manager about new employee:', { employeeName, managerId });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get manager details
    const { data: manager, error: managerError } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', managerId)
      .single();

    if (managerError) {
      console.error('Error fetching manager:', managerError);
      throw new Error('לא ניתן למצוא את פרטי המנהל');
    }

    if (!manager) {
      throw new Error('המנהל לא נמצא במערכת');
    }

    // Send email to manager
    const emailResponse = await resend.emails.send({
      from: "מערכת דוחות נסיעה <onboarding@resend.dev>",
      to: [manager.username],
      subject: `עובד חדש הצטרף לצוות שלך - ${employeeName}`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1e40af; margin-bottom: 20px;">👋 עובד חדש הצטרף לצוות!</h1>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              שלום ${manager.full_name},
            </p>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              עובד חדש נרשם למערכת דוחות הנסיעה והגדיר אותך כמנהל הישיר שלו.
            </p>
            
            <div style="background-color: #eff6ff; border-right: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 10px 0; color: #1e40af;">פרטי העובד:</h3>
              <p style="margin: 5px 0; color: #1f2937;"><strong>שם:</strong> ${employeeName}</p>
              <p style="margin: 5px 0; color: #1f2937;"><strong>אימייל:</strong> ${employeeEmail}</p>
              ${employeeId ? `<p style="margin: 5px 0; color: #1f2937;"><strong>מספר עובד:</strong> ${employeeId}</p>` : ''}
              <p style="margin: 5px 0; color: #1f2937;"><strong>מחלקה:</strong> ${department}</p>
            </div>
            
            <p style="font-size: 16px; color: #374151; line-height: 1.6;">
              כעת תוכל לראות ולאשר את דוחות הנסיעה שלו במערכת.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="font-size: 14px; color: #6b7280; margin: 0;">
                בברכה,<br>
                מערכת דוחות הנסיעה
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully to manager:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-manager-new-employee function:", error);
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
