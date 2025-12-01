import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  username: string;
  employee_id: string | null;
  department: string;
  is_manager: boolean;
  manager_id: string | null;
  role: 'user' | 'manager' | 'accounting_manager';
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
      throw new Error("Only accounting managers can create users");
    }

    const userData: CreateUserRequest = await req.json();

    // Generate a random password
    const password = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        username: userData.username,
        full_name: userData.full_name,
        employee_id: userData.employee_id,
        department: userData.department,
        is_manager: userData.is_manager,
        manager_id: userData.manager_id,
      }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      throw createError;
    }

    if (!newUser.user) {
      throw new Error("User creation failed");
    }

    console.log("User created successfully:", newUser.user.id);

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: userData.role
      });

    if (roleError) {
      console.error("Error assigning role:", roleError);
    }

    // Send email with credentials using fetch API directly
    const emailHtml = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl;">
        <h1 style="color: #2563eb;">ברוכים הבאים למערכת דיווח הוצאות</h1>
        <p>שלום ${userData.full_name},</p>
        <p>נוצר עבורך חשבון במערכת דיווח ההוצאות.</p>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #1f2937;">פרטי התחברות שלך:</h2>
          <p style="margin: 10px 0;"><strong>כתובת מייל:</strong> ${userData.email}</p>
          <p style="margin: 10px 0;"><strong>סיסמה זמנית:</strong> <code style="background-color: #e5e7eb; padding: 5px 10px; border-radius: 4px; font-size: 16px;">${password}</code></p>
        </div>
        
        <p><strong>חשוב:</strong> מומלץ לשנות את הסיסמה הזמנית לאחר הכניסה הראשונה.</p>
        
        <p style="color: #6b7280; font-size: 14px;">אם לא ביקשת חשבון זה, ניתן להתעלם ממייל זה.</p>
      </div>
    `;

    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: 'Expense Reports <onboarding@resend.dev>',
            to: [userData.email],
            subject: 'ברוכים הבאים - פרטי התחברות למערכת',
            html: emailHtml,
          }),
        });
      } else {
        console.warn("RESEND_API_KEY not configured, email not sent");
      }
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        email: userData.email,
        message: "משתמש נוצר בהצלחה ופרטי ההתחברות נשלחו במייל"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-user function:", error);
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
