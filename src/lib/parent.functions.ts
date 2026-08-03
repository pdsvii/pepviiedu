import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertParent(supabase: any, userId: string) {
  const [{ data: isParent }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "parent" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  if (!isParent && !isAdmin) throw new Error("Only parents can do that");
}

export const listMyChildren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertParent(supabase, userId);
    const { data: links } = await supabase.from("parent_child").select("child_id").eq("parent_id", userId);
    const ids = (links ?? []).map((l: any) => l.child_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar, grade")
      .in("id", ids);
    return profiles ?? [];
  });

export const createChildAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6).max(72),
      full_name: z.string().min(1).max(80),
      grade: z.number().int().min(4).max(6),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertParent(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the auth user
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: "student" },
    });
    if (error || !created?.user) throw new Error(error?.message ?? "Failed to create child");

    const childId = created.user.id;
    // Profile row
    await supabaseAdmin.from("profiles").upsert({ id: childId, full_name: data.full_name, grade: data.grade });
    // Role row
    await supabaseAdmin.from("user_roles").upsert({ user_id: childId, role: "student" }, { onConflict: "user_id,role" });
    // Link
    await supabaseAdmin.from("parent_child").insert({ parent_id: userId, child_id: childId });

    return { child_id: childId };
  });

export const resetChildPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      child_id: z.string().uuid(),
      new_password: z.string().min(6).max(72),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertParent(supabase, userId);
    const { data: link } = await supabase
      .from("parent_child")
      .select("child_id")
      .eq("parent_id", userId)
      .eq("child_id", data.child_id)
      .maybeSingle();
    if (!link) throw new Error("Not your child");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.child_id, { password: data.new_password });
    if (error) throw error;
    return { ok: true };
  });

export const getChildProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ child_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await assertParent(supabase, userId);
    const { data: link } = await supabase
      .from("parent_child")
      .select("child_id")
      .eq("parent_id", userId)
      .eq("child_id", data.child_id)
      .maybeSingle();
    if (!link) throw new Error("Not your child");

    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, subject, component, band, score, finished_at, grade")
      .eq("student_id", data.child_id)
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(50);

    return { attempts: attempts ?? [] };
  });
