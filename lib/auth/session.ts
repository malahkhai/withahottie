import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/domain";
export async function getViewer() {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single();
  if (error || !data) return null;
  return {
    id: user.id,
    role: data.role as UserRole,
    displayName: data.display_name as string,
  };
}
export async function requireRole(roles: readonly UserRole[]) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!roles.includes(viewer.role)) redirect("/@stella");
  return viewer;
}
