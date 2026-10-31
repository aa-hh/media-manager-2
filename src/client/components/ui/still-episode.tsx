// Figma: StillEpisode — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=117-4144
import { Check, Play } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type StillEpisodeProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** The episode's still; without one the muted placeholder shows (not aired, or no image yet). */
  image?: string;
  /** No file: the still turns grey and fades. */
  noFile?: boolean;
  /** Downloading percent: the still fades and a 4 px lime strip runs along its foot. */
  downloading?: number;
  /** Watched percent of an episode stopped partway: the 6 px blue watch bar along its foot. */
  watched?: number;
  /** Fully watched: the still at 60 % with a small dark tick at the top right. */
  played?: boolean;
  /** The next episode to watch: the play circle shows glow-blue at rest. */
  next?: boolean;
  /** Only a still with a file is a button; give it an aria-label such as "Play E05" or "Resume E04". */
  playable?: boolean;
};

/**
 * 72 by 40 still at the start of an episode row, radius 4. A playable still shows a dark scrim and a white play circle on hover
 * and keyboard focus, and a 2 px inner ring on focus; on the next episode the circle is glow-blue and shows at rest.
 */
function StillEpisode({ image, noFile = false, downloading, watched, played = false, next = false, playable = false, className, ...props }: StillEpisodeProps) {
  const parts = (
    <>
      {image !== undefined
        ? <img src={image} alt="" className={cn('size-full object-cover', noFile && 'grayscale')} />
        : <span className="absolute inset-0 rounded-[inherit] bg-muted ring-1 ring-border ring-inset" />}
      {(noFile || downloading !== undefined) && <span className="absolute inset-0 bg-background/55" />}
      {playable && (
        <>
          <span className="absolute inset-0 bg-foreground/40 opacity-0 dark:bg-black/40 transition-opacity duration-(--duration-fast) ease-out group-hover/still:opacity-100 group-focus-visible/still:opacity-100" />
          <span
            className={cn(
              'absolute top-2 left-6 flex size-6 items-center justify-center rounded-full transition-opacity duration-(--duration-fast) ease-out',
              next ? 'bg-action text-action-foreground' : 'bg-white text-foreground opacity-0 dark:text-black group-hover/still:opacity-100 group-focus-visible/still:opacity-100',
            )}
          >
            <Play aria-hidden="true" className="size-3" />
          </span>
        </>
      )}
      {watched !== undefined && (
        <span className="absolute inset-x-0 bottom-0 h-1.5 bg-foreground/60 dark:bg-black/60">
          <span style={{ width: `${Math.min(100, Math.max(0, watched))}%` }} className="block h-full bg-watch-bar" />
        </span>
      )}
      {downloading !== undefined && (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-foreground/70 dark:bg-black/70">
          <span style={{ width: `${Math.min(100, Math.max(0, downloading))}%` }} className="block h-full bg-live" />
        </span>
      )}
      {played && (
        <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-surface-on-video">
          <Check aria-hidden="true" className="size-2.5 text-white" />
        </span>
      )}
    </>
  );
  const box = cn('relative block h-10 w-18 shrink-0 overflow-hidden rounded-xs', played && 'opacity-60', className);
  if (!playable) return <span aria-hidden="true" className={box}>{parts}</span>;
  return (
    <button
      type="button"
      className={cn(
        box,
        'group/still cursor-pointer outline-none',
        // The focus ring sits inside the still, over the picture.
        'after:absolute after:inset-0 after:rounded-[inherit] after:border-2 after:border-ring after:opacity-0 focus-visible:after:opacity-100',
      )}
      {...props}
    >
      {parts}
    </button>
  );
}

export { StillEpisode };
