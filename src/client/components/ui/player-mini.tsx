// Figma: PlayerMini — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=112-396
import { Maximize2, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PlayerMiniProps = {
  /** The picture; in the desktop app the video shows through from mpv's window below, so leave it out and pass bg-transparent. */
  picture?: ReactNode;
  title: ReactNode;
  /** "47:12 / 1:56:00". */
  time: ReactNode;
  /** Watched percent, 0 to 100. */
  progress: number;
  playing: boolean;
  /** The speaker at the top left, crossed out while muted; no slider here, since the arrow keys belong to the page. */
  muted: boolean;
  onMute: () => void;
  onPlayPause: () => void;
  onExpand: () => void;
  onClose: () => void;
  className?: string;
};

/**
 * 400 by 225 player inside the app window, bottom right above the downloads bar, radius 12 with the float shadow.
 * The scrim, mute, buttons, title, time and progress line show while the pointer is over it or focus is inside; otherwise only the picture.
 */
function PlayerMini({ picture, title, time, progress, playing, muted, onMute, onPlayPause, onExpand, onClose, className }: PlayerMiniProps) {
  const corner = 'w-9 [&>svg]:size-4.5';
  return (
    <div className={cn('group/mini relative h-56.25 w-100 overflow-hidden rounded-lg bg-black shadow-[0_2px_6px_#1111110f,0_12px_32px_#11111140]', className)}>
      {picture !== undefined && <div className="absolute inset-0 [&>img]:size-full [&>img]:object-cover">{picture}</div>}
      <div
        className={cn(
          'absolute inset-0 opacity-0 transition-opacity duration-(--duration-fast) ease-out',
          'group-hover/mini:opacity-100 group-focus-within/mini:opacity-100',
          'bg-[linear-gradient(to_bottom,#00000080_0%,#00000026_45%,#000000b3_100%)]',
        )}
      >
        <Button variant="on-dark" iconOnly icon={muted ? <VolumeX /> : <Volume2 />} aria-label={muted ? 'Unmute' : 'Mute'} onClick={onMute} className={cn('absolute top-2 left-2', corner)} />
        <div className="absolute top-2 right-2 flex gap-1">
          <Button variant="on-dark" iconOnly icon={<Maximize2 />} aria-label="Back to full size" onClick={onExpand} className={corner} />
          <Button variant="on-dark" iconOnly icon={<X />} aria-label="Close" onClick={onClose} className={corner} />
        </div>
        <button
          type="button"
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={onPlayPause}
          className="absolute top-21 left-43 flex size-14 items-center justify-center rounded-full bg-black/40 text-foreground-on-dark focus-ring-on-dark [&>svg]:size-7"
        >
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>
        <div className="absolute inset-x-3 bottom-5.5 flex items-center justify-between gap-3">
          <span className="truncate font-ui text-[13px] font-semibold text-foreground-on-dark">{title}</span>
          <span className="shrink-0 font-data text-[13px] text-muted-foreground-on-dark">{time}</span>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.75 overflow-hidden bg-input-on-dark">
          <div style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} className="h-full bg-foreground-on-dark" />
        </div>
      </div>
    </div>
  );
}

export { PlayerMini };
