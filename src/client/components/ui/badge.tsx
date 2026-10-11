// v2/Badge — design/design-system.lib.pen zGBcp
import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'strong' | 'best' | 'live' | 'risk' | 'warning' | 'outline';

type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant;
  /** A 12 px lucide icon before the label, such as BookmarkX for Not monitored. */
  icon?: ReactNode;
  /** Spinner before the label; for Searching only. */
  spinner?: boolean;
};

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  strong: 'bg-primary text-primary-foreground',
  best: 'bg-best text-foreground',
  live: 'bg-live text-foreground',
  risk: 'bg-destructive-soft text-destructive',
  warning: 'bg-warning-soft text-warning',
  outline: 'border border-input bg-transparent text-muted-foreground',
};

/** Not interactive, so no hover or focus. The live look carries the dot. */
function Badge({ variant = 'neutral', icon, spinner = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-xs px-1.5 font-ui text-[11px] font-semibold whitespace-nowrap [&>svg]:size-3',
        variants[variant],
        className,
      )}
      {...props}
    >
      {variant === 'live' && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />}
      {spinner && <Spinner className="text-current" />}
      {icon}
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeVariant };
