// Figma: ChipFit — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-892
import { MonitorX, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ChipFitKind = 'score' | 'negative' | 'best' | 'best-star' | 'rejected';

const looks: Record<ChipFitKind, string> = {
  score: 'border border-input text-muted-foreground',
  negative: 'bg-warning-soft text-warning',
  best: 'bg-best text-best-foreground',
  'best-star': 'bg-best text-best-foreground',
  rejected: 'bg-destructive-soft text-destructive',
};

// The star and the rejected mark carry no words, so screen readers get these instead.
const labels: Partial<Record<ChipFitKind, string>> = { 'best-star': 'Best', rejected: 'Rejected' };

/** How a release fits the profile, 36 by 20 at the fit cell's left edge: its score, the best star, or rejected with the reasons in the tooltip. */
function ChipFit({ kind, tooltip, children }: { kind: ChipFitKind; tooltip?: string; children?: ReactNode }) {
  const label = kind === 'rejected' && tooltip !== undefined ? `Rejected: ${tooltip}` : labels[kind];
  const chip = (
    <span
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      // Focusable when it has a tooltip, so the tooltip opens from the keyboard too.
      tabIndex={tooltip === undefined ? undefined : 0}
      className={cn('inline-flex h-5 w-9 shrink-0 items-center justify-center rounded-xs px-(--badge-px) font-data text-[13px] font-medium whitespace-nowrap', looks[kind])}
    >
      {kind === 'best-star' ? <Star aria-hidden="true" className="size-3" />
        : kind === 'rejected' ? <MonitorX aria-hidden="true" className="size-4" />
          : children}
    </span>
  );
  return tooltip === undefined ? chip : <Tooltip text={tooltip}>{chip}</Tooltip>;
}

export { ChipFit };
export type { ChipFitKind };
