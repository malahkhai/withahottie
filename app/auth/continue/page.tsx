import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { safeNext, isCreatorDestination } from "@/lib/auth/paths";
export default async function Continue({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const next = safeNext((await searchParams).next);
  if (next === "/reset-password") redirect(next);
  redirect(
    next === "/creator/apply" || isCreatorDestination(next)
      ? next
      : viewer.role === "creator" || viewer.role === "admin"
        ? "/creator/dashboard"
        : "/account",
  );
}
