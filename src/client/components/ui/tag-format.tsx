// v2/Tag/format — ~/Projects/media-manager-2-design/design-system.lib.pen NNH8u
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** One audio or picture format, such as DDP 5.1 or HDR10: 16 high, outlined in input grey, never wrapping. */
function TagFormat({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-4 shrink-0 items-center rounded-xs border border-input px-1 font-data text-[12px] font-semibold whitespace-nowrap text-muted-foreground', className)}>
      {children}
    </span>
  );
}

export { TagFormat };
