// v2/Status/rule pill — design/design-system.lib.pen ir39A
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RuleTone = 'default' | 'warning';

type StatusRulePillProps = ComponentProps<'span'> & {
  /** warning: amber dot and words on warning-soft, for No rule and No account stats. */
  tone?: RuleTone;
  /** State words, such as "Configured", "Configured (env file)" or "No rule". */
  children: ReactNode;
};

/** A tracker's hit and run rule state: a dot and words, no logo or icon of its own. */
function StatusRulePill({ tone = 'default', className, children, ...props }: StatusRulePillProps) {
  const warning = tone === 'warning';
  return (
    <span
      className={cn(
        'inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-sm px-2',
        warning ? 'bg-warning-soft' : 'bg-muted',
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', warning ? 'bg-warning' : 'bg-foreground')} />
      <span className={cn('font-data text-[13px] whitespace-nowrap', warning ? 'text-warning' : 'text-muted-foreground')}>{children}</span>
    </span>
  );
}

export { StatusRulePill };
export type { RuleTone };
