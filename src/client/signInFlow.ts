// No imports: tests/production.test.mjs loads this file on its own.

export type SignInView =
  | 'status'
  | 'initial'
  | 'preparing'
  | 'checking'
  | 'pending'
  | 'interrupted'
  | 'wrong-owner'
  | 'unavailable'
  | 'not-configured'
  | 'expired'
  | 'invalid'
  | 'session-expired';

export type SignInScreen = 'success' | 'loading' | 'idle' | 'waiting' | 'error';

export type Timers = {
  setTimeout(callback: () => void, ms: number): number;
};

// 0.5 s green delay plus the 1.7 s success transition.
export const SUCCESS_HOLD_MS = 2_200;
export const RECHECK_TRIES = 5;

/** Every failure shows the same line; the owner chose one generic message over per-cause wording. */
export const signInScreen = (view: SignInView, plexInWindow: boolean, succeeded: boolean): { screen: SignInScreen; line?: string } => {
  if (succeeded) return { screen: 'success' };
  if (view === 'status') return { screen: 'loading' };
  if (view === 'initial') return { screen: 'idle' };
  if (view === 'session-expired') return { screen: 'idle', line: 'Your session expired. Sign in again.' };
  if (view === 'not-configured') return { screen: 'idle', line: 'Sign-in isn’t configured.' };
  if (view === 'preparing' || view === 'checking' || (view === 'pending' && plexInWindow)) return { screen: 'waiting' };
  return { screen: 'error', line: 'Couldn\'t log you in. Try again.' };
};

/**
 * Asks again after delayMs with one try fewer, unless the request was replaced meanwhile.
 * Returns false when no tries are left, so the caller shows the wait to the user instead.
 */
export const recheckLater = (
  timers: Timers,
  retriesLeft: number,
  delayMs: number,
  isCurrent: () => boolean,
  recheck: (retriesLeft: number) => void,
): boolean => {
  if (retriesLeft <= 0) return false;
  timers.setTimeout(() => {
    if (isCurrent()) recheck(retriesLeft - 1);
  }, delayMs);
  return true;
};

/** Calls done once: at once under reduced motion, else after SUCCESS_HOLD_MS. Returns the timer to clear on unmount. */
export const holdSuccess = (timers: Timers, reducedMotion: boolean, done: () => void): number | undefined => {
  if (reducedMotion) {
    done();
    return undefined;
  }
  return timers.setTimeout(done, SUCCESS_HOLD_MS);
};
