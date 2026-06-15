// Throw on a {data,error} SDK result so route handlers can stay linear and the
// Hono onError hook turns it into a 500.
export function orThrow<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/** Format the gap between now and a due date the way the review UI shows it. */
export function formatInterval(now: Date, due: Date): string {
  const mins = Math.round((due.getTime() - now.getTime()) / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}
