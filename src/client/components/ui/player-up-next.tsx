// Figma: PlayerUpNext — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=113-516
import { Circle, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type UpNextStep = {
  label: ReactNode;
  detail: ReactNode;
  /** The step running now shows a spinner and bold white text; the others wait with an empty circle. */
  active?: boolean;
  /** Percent done, drawn as the lime bar under an active step (the download). */
  progress?: number;
};

type PlayerUpNextProps = {
  /** "Next episode". */
  heading: ReactNode;
  /** Seconds left before the next episode plays, with the white bar that empties; leave out while it waits for a download. */
  countdown?: { seconds: number; fraction: number };
  /** Shown in place of the countdown, such as "Starts when it's ready". */
  waiting?: ReactNode;
  still?: string;
  show: ReactNode;
  episode: ReactNode;
  /** Runtime, such as "56 min". */
  facts: ReactNode;
  /** Two lines at most, so the block keeps its height. */
  summary?: ReactNode;
  /** Download, importing and the two Plex steps while the next episode is not ready yet. */
  steps?: UpNextStep[];
  note?: ReactNode;
  /** Plays the next episode now; it has focus, so Enter presses it. Left out while waiting. */
  onPlayNow?: () => void;
  /** "Back to library" or "Stop waiting". */
  wayOut: ReactNode;
  onWayOut: () => void;
  className?: string;
};

const darkKbd = 'border-0 bg-white/40 text-white';

/** The block in the middle of the black player after an episode ends: heading and countdown, the next item, the waiting steps, and the way on or out. 800 px wide. */
function PlayerUpNext({ heading, countdown, waiting, still, show, episode, facts, summary, steps, note, onPlayNow, wayOut, onWayOut, className }: PlayerUpNextProps) {
  return (
    <section className={cn('flex w-200 flex-col gap-6', className)}>
      <div className="flex items-end justify-between">
        <h2 className="font-ui text-[28px] font-bold text-foreground-on-dark">{heading}</h2>
        <div className="flex items-end gap-2">
          {countdown !== undefined ? (
            <>
              <span className="font-ui text-base leading-[1.6] text-muted-foreground-on-dark">Starts in</span>
              <span className="font-data text-[28px] font-semibold text-foreground-on-dark">{countdown.seconds}s</span>
            </>
          ) : (
            <span className="font-ui text-base leading-[1.6] text-muted-foreground-on-dark">{waiting}</span>
          )}
        </div>
      </div>
      {countdown !== undefined && (
        <div aria-hidden="true" className="h-1 w-full overflow-hidden rounded-full bg-white/40">
          <div style={{ width: `${Math.min(1, Math.max(0, countdown.fraction)) * 100}%` }} className="h-full rounded-full bg-foreground-on-dark" />
        </div>
      )}
      <div className="flex items-center gap-6">
        <div className="h-49.5 w-88 shrink-0 overflow-hidden rounded-lg bg-black">
          {still !== undefined && <img src={still} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-ui text-xl font-bold text-foreground-on-dark">{show}</span>
          <span className="font-ui text-base font-medium text-foreground-on-dark">{episode}</span>
          <span className="font-data text-[15px] text-muted-foreground-on-dark">{facts}</span>
          {summary !== undefined && <p className="line-clamp-2 font-ui text-sm leading-[1.5] text-muted-foreground-on-dark">{summary}</p>}
        </div>
      </div>
      {steps !== undefined && (
        <ol className="flex flex-col gap-3.5 border-t border-border-on-video pt-5">
          {steps.map((step, index) => (
            <li key={index} className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {step.active === true
                  ? <Spinner className="size-5 text-foreground-on-dark" />
                  : <Circle aria-hidden="true" className="size-5 shrink-0 text-white/30" />}
                <span className={cn('font-ui text-[15px]', step.active === true ? 'font-bold text-foreground-on-dark' : 'font-semibold text-muted-foreground-on-dark')}>{step.label}</span>
                <span className={cn('font-data text-[15px]', step.active === true ? 'text-foreground-on-dark' : 'text-muted-foreground-on-dark')}>{step.detail}</span>
              </div>
              {step.active === true && step.progress !== undefined && (
                <div aria-hidden="true" className="ml-8 h-1 overflow-hidden rounded-full bg-white/40">
                  <div style={{ width: `${Math.min(100, Math.max(0, step.progress))}%` }} className="h-full rounded-full bg-live" />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {note !== undefined && <p className="font-ui text-[13px] text-muted-foreground-on-dark">{note}</p>}
      <div className="flex items-center gap-3">
        {onPlayNow !== undefined && (
          // The design rings Play now in white because it holds focus when the block opens.
          <Button icon={<Play />} onClick={onPlayNow} autoFocus className="focus-visible:outline-focus-on-dark!">Play now</Button>
        )}
        <Button variant="outline-on-dark" onClick={onWayOut} className="before:border-white/50">{wayOut}</Button>
        <span className="flex-1" />
        <div className="flex items-center gap-1.5 font-ui text-[13px] text-muted-foreground-on-dark">
          {onPlayNow !== undefined && (
            <>
              <Kbd className={darkKbd}>Enter</Kbd>
              <span>plays now</span>
              <span className="w-2.5" />
            </>
          )}
          <Kbd className={darkKbd}>Esc</Kbd>
          <span>{onPlayNow !== undefined ? 'back to library' : 'stop waiting'}</span>
        </div>
      </div>
    </section>
  );
}

export { PlayerUpNext };
export type { UpNextStep };
