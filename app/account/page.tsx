import { requireRole } from "@/lib/auth/session";
import { loadWorkspace } from "@/lib/workspace/repository";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { FanAccount } from "@/components/fan-account";
import { createClient } from "@/lib/supabase/server";
export const metadata = { title: "Your account", robots: { index: false, follow: false } };
export default async function Account() {
  const viewer = await requireRole(["fan", "creator", "admin"]);
  const data = await loadWorkspace(viewer);
  const supabase = await createClient();
  let saved = [{ id: "stella", name: "Stella May", handle: "stella" }];
  if (supabase) {
    const { data: rows, error } = await supabase
      .from("saved_creators")
      .select("creator_id,creator_profiles(handle,profiles(display_name))")
      .eq("fan_id", viewer.id);
    if (error) throw Error("Could not load saved creators.");
    saved = (rows || []).map((row) => {
      const creator = row.creator_profiles as unknown as {
        handle: string;
        profiles: { display_name: string };
      };
      return {
        id: row.creator_id,
        handle: creator.handle,
        name: creator.profiles.display_name,
      };
    });
  }
  return (
    <WorkspaceProvider initial={data}>
      <FanAccount saved={saved} />
    </WorkspaceProvider>
  );
}
