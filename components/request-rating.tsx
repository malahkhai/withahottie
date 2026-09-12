"use client";

import { useState } from "react";

export function RequestRating({
  interactionId,
  creatorName,
  initialScore,
}: {
  interactionId: string;
  creatorName: string;
  initialScore: number | null;
}) {
  const [score, setScore] = useState(initialScore);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialScore ? "Thanks for sharing." : "");

  async function save(nextScore: number) {
    setScore(nextScore);
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interactionId, score: nextScore }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Unable to save rating.");
      setMessage("Thanks for sharing.");
    } catch (error) {
      setScore(initialScore);
      setMessage(error instanceof Error ? error.message : "Unable to save rating.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="request-rating" aria-label={`Rate your reply from ${creatorName}`}>
      <div>
        <strong>{score ? "Your rating" : `How was ${creatorName}’s reply?`}</strong>
        <span>{message || "Your feedback helps build trust."}</span>
      </div>
      <div className="request-rating-stars" role="group" aria-label="Rating out of five">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            disabled={saving}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            aria-pressed={score === value}
            className={score && value <= score ? "is-selected" : ""}
            onClick={() => save(value)}
          >
            ★
          </button>
        ))}
      </div>
    </section>
  );
}

