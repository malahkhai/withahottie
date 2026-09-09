export const metadata = { robots: { index: false, follow: false } };
import { requireRole } from "@/lib/auth/session";
import { loadWorkspace } from "@/lib/workspace/repository";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { WorkspaceShell } from "@/components/workspace-shell";
import { redirect } from "next/navigation";
export default async function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireRole(["creator", "admin"], "/creator/dashboard");
  const data = await loadWorkspace(viewer);
  if (!data.creator.username) redirect("/creator/apply");
  return (
    <WorkspaceProvider initial={data}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceProvider>
  );
}
