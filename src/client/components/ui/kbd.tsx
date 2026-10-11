// v2/Kbd — design/design-system.lib.pen NAj8m
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type KbdProps = ComponentProps<'kbd'> & {
  icon?: ReactNode;
  /** Inside a black or red button or a tooltip: white 15% fill, no edge. */
  onFill?: boolean;
};

function Kbd({ icon, onFill = false, className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4.5 shrink-0 items-center justify-center gap-0.5 rounded-xs px-1.25 font-data text-xs font-medium [&_svg]:size-3',
        onFill
          ? 'bg-primary-foreground/15 text-primary-foreground/85'
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
