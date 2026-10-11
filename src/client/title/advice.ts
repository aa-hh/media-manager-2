import { useEffect, useState } from 'react';
import { getJson, type RemovalAdvice } from '../library/api';

export type AdviceState = { kind: 'loading' } | { kind: 'ready'; advice: RemovalAdvice } | { kind: 'failed' };

export const recommendationLabels: Record<RemovalAdvice['recommendation'], string> = {
  safe: 'Safe to remove',
  keep: 'Keep seeding',
  unconfirmed: "Can't confirm yet",
};

// The server's reason repeats the recommendation before a colon ("Keep seeding: 31 hours of seeding left");
// shown under a label that already says it, only the part after the colon is kept.
export const adviceReason = (reason: string) => {
  const rest = reason.replace(/^(Keep seeding|Can't confirm yet; keep seeding|Can't tell; keep seeding): /, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};

export const unknownHistory = (reason: string) => reason.startsWith('Seeding time unknown');

/** The hit and run recommendation for one torrent, read when `hash` is set; advice only, nothing is removed. */
export const useAdvice = (hash: string | null, onUnauthenticated: () => void): AdviceState | null => {
  const [state, setState] = useState<AdviceState | null>(null);
  useEffect(() => {
    if (hash === null) {
      setState(null);
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });
    getJson<RemovalAdvice>(`/api/advice/${encodeURIComponent(hash)}`, onUnauthenticated, controller.signal)
      .then((advice) => setState({ kind: 'ready', advice }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'failed' });
      });
    return () => controller.abort();
  }, [hash]);
  return state;
};
