// Figma: LineSavedToPlex — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-1122
import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

/** The last row of a dark player menu: the gold Plex mark and one 12 px sentence saying the choice was saved to Plex. */
function LineSavedToPlex({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('flex gap-2 p-2 font-ui text-xs leading-[1.45] text-bar-foreground', className)}>
      <span className="flex shrink-0 pt-0.5">
        <Logo name="plex-gold" alt="" className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  );
}

export { LineSavedToPlex };
