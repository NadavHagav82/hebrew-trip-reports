import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrgAdminInfo {
  email: string;
  full_name: string;
  organization_id: string;
  organization_name: string;
}

interface EmployeeWithoutGrade {
  id: string;
  full_name: string;
  email: string;
  department: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting missing grades notification check...");

    // Get all organizations
    const { data: organizations, error: orgsError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("is_active", true);

    if (orgsError) {
      console.error("Error fetching organizations:", orgsError);
      throw orgsError;
    }

    console.log(`Found ${organizations?.length || 0} active organizations`);

    const notificationsSent: { org: string; adminEmail: string; employeesCount: number }[] = [];

    for (const org of organizations || []) {
      // Get org admins for this organization
      const { data: orgAdmins, error: adminsError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          organization_id
        `)
        .eq("organization_id", org.id);

      if (adminsError) {
        console.error(`Error fetching profiles for org ${org.id}:`, adminsError);
        continue;
      }

      // Filter to get org admins by checking user_roles
      const adminProfiles: OrgAdminInfo[] = [];
      for (const profile of orgAdmins || []) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .eq("role", "org_admin")
          .maybeSingle();

        if (roleData) {
          adminProfiles.push({
            email: profile.email,
            full_name: profile.full_name,
            organization_id: org.id,
            organization_name: org.name,
          });
        }
      }

      if (adminProfiles.length === 0) {
        console.log(`No org admins found for organization: ${org.name}`);
        continue;
      }

      // Get employees without grades in this organization
      const { data: employeesWithoutGrade, error: employeesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, department")
        .eq("organization_id", org.id)
        .is("grade_id", null);

      if (employeesError) {
        console.error(`Error fetching employees for org ${org.id}:`, employeesError);
        continue;
      }

      if (!employeesWithoutGrade || employeesWithoutGrade.length === 0) {
        console.log(`No employees without grades in organization: ${org.name}`);
        continue;
      }

      console.log(`Found ${employeesWithoutGrade.length} employees without grades in ${org.name}`);

      // Send email to each org admin
      for (const admin of adminProfiles) {
        if (!admin.email) continue;

        const employeesList = employeesWithoutGrade
          .map((emp: EmployeeWithoutGrade) => `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${emp.full_name}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${emp.email || '-'}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${emp.department || '-'}</td>
            </tr>
          `)
          .join("");

        const emailHtml = `
          <!DOCTYPE html>
          <html dir="rtl" lang="he">
          <head>
            <meta charset="UTF-8">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">התראה: עובדים ללא דרגה משויכת</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="font-size: 16px;">שלום ${admin.full_name},</p>
              
              <p>נמצאו <strong>${employeesWithoutGrade.length}</strong> עובדים בארגון <strong>${org.name}</strong> שאין להם דרגה משויכת.</p>
              
              <p style="color: #6b7280;">עובדים אלו רואים מדיניות ברירת מחדל (הדרגה הנמוכה ביותר) ולא את המדיניות המותאמת לתפקידם.</p>
              
              <h3 style="color: #374151; margin-top: 24px;">רשימת העובדים:</h3>
              
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: right; font-weight: 600;">שם מלא</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600;">אימייל</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600;">מחלקה</th>
                  </tr>
                </thead>
                <tbody>
                  ${employeesList}
                </tbody>
              </table>
              
              <div style="margin-top: 24px; padding: 16px; background: #fef3c7; border-radius: 8px; border-right: 4px solid #f59e0b;">
                <p style="margin: 0; color: #92400e;">
                  <strong>💡 פעולה נדרשת:</strong> היכנס לדף ניהול המשתמשים ושייך דרגה לכל עובד.
                </p>
              </div>
              
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                בברכה,<br>
                מערכת ניהול הוצאות
              </p>
            </div>
          </body>
          </html>
        `;

        try {
          const emailResponse = await resend.emails.send({
            from: "Expense System <onboarding@resend.dev>",
            to: [admin.email],
            subject: `התראה: ${employeesWithoutGrade.length} עובדים ללא דרגה - ${org.name}`,
            html: emailHtml,
          });

          console.log(`Email sent to ${admin.email}:`, emailResponse);
          
          notificationsSent.push({
            org: org.name,
            adminEmail: admin.email,
            employeesCount: employeesWithoutGrade.length,
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }
    }

    console.log("Notification process completed");
    console.log("Summary:", notificationsSent);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationsSent.length} notifications`,
        details: notificationsSent,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in notify-missing-grades function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
