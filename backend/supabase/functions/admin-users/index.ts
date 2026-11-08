// METRO HAVEN — "admin-users" Edge Function
// Lets a signed-in admin create another admin login (email + password) from the dashboard.
// Runs on Supabase's servers, so the powerful service key never reaches the browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Who is calling? Must be a signed-in user listed in public.admins.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: who, error: whoErr } = await admin.auth.getUser(jwt);
  if (whoErr || !who?.user) return json({ error: "Please sign in again." }, 401);
  const { data: me } = await admin.from("admins").select("user_id").eq("user_id", who.user.id).maybeSingle();
  if (!me) return json({ error: "Only admins can do this." }, 403);

  let body: { action?: string; email?: string; password?: string; user_id?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  // 2) Create a new admin
  if (body.action === "create") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Please enter a valid email." }, 400);
    if (password.length < 10) return json({ error: "Password must be at least 10 characters." }, 400);

    let userId: string | null = null;
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created?.user) userId = created.user.id;
    else if (error && /already/i.test(error.message)) {
      // Existing login (e.g. made earlier in Supabase) — grant admin access and set the password entered here.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = list?.users.find((u) => (u.email || "").toLowerCase() === email)?.id || null;
      if (!userId) return json({ error: "That email already has an account but couldn't be found." }, 400);
      const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      if (upErr) return json({ error: upErr.message }, 400);
    } else return json({ error: error?.message || "Could not create the account." }, 400);

    const { error: insErr } = await admin.from("admins").upsert({ user_id: userId, email }, { onConflict: "user_id" });
    if (insErr) return json({ error: insErr.message }, 400);
    return json({ ok: true, email });
  }

  // 3) Remove an admin (can't remove yourself or the last admin)
  if (body.action === "remove") {
    const id = String(body.user_id || "");
    if (id === who.user.id) return json({ error: "You can't remove your own access." }, 400);
    const { count } = await admin.from("admins").select("*", { count: "exact", head: true });
    if ((count || 0) <= 1) return json({ error: "There must be at least one admin." }, 400);
    await admin.from("admins").delete().eq("user_id", id);
    await admin.auth.admin.deleteUser(id);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
