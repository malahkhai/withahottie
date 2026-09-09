import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/paths";
export default async function Continue({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const next = safeNext((await searchParams).next);
  redirect(
    next === "/creator/apply"
      ? next
      : viewer.role === "creator" || viewer.role === "admin"
        ? "/creator/dashboard"
        : "/account",
  );
}
