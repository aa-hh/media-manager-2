// Figma: StatusDownloadCircle — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-414
import { cn } from '@/lib/utils';

type DownloadCircleState = 'grabbed' | 'downloading' | 'importing' | 'stalled' | 'import-blocked';

const colours: Record<DownloadCircleState, string> = {
  grabbed: 'var(--status-queued)',
  downloading: 'var(--status-downloading)',
  importing: 'var(--status-importing)',
  stalled: 'var(--status-stalled)',
  'import-blocked': 'var(--status-blocked)',
};

// 12 px: a 1.8 px ring plus a fill. A pie fills clockwise from 12 o'clock; importing turns its ring, gap first.
function StatusDownloadCircle({ state, percent = 0 }: { state: DownloadCircleState; percent?: number }) {
  const colour = colours[state];
  const solid = state === 'grabbed' || state === 'import-blocked';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={cn('size-3 shrink-0', state === 'importing' && 'animate-[spin_var(--duration-spin)_linear_infinite] motion-reduce:animate-none')}
    >
      {solid ? <circle cx="6" cy="6" r="6" fill={colour} /> : (
        <>
          <circle
            cx="6"
            cy="6"
            r="5.1"
            fill="none"
            stroke={colour}
            strokeWidth="1.8"
            pathLength={100}
            strokeDasharray={state === 'importing' ? '75 100' : undefined}
            transform="rotate(-90 6 6)"
          />
          {state !== 'importing' && (
            <circle cx="6" cy="6" r="3" fill="none" stroke={colour} strokeWidth="6" pathLength={100} strokeDasharray={`${percent} 100`} transform="rotate(-90 6 6)" />
          )}
        </>
      )}
    </svg>
  );
}

export { StatusDownloadCircle };
export type { DownloadCircleState };
