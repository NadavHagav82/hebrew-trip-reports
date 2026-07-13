import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const NEW_PASSWORD = "Nadav1106";
  const results: { id: string; email?: string; ok: boolean; error?: string }[] = [];

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
        password: NEW_PASSWORD,
      });
      results.push({ id: u.id, email: u.email ?? undefined, ok: !upErr, error: upErr?.message });
    }

    if (users.length < perPage) break;
    page++;
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  return new Response(
    JSON.stringify({ total: results.length, succeeded, failed_count: failed.length, failed }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});