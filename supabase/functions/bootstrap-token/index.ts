import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function using Web Crypto API
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate a secure random token
function generateToken(): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segments = 4;
  const segmentLength = 4;

  const tokenSegments: string[] = [];
  const randomValues = new Uint8Array(segments * segmentLength);
  crypto.getRandomValues(randomValues);

  let randomIndex = 0;
  for (let i = 0; i < segments; i++) {
    let segment = "";
    for (let j = 0; j < segmentLength; j++) {
      segment += characters.charAt(randomValues[randomIndex++] % characters.length);
    }
    tokenSegments.push(segment);
  }

  return `BOOTSTRAP-${tokenSegments.join("-")}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header for user verification
    const authHeader = req.headers.get("Authorization");
    
    const body = await req.json();
    const { action, token, notes, expiryDays, userId } = body;

    console.log(`Bootstrap token action: ${action}`);

    // Service client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "create") {
      // Verify user is authorized (accounting_manager or admin)
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !user) {
        console.error("Auth error:", userError);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user has required role
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["accounting_manager", "admin"]);

      if (rolesError || !roles || roles.length === 0) {
        console.error("Role check failed:", rolesError);
        return new Response(
          JSON.stringify({ error: "Forbidden - insufficient permissions" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate new token
      const plainToken = generateToken();
      const hashedToken = await hashToken(plainToken);

      // Calculate expiry
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (expiryDays || 7));

      // Store hashed token
      const { error: insertError } = await supabaseAdmin
        .from("bootstrap_tokens")
        .insert({
          token: hashedToken,
          expires_at: expiryDate.toISOString(),
          notes: notes || null,
          is_used: false,
        });

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to create token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Token created successfully (hashed)");

      // Return plain token (only time it's visible)
      return new Response(
        JSON.stringify({ 
          success: true, 
          token: plainToken,
          expires_at: expiryDate.toISOString(),
          message: "Token created. This is the only time the plain token will be shown."
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "validate") {
      // Validate token (used during registration)
      if (!token) {
        return new Response(
          JSON.stringify({ valid: false, error: "No token provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hashedToken = await hashToken(token.trim());

      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("bootstrap_tokens")
        .select("id, is_used, expires_at")
        .eq("token", hashedToken)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tokenError) {
        console.error("Token validation error:", tokenError);
        return new Response(
          JSON.stringify({ valid: false, error: "Validation failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValid = !!tokenData;
      console.log(`Token validation result: ${isValid}`);

      return new Response(
        JSON.stringify({ 
          valid: isValid, 
          tokenId: tokenData?.id || null 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "use") {
      // Mark token as used (after successful registration)
      if (!token || !userId) {
        return new Response(
          JSON.stringify({ error: "Token and userId required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hashedToken = await hashToken(token.trim());

      // Verify token exists and is valid
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("bootstrap_tokens")
        .select("id")
        .eq("token", hashedToken)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error("Token lookup error:", tokenError);
        return new Response(
          JSON.stringify({ error: "Invalid or expired token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Mark as used
      const { error: updateError } = await supabaseAdmin
        .from("bootstrap_tokens")
        .update({
          is_used: true,
          used_by: userId,
          used_at: new Date().toISOString(),
        })
        .eq("id", tokenData.id);

      if (updateError) {
        console.error("Token update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to mark token as used" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Token marked as used by user: ${userId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Bootstrap token error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
