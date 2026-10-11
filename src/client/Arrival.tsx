import { type ReactNode, useLayoutEffect, useState } from 'react';
import { afterScreenChange, restoreScroll, useLateArrival } from './navigation';

/**
 * Where a skeleton gives way to content. Content that is ready while its screen change is still holding simply appears,
 * since the screen change itself crossfades. Content that arrives once its screen is showing crossfades over its skeleton:
 * the skeleton stays underneath and fades out while the content fades in, so anything both draw in the same place, such as
 * a poster, stays solid throughout (DESIGN.md Motion: skeleton to content). Content that arrives while the screen change's
 * crossfade is still playing waits for it, so a poster mid-morph is never swapped out.
 */
export function Arrival({ ready, skeleton, children }: { ready: boolean; skeleton: ReactNode; children: ReactNode }) {
  const [shown, setShown] = useState(ready);
  useLayoutEffect(() => {
    if (!ready) {
      setShown(false);
      return;
    }
    if (!shown) afterScreenChange(() => setShown(true));
  }, [ready, shown]);
  // The content is on the page now, tall enough for the screen's saved scroll.
  useLayoutEffect(() => {
    if (shown) restoreScroll(true);
  }, [shown]);
  const late = useLateArrival(shown);
  const [fading, setFading] = useState(false);
  useLayoutEffect(() => {
    if (late) setFading(true);
  }, [late]);
  if (!shown) return skeleton;
  return (
    <div className="relative">
      {fading && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 animate-content-out">{skeleton}</div>}
      <div
        className={fading ? 'animate-content-in' : undefined}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setFading(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
