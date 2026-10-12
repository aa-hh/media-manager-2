// v2/Badge — ~/Projects/media-manager-2-design/design-system.lib.pen zGBcp
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'strong' | 'best' | 'live' | 'risk' | 'warning' | 'outline' | 'plain';

type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant;
  /** A lucide icon before the label (12 px, 14 px on plain), such as BookmarkX for Not monitored. */
  icon?: ReactNode;
  /** Spinner before the label; for Searching only. */
  spinner?: boolean;
  /** Adds a trailing remove button, for filter tags. */
  onRemove?: () => void;
  removeLabel?: string;
};

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  strong: 'bg-primary text-primary-foreground',
  best: 'bg-best text-foreground',
  live: 'bg-live text-foreground',
  risk: 'bg-destructive-soft text-destructive',
  warning: 'bg-warning-soft text-warning',
  outline: 'border border-input bg-transparent text-muted-foreground',
  // A standing status beside a row button, such as In library: no box, so it never reads as a button, at the
  // button's row height and text size.
  plain: 'h-(--control-h-row) text-(length:--control-text-row) text-muted-foreground [&>svg]:size-(--control-icon-row) [&>svg]:text-foreground',
};

/** Not interactive (the optional remove button aside), so no hover or focus. The live look carries the dot. */
function Badge({ variant = 'neutral', icon, spinner = false, onRemove, removeLabel, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-xs font-ui font-semibold whitespace-nowrap',
        variant !== 'plain' && 'h-(--badge-h) px-(--badge-px) text-(length:--badge-text) [&>svg]:size-(--badge-icon)',
        variants[variant],
        className,
      )}
      {...props}
    >
      {variant === 'live' && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />}
      {spinner && <Spinner className="text-current" />}
      {icon}
      {children}
      {onRemove !== undefined && (
        <button type="button" aria-label={removeLabel} onClick={onRemove} className="focus-ring flex rounded-xs">
          <X aria-hidden="true" className="size-3 text-muted-foreground" />
        </button>
      )}
    </span>
  );
}

export { Badge };
export type { BadgeVariant };
