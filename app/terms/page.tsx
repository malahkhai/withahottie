import { DraftPolicy } from "@/components/draft-policy";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Terms",
  "/terms",
  "Draft terms outline for ReplyPass. Pending review before production launch.",
  true,
);
export default function Page() {
  return (
    <DraftPolicy
      title="Terms"
      topics={[
        "Account access and acceptable use.",
        "How creator interactions, subscriptions and the no-reply promise will work.",
        "Pricing, cancellations, disputes and responsibilities to be defined before payments.",
      ]}
    />
  );
}
