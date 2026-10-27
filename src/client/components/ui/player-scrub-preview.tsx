// Scrubbing preview — ~/Projects/media-manager-2-design/player.pen V9x4Ry (a plain frame in GrqIz state 11)
// Not in Figma yet.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PlayerScrubPreviewProps = {
  /** Plex's preview picture for the second under the pointer; the dark box shows until it arrives. */
  image?: string;
  /** The time under the pointer, such as "40:45". */
  time: ReactNode;
  /** The chapter under the pointer; left out for a file without chapters. */
  chapter?: ReactNode;
  className?: string;
};

/** 256 px picture with a 2 px light edge, the time under it and the chapter name, above the timeline while hovering or dragging. */
function PlayerScrubPreview({ image, time, chapter, className }: PlayerScrubPreviewProps) {
  return (
    <div className={cn('pointer-events-none flex w-64 flex-col items-center gap-2', className)}>
      <div className="h-36 w-64 overflow-hidden rounded-[6px] border-2 border-foreground-on-dark bg-black">
        {image !== undefined && <img src={image} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-data text-base font-semibold text-foreground-on-dark">{time}</span>
        {chapter !== undefined && <span className="font-ui text-[13px] text-muted-foreground-on-dark">{chapter}</span>}
      </div>
    </div>
  );
}

export { PlayerScrubPreview };
