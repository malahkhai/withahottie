import { siteConfig } from "@/lib/site";
export function DraftPolicy({
  title,
  topics,
}: {
  title: string;
  topics: string[];
}) {
  return (
    <main id="main" className="draft-policy">
      <p className="eyebrow">{siteConfig.name} · Trust & community</p>
      <h1>{title}</h1>
      <p className="draft-notice">
        <strong>Draft placeholder — not finalized.</strong> This page is a
        planning outline for review before production launch. It does not
        establish final terms, describe a completed legal review, or promise
        compliance.
      </p>
      <h2>What this page will cover</h2>
      <ul>
        {topics.map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
      <p>
        Final wording, the responsible business entity, contact details and any
        applicable dates must be confirmed before publication. Payments are
        currently mocked; no real charge is processed by this version.
      </p>
    </main>
  );
}
