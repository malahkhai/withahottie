"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <div className="workspace-empty">
      <h2>We couldn’t load this just now.</h2>
      <p>Your data is safe. Give it another try.</p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
