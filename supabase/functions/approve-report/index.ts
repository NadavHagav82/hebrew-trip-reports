import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApproveReportRequest {
  token: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, action, rejectionReason }: ApproveReportRequest = await req.json();

    console.log(`Processing ${action} for report with token:`, token);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find report by token
    const { data: report, error: fetchError } = await supabase
      .from('reports')
      .select('*')
      .eq('manager_approval_token', token)
      .single();

    if (fetchError || !report) {
      console.error("Report not found or error:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "דוח לא נמצא או אישור לא תקף" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if already processed
    if (report.status !== 'pending_approval') {
      return new Response(
        JSON.stringify({ success: false, error: "דוח כבר אושר או נדחה" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    let updateData: any = {
      manager_approval_token: null, // Clear token after use
    };

    if (action === 'approve') {
      updateData = {
        ...updateData,
        status: 'closed',
        approved_at: new Date().toISOString(),
      };
    } else {
      updateData = {
        ...updateData,
        status: 'open',
        rejection_reason: rejectionReason || 'הדוח נדחה על ידי המנהל',
      };
    }

    // Update report
    const { error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', report.id);

    if (updateError) {
      console.error("Error updating report:", updateError);
      throw updateError;
    }

    console.log(`Report ${action === 'approve' ? 'approved' : 'rejected'} successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        message: action === 'approve' ? 'הדוח אושר בהצלחה' : 'הדוח נדחה'
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
    console.error("Error in approve-report function:", error);
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
