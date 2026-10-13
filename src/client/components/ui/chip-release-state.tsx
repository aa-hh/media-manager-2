// v2/Chip/release-state — ~/Projects/media-manager-2-design/design-system.lib.pen rm58v
// v2/Chip/release-state/downloading — ~/Projects/media-manager-2-design/design-system.lib.pen qdwqf
// v2/Chip/release-state/importing — ~/Projects/media-manager-2-design/design-system.lib.pen VbdBY
// v2/Chip/release-state/stalled — ~/Projects/media-manager-2-design/design-system.lib.pen SZZmJ
// v2/Chip/release-state/import blocked — ~/Projects/media-manager-2-design/design-system.lib.pen txMnk
// v2/Chip/release-state/cooldown — ~/Projects/media-manager-2-design/design-system.lib.pen TaPbW
// v2/Chip/release-state/yours — ~/Projects/media-manager-2-design/design-system.lib.pen V84eV
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';
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
      {state !== 'cooldown' && state !== 'yours' && <StatusDownloadCircle state={state} percent={shown} />}
      {state === 'downloading' ? `${shown}%` : words[state]}
    </Badge>
  );
}

export { ChipReleaseState };
export type { ReleaseState };
