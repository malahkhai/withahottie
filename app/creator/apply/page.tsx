import { pageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { CreatorEditor } from "@/components/creator-editor";
import { getViewer } from "@/lib/auth/session";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { creatorForUser } from "@/lib/creators/repository";
export const metadata = pageMetadata("Become a creator", "/creator/apply", siteConfig.description, true);
export default async function Apply() {
  const viewer = await getViewer();
  const initial =
    viewer?.role === "creator" ? await creatorForUser(viewer.id) : undefined;
  return (
    <CreatorEditor
      initial={initial || undefined}
      demo={!getSupabaseConfig()}
    />
  );
}
