// v2/Label/group — design/design-system.lib.pen mk4uT
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Heading over a group of rows: 24 px above, 8 px below, no band and no line. */
function LabelGroup({ count, countRisk = false, className, children, ...props }: ComponentProps<'h2'> & { count?: ReactNode; countRisk?: boolean }) {
  return (
    <h2 className={cn('flex items-center gap-2 pt-6 pb-2 font-ui text-sm font-semibold text-foreground', className)} {...props}>
      {children}
      {count !== undefined && <span className={cn('font-data text-[13px] font-normal', countRisk ? 'text-destructive' : 'text-subtle-foreground')}>{count}</span>}
    </h2>
  );
}

export { LabelGroup };
