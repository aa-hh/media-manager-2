import { useEffect, useState } from 'react';
import { getJson, type RemovalAdvice } from '../library/api';

export { recommendationLabels } from './secondVersionText';

export type AdviceState = { kind: 'loading' } | { kind: 'ready'; advice: RemovalAdvice } | { kind: 'failed' };

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
      .then((advice) => { if (!controller.signal.aborted) setState({ kind: 'ready', advice }); })
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: 'failed' });
      });
    return () => controller.abort();
  }, [hash]);
  return state;
};
