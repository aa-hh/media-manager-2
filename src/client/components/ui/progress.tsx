// v2/Progress — ~/Projects/media-manager-2-design/design-system.lib.pen eCSrr
import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type ProgressTone = 'downloading' | 'stalled' | 'done' | 'on-dark';

const fills: Record<ProgressTone, string> = {
  downloading: 'bg-foreground',
  stalled: 'bg-destructive',
  done: 'bg-subtle-foreground',
  'on-dark': 'bg-live',
};

/** 4 px bar. Black while downloading, red when stalled, grey when done; lime only on the black downloads bar or a poster. */
function Progress({ tone = 'downloading', className, ...props }: ComponentProps<typeof ProgressPrimitive.Root> & { tone?: ProgressTone }) {
  return (
    <ProgressPrimitive.Root className={cn('w-full', className)} {...props}>
      <ProgressPrimitive.Track className={cn('h-1 w-full overflow-hidden rounded-full', tone === 'on-dark' ? 'bg-bar-foreground/20' : 'bg-surface-pressed')}>
        <ProgressPrimitive.Indicator className={cn('h-full rounded-full transition-[width] duration-(--duration-slow) ease-out', fills[tone])} />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
export type { ProgressTone };
