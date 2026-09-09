export function safeNext(next: string | null | undefined) {
  return next && /^\/(creator\/(apply|dashboard)|account)$/.test(next)
    ? next
    : "/account";
}
