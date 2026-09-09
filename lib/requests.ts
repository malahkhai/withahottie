import type { CreatorRequest, RequestState } from "../types/creator.ts";
export function expiryLabel(expiresAt: string, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  if (!Number.isFinite(seconds) || seconds === 0) return "Expired";
  const hours = Math.floor(seconds / 3600);
  return `Expires in ${hours ? `${hours}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
export function requestState(
  request: CreatorRequest,
  now = Date.now(),
): RequestState {
  return request.status === "pending" && Date.parse(request.expires_at) <= now
    ? "expired"
    : request.status;
}
export function transitionRequest(
  request: CreatorRequest,
  action: string,
  now = Date.now(),
): CreatorRequest {
  const state = requestState(request, now);
  if (!(
    (state === "pending" && ["accept", "decline"].includes(action)) ||
    (state === "accepted" && action === "complete")
  ))
    throw new Error("This request can no longer be updated.");
  const stamp = new Date(now).toISOString();
  return {
    ...request,
    status:
      action === "accept"
        ? "accepted"
        : action === "decline"
          ? "declined"
          : "completed",
    accepted_at: action === "accept" ? stamp : request.accepted_at,
    declined_at: action === "decline" ? stamp : request.declined_at,
    completed_at: action === "complete" ? stamp : request.completed_at,
  };
}
