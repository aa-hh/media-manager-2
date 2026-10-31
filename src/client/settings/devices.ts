/** One signed-in TV, as `GET /api/devices` lists it. Times are milliseconds since the epoch. */
export type SignedInTv = { id: string; name: string; signedInAt: number; expiresAt: number };

/** How long a TV stays signed in after it was last used (`DEVICE_SESSION_LIFETIME_MS` in src/server/auth.ts). */
export const TV_SESSION_DAYS = 90;
const DAY_MS = 24 * 60 * 60_000;

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * The server moves a TV's expiry to 90 days out each time it is used (at most once a day) and sends no last-used time,
 * so last used is the expiry less 90 days: right to within a day. Never before it signed in.
 */
export const lastUsedAt = (tv: SignedInTv) => Math.max(tv.signedInAt, tv.expiresAt - TV_SESSION_DAYS * DAY_MS);

/** "Signed in 12 Oct 2026 · Last used today", in the browser's time zone. */
export const tvDates = (tv: SignedInTv, now: number) => {
  const used = lastUsedAt(tv);
  return `Signed in ${dayFormat.format(tv.signedInAt)} · Last used ${sameDay(used, now) ? 'today' : dayFormat.format(used)}`;
};
