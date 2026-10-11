// v2/Mark/comparison — design/design-system.lib.pen poV94
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Comparison = 'best' | 'better' | 'same' | 'worse' | 'yours';

const looks: Record<Comparison, string> = {
  best: 'bg-best font-semibold text-foreground',
  better: 'font-semibold text-foreground',
  same: 'font-medium text-subtle-foreground',
  worse: 'font-medium text-subtle-foreground',
  yours: 'border border-foreground font-semibold text-foreground',
};

/** Sits in its own 72 px column left of Size in release tables. Children replace the word. */
function MarkComparison({ kind, className, children, ...props }: ComponentProps<'span'> & { kind: Comparison }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-0.75 rounded-xs px-1.5 font-ui text-xs whitespace-nowrap [&>svg]:size-3', looks[kind], className)} {...props}>
      {kind === 'better' && <ArrowUp aria-hidden="true" />}
      {kind === 'worse' && <ArrowDown aria-hidden="true" />}
      {children ?? kind}
    </span>
  );
}

export { MarkComparison };
export type { Comparison };
