const creatorRequest =
  /^\/@[a-z0-9_]{3,30}(?:\?interaction=(?:message|live_chat|voice_note|photo|video|vip))?$/;
export function isCreatorDestination(
  next: string | null | undefined,
): next is string {
  return !!next && creatorRequest.test(next);
}
export function safeNext(next: string | null | undefined) {
  return next &&
    (/^\/(creator\/(apply|dashboard)|account)$/.test(next) ||
      isCreatorDestination(next))
    ? next
    : "/account";
}
export function signupAllowed(next: string | null | undefined) {
  return next === "/creator/apply" || isCreatorDestination(next);
}
