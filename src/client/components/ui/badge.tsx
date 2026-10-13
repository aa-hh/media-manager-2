// v2/Badge — ~/Projects/media-manager-2-design/design-system.lib.pen zGBcp
// v2/Badge/inline — ~/Projects/media-manager-2-design/design-system.lib.pen J92fI (variant="inline-value")
import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'strong' | 'best' | 'live' | 'risk' | 'warning' | 'outline' | 'plain' | 'inline' | 'inline-value';

type BadgeProps = ComponentProps<'span'> & {
  variant?: BadgeVariant;
  /** A lucide icon before the label (12 px, 14 px on plain), such as BookmarkX for Not monitored. */
  icon?: ReactNode;
  /** Spinner before the label; for Searching only. */
  spinner?: boolean;
  /** How far the live look's download circle is filled, 0 to 100. */
  percent?: number;
};

const variants: Record<BadgeVariant, string> = {
  neutral: 'bg-muted text-muted-foreground',
  strong: 'bg-primary text-primary-foreground',
  best: 'bg-best text-foreground',
  live: 'bg-muted text-foreground',
  risk: 'bg-destructive-soft text-destructive',
  warning: 'bg-warning-soft text-warning',
  outline: 'border border-input bg-transparent text-muted-foreground',
  // A standing status beside a row button, such as In library: no box, so it never reads as a button, at the
  // button's row height and text size.
  plain: 'h-(--control-h-row) text-(length:--control-text-row) text-muted-foreground [&>svg]:size-(--control-icon-row) [&>svg]:text-foreground',
  /** The service logo and name in the add dialog's sentence (interface font, 500); never focusable. */
  inline: 'h-[38px] rounded-sm px-3 gap-2 font-ui text-[22px] font-medium bg-inline-control text-inline-control-foreground [&>svg]:size-5 [&>img]:size-6',
  /** v2/Badge/inline: a calculated number or date in the same sentence (data font, 700, 26px, tabular); never focusable. */
  'inline-value': 'h-[38px] rounded-sm px-3 font-data text-[26px] font-bold leading-[1.3] bg-inline-control text-inline-control-foreground',
};

/** Not interactive, so no hover or focus. The live look carries the download circle. */
function Badge({ variant = 'neutral', icon, spinner = false, percent, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-xs font-semibold whitespace-nowrap',
        variant !== 'inline-value' && 'font-ui',
        variant !== 'plain' && variant !== 'inline' && variant !== 'inline-value' && 'h-(--badge-h) px-(--badge-px) text-(length:--badge-text) [&>svg]:size-(--badge-icon)',
        variants[variant],
        className,
      )}
      {...props}
    >
      {variant === 'live' && <StatusDownloadCircle state="downloading" percent={percent} />}
      {spinner && <Spinner className="text-current" />}
      {icon}
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeVariant };
