// Error block — ~/Projects/media-manager-2-design/player.pen pt3DH and sTAGM (plain frames in GrqIz states 13 and 14)
// Not in Figma yet.
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PlayerErrorProps = {
  /** A lucide icon, such as CircleAlert when playback failed or ServerOff when Plex can't be reached. */
  icon: ReactNode;
  title: ReactNode;
  body: ReactNode;
  /** One data-font line: what was tried, or when the next try runs. */
  detail?: ReactNode;
  /** A default Button (Retry, Try again) and an outline-on-dark Button (Close player). */
  actions: ReactNode;
  className?: string;
};

/** Centred over the dimmed last frame: a 36 px red icon, a 22/700 title, a sentence, the detail line and two buttons. 600 px wide; pass w-125 for the shorter Can't reach Plex block. */
function PlayerError({ icon, title, body, detail, actions, className }: PlayerErrorProps) {
  return (
    <div className={cn('flex w-150 flex-col items-center gap-3 text-center', className)}>
      <span aria-hidden="true" className="flex text-destructive-on-dark [&>svg]:size-9">{icon}</span>
      <h2 className="font-ui text-[22px] font-bold text-foreground-on-dark">{title}</h2>
      <p className="w-full font-ui text-sm leading-[1.5] text-muted-foreground-on-dark">{body}</p>
      {detail !== undefined && <p className="font-data text-[13px] text-muted-foreground-on-dark">{detail}</p>}
      <div className="flex gap-2 pt-3">{actions}</div>
    </div>
  );
}

export { PlayerError };
