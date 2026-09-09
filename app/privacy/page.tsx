import { DraftPolicy } from "@/components/draft-policy";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata(
  "Privacy",
  "/privacy",
  "Draft privacy outline for ReplyPass. Pending review before production launch.",
  true,
);
export default function Page() {
  return (
    <DraftPolicy
      title="Privacy"
      topics={[
        "Data collected for accounts, messages and creator requests.",
        "Service providers, storage, retention and deletion practices to be confirmed.",
        "Privacy contacts and applicable user-request processes.",
      ]}
    />
  );
}
