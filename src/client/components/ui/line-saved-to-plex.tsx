// Saved to Plex line — ~/Projects/media-manager-2-design/player.pen EdZDR (a plain frame in GrqIz states 5, 6 and 7)
// Not in Figma yet.
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
