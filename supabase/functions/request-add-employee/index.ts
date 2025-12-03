import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestAddEmployeeRequest {
  managerName: string;
  managerEmail: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      managerName,
      managerEmail,
      employeeName,
      employeeEmail,
      department,
      notes,
    }: RequestAddEmployeeRequest = await req.json();

    console.log("Request to add employee received:", {
      managerName,
      employeeName,
      department,
    });

    // Get accounting manager email
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("accounting_manager_email")
      .not("accounting_manager_email", "is", null)
      .limit(1);

    if (profileError) {
      console.error("Error fetching accounting manager:", profileError);
      throw profileError;
    }

    const accountingManagerEmail = profiles?.[0]?.accounting_manager_email;

    if (!accountingManagerEmail) {
      throw new Error("No accounting manager email found");
    }

    // Send email to accounting manager
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .info-box { background-color: white; padding: 20px; margin: 20px 0; border-right: 4px solid #4F46E5; border-radius: 4px; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #4F46E5; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>בקשה להוספת עובד חדש</h1>
            </div>
            <div class="content">
              <p>שלום,</p>
              <p>התקבלה בקשה חדשה להוספת עובד למערכת.</p>
              
              <div class="info-box">
                <h3>פרטי המנהל המבקש:</h3>
                <div class="info-row">
                  <span class="label">שם:</span> ${managerName}
                </div>
                <div class="info-row">
                  <span class="label">אימייל:</span> ${managerEmail}
                </div>
              </div>

              <div class="info-box">
                <h3>פרטי העובד המבוקש:</h3>
                <div class="info-row">
                  <span class="label">שם מלא:</span> ${employeeName}
                </div>
                <div class="info-row">
                  <span class="label">אימייל:</span> ${employeeEmail}
                </div>
                <div class="info-row">
                  <span class="label">מחלקה:</span> ${department}
                </div>
                ${notes ? `
                <div class="info-row">
                  <span class="label">הערות:</span> ${notes}
                </div>
                ` : ''}
              </div>

              <p>נא להוסיף את העובד למערכת ולשייך אותו למנהל המבקש.</p>

              <div class="footer">
                <p>מערכת ניהול דוחות הוצאות</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "מערכת ניהול דוחות <onboarding@resend.dev>",
      to: [accountingManagerEmail],
      subject: `בקשה להוספת עובד: ${employeeName}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "הבקשה נשלחה בהצלחה למנהל הנהלת החשבונות" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in request-add-employee function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
