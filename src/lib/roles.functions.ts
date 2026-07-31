import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Get the current user's role (student | parent | teacher). Falls back to null.
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) throw error;
    const roles = (rows ?? []).map((r: any) => r.role as string);
    // Precedence: admin > teacher > parent > student
    const order = ["admin", "teacher", "parent", "student"] as const;
    const role = (order.find((r) => roles.includes(r)) ?? null) as "student" | "parent" | "teacher" | "admin" | null;
    const { data: profile } = await supabase.from("profiles").select("id, full_name, avatar, grade").eq("id", userId).maybeSingle();
    return { role, profile };
  });

// Ensure a profile + role exist for the current user. Called right after sign-up.
export const initAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      role: z.enum(["parent", "teacher"]),
      full_name: z.string().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { userId, claims } = context;
    const email = (claims as { email?: string })?.email?.toLowerCase();
    // user_roles / profiles are not self-writable under RLS (so nobody can
    // self-assign admin). Do the setup with the privileged server client,
    // limited to the safe roles validated above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      { id: userId, full_name: data.full_name || email || "User" },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    // Allowlisted emails become platform admins.
    let role: "parent" | "teacher" | "admin" = data.role;
    if (email) {
      const { data: allow } = await supabaseAdmin
        .from("admin_allowlist")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      if (allow) role = "admin";
    }

    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1);
    if (!existing || existing.length === 0) {
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (roleError) throw roleError;
    }
    return { ok: true, role };
  });

