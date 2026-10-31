// Figma: v2/Slider/on-dark (SliderOnDark) — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=135-1653
// Figma: v2/VolumePopover/vertical (VolumePopover) — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=135-1668
// Figma: v2/Icon/VolumeX (Icon/VolumeX) — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=135-1601
import { Slider } from '@base-ui/react/slider';
import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// "Closes a moment after it leaves": long enough to forgive a pointer that slips off the edge.
const CLOSE_DELAY_MS = 300;

type SliderOnDarkProps = {
  /** 0 to 100. */
  value: number;
  /** Greys the level and the thumb; the level stays where it will return to. */
  muted?: boolean;
  onValueChange: (value: number) => void;
  className?: string;
};

/** The upright slider over the picture: 120 high, a 4 px `input-on-dark` track, the level in `foreground-on-dark`, a 14 px white thumb; 5 % steps. */
function SliderOnDark({ value, muted = false, onValueChange, className }: SliderOnDarkProps) {
  return (
    <Slider.Root value={value} min={0} max={100} step={5} orientation="vertical" onValueChange={(next) => onValueChange(next)} className={cn('h-30 w-3.5', className)}>
      <Slider.Control className="relative flex size-full cursor-pointer touch-none justify-center">
        <Slider.Track className="relative h-full w-1 rounded-[2px] bg-input-on-dark">
          <Slider.Indicator className={cn('w-full rounded-[2px]', muted ? 'bg-muted-foreground-on-dark' : 'bg-foreground-on-dark')} />
          <Slider.Thumb
            getAriaLabel={() => 'Volume'}
            getAriaValueText={(_, percent) => (muted ? `Muted, ${percent} %` : `${percent} %`)}
            className={cn(
              'size-3.5 rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-on-dark',
              muted ? 'bg-muted-foreground-on-dark' : 'bg-white',
            )}
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

/** The panel above the Volume button: 52 wide on the dark menu surface, the level as "62 %" (or "Muted") over the upright slider. */
function VolumePopover({ value, muted = false, onValueChange, className }: SliderOnDarkProps) {
  return (
    <div
      className={cn(
        'flex w-13 flex-col items-center gap-3 rounded-lg border border-border-on-video bg-bar pt-3 pb-3.5 shadow-[0_2px_6px_#0000004d,0_8px_24px_#00000066]',
        className,
      )}
    >
      {muted
        ? <span className="font-ui text-xs font-semibold text-muted-foreground-on-dark">Muted</span>
        : <span className="font-data text-sm font-semibold text-foreground-on-dark">{value} %</span>}
      <SliderOnDark value={value} muted={muted} onValueChange={onValueChange} />
    </div>
  );
}

type VolumeButtonProps = {
  /** 0 to 100. */
  volume: number;
  muted: boolean;
  /** A click on the speaker mutes and unmutes. */
  onMute: () => void;
  onVolumeChange: (percent: number) => void;
  /** The mouse wheel over the button or the panel, as the event's deltaY. */
  onWheel?: (deltaY: number) => void;
  /** Whether the panel shows, so the player keeps its controls up meanwhile. */
  onOpenChange?: (open: boolean) => void;
  /** Open at first (stories). */
  defaultOpen?: boolean;
};

/**
 * The player's Volume button: the speaker, crossed out while muted. Pointing at it or focusing it opens the slider panel 10 px
 * above it; the panel stays while the pointer is on the button or the panel (the gap between them belongs to the panel) and
 * closes a moment after it leaves.
 */
function VolumeButton({ volume, muted, onMute, onVolumeChange, onWheel, onOpenChange, defaultOpen = false }: VolumeButtonProps) {
  const [open, setOpen] = useState(defaultOpen);
  const closeTimer = useRef<number | undefined>(undefined);
  const report = useRef(onOpenChange);
  report.current = onOpenChange;

  const show = (next: boolean) => {
    window.clearTimeout(closeTimer.current);
    setOpen(next);
  };
  useEffect(() => { report.current?.(open); }, [open]);
  // Unmounted while open (the controls hid, the screen changed): the player must not keep its controls for a panel that is gone.
  useEffect(() => () => {
    window.clearTimeout(closeTimer.current);
    report.current?.(false);
  }, []);

  return (
    <div
      className="relative"
      onPointerEnter={() => show(true)}
      onPointerLeave={() => {
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
      }}
      onFocus={() => show(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) show(false);
      }}
      onWheel={onWheel === undefined ? undefined : (event) => onWheel(event.deltaY)}
    >
      <Button variant="on-dark" iconOnly icon={muted ? <VolumeX /> : <Volume2 />} aria-label={muted ? 'Unmute' : 'Mute'} onClick={onMute} />
      {open && (
        // pb-2.5 is the 10 px gap, inside the panel's box so the pointer never leaves while crossing it.
        <div className="absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2.5">
          <VolumePopover value={volume} muted={muted} onValueChange={onVolumeChange} />
        </div>
      )}
    </div>
  );
}

export { SliderOnDark, VolumeButton, VolumePopover };
