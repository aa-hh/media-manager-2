// v2/Chip/release-state — ~/Projects/media-manager-2-design/design-system.lib.pen rm58v
// v2/Chip/release-state/downloading — ~/Projects/media-manager-2-design/design-system.lib.pen qdwqf
// v2/Chip/release-state/importing — ~/Projects/media-manager-2-design/design-system.lib.pen VbdBY
// v2/Chip/release-state/stalled — ~/Projects/media-manager-2-design/design-system.lib.pen SZZmJ
// v2/Chip/release-state/import blocked — ~/Projects/media-manager-2-design/design-system.lib.pen txMnk
// v2/Chip/release-state/cooldown — ~/Projects/media-manager-2-design/design-system.lib.pen TaPbW
// v2/Chip/release-state/yours — ~/Projects/media-manager-2-design/design-system.lib.pen V84eV
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ReleaseState = 'grabbed' | 'downloading' | 'importing' | 'stalled' | 'import-blocked' | 'cooldown' | 'yours';

const variants: Record<ReleaseState, BadgeVariant> = {
  grabbed: 'neutral',
  downloading: 'neutral',
  importing: 'neutral',
  stalled: 'risk',
  'import-blocked': 'risk',
  cooldown: 'risk',
  yours: 'strong',
};

const words: Record<Exclude<ReleaseState, 'downloading'>, string> = {
  grabbed: 'Grabbed',
  importing: 'Importing',
  stalled: 'Stalled',
  'import-blocked': 'Import blocked',
  cooldown: 'Cooldown',
  yours: 'Yours',
};

// Typed in the library's v2/Status/download circle rather than taken from tokens.
const colours: Partial<Record<ReleaseState, string>> = {
  grabbed: '#E06A10',
  downloading: '#2F8A1F',
  importing: '#7A3FD1',
  stalled: '#E5534B',
  'import-blocked': '#A3150F',
};

// 12 px: a 1.8 px ring plus a fill. A pie fills clockwise from 12 o'clock; importing turns its ring, gap first.
function Circle({ state, percent }: { state: ReleaseState; percent: number }) {
  const colour = colours[state];
  if (colour === undefined) return null;
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

/** A release's state in the last column, 28 high: what happened after Grab, Cooldown in place of Grab, or Yours on the owned file. A change crossfades the colours while the words swap at once. */
function ChipReleaseState({ state, percent }: { state: ReleaseState; percent?: number }) {
  const shown = Math.floor(percent ?? 0);
  return (
    <Badge
      variant={variants[state]}
      className={cn(
        'h-(--control-h-row) rounded-(--control-radius-row) px-(--badge-px) text-[11px] font-semibold transition-colors duration-(--duration-base) ease-out',
        (state === 'grabbed' || state === 'downloading' || state === 'importing') && 'text-foreground',
        (state === 'cooldown' || state === 'yours') && 'px-2.5',
      )}
    >
      <Circle state={state} percent={shown} />
      {state === 'downloading' ? `${shown}%` : words[state]}
    </Badge>
  );
}

export { ChipReleaseState };
export type { ReleaseState };
