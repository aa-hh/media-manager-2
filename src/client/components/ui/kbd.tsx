// v2/Kbd — ~/Projects/media-manager-2-design/design-system.lib.pen NAj8m
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type KbdProps = ComponentProps<'kbd'> & {
  icon?: ReactNode;
  /** Inside a filled button or a tooltip: a 15% fill of the text colour, no edge. */
  onFill?: boolean;
};

function Kbd({ icon, onFill = false, className, children, ...props }: KbdProps) {
  return (
    <kbd
      // A kbd allows no aria-label; an icon-only key named by one is announced as an image.
      role={props['aria-label'] !== undefined ? 'img' : undefined}
      className={cn(
        'inline-flex h-4.5 shrink-0 items-center justify-center gap-0.5 rounded-xs px-1.25 font-data text-xs font-medium [&_svg]:size-3',
        onFill
          ? 'bg-current/15 text-current/85'
          : 'border border-b-2 border-border bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </kbd>
  );
}

export { Kbd };
