import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInvitationRequest {
  recipientEmail: string;
  invitationCode: string;
  organizationName: string;
  role: string;
  expiresAt: string;
  registrationUrl: string;
}

const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'org_admin': return 'מנהל ארגון';
    case 'manager': return 'מנהל';
    case 'user': return 'עובד';
    default: return role;
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-invitation-email function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      recipientEmail, 
      invitationCode, 
      organizationName, 
      role, 
      expiresAt,
      registrationUrl 
    }: SendInvitationRequest = await req.json();

    console.log(`Sending invitation email to ${recipientEmail} for organization ${organizationName}`);

    const roleLabel = getRoleLabel(role);
    const formattedExpiry = new Date(expiresAt).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const emailResponse = await resend.emails.send({
      from: "Expense System <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: `הזמנה להצטרף ל${organizationName}`,
      html: `
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">הזמנה להצטרף למערכת</h1>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
            <p style="font-size: 16px;">שלום,</p>
            
            <p style="font-size: 16px;">
              הוזמנת להצטרף לארגון <strong>${organizationName}</strong> בתפקיד <strong>${roleLabel}</strong>.
            </p>
            
            <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">קוד ההזמנה שלך:</p>
              <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px; margin: 0;">${invitationCode}</p>
            </div>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${registrationUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; font-size: 16px; font-weight: bold;">
                להרשמה למערכת
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              <strong>שים לב:</strong> קוד זה תקף עד ${formattedExpiry}
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              אם לא ביקשת הזמנה זו, אנא התעלם ממייל זה.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invitation email:", error);
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
