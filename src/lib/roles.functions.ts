import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Get the current user's role (student | parent | teacher). Falls back to null.
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).limit(1).maybeSingle();
    if (error) throw error;
    const { data: profile } = await supabase.from("profiles").select("id, full_name, avatar, grade").eq("id", userId).maybeSingle();
    return { role: (data?.role ?? null) as "student" | "parent" | "teacher" | null, profile };
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
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string })?.email;
    // Upsert profile
    await supabase.from("profiles").upsert(
      { id: userId, full_name: data.full_name || email || "User" },
      { onConflict: "id" },
    );
    // Insert role if not present
    const { data: existing } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
    if (!existing) {
      await supabase.from("user_roles").insert({ user_id: userId, role: data.role });
    }
    return { ok: true };
  });
