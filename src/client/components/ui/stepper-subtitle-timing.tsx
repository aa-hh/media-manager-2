// Subtitle timing stepper — ~/Projects/media-manager-2-design/player.pen eaMGS (a plain frame in GrqIz state 7)
// Not in Figma yet.
import { Menu } from '@base-ui/react/menu';
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StepperSubtitleTimingProps = {
  /** Seconds the subtitles are shifted; positive shows them later than the voice. */
  offset: number;
  onEarlier: () => void;
  onLater: () => void;
  className?: string;
};

function formatOffset(offset: number) {
  const tenths = Math.round(offset * 10);
  const sign = tenths > 0 ? '+' : tenths < 0 ? '−' : '';
  return `${sign}${(Math.abs(tenths) / 10).toFixed(1)} s`;
}

/**
 * The row inside the dark Subtitle timing menu (place it in a DropdownMenuContent): minus, the offset in 0.1 s steps with what
 * it means, plus. Minus and plus are menu rows, so the arrow keys reach them and a press keeps the menu open.
 * At 0.0 s the second line stays empty: the design draws only the "later than the voice" case.
 */
function StepperSubtitleTiming({ offset, onEarlier, onLater, className }: StepperSubtitleTimingProps) {
  const tenths = Math.round(offset * 10);
  const meaning = tenths > 0 ? 'later than the voice' : tenths < 0 ? 'earlier than the voice' : '';
  const step = 'before:bg-surface-hover-on-video';
  const valueId = useId();
  return (
    <div className={cn('flex items-center justify-between px-2 py-1', className)}>
      <Menu.Item closeOnClick={false} onClick={onEarlier} aria-describedby={valueId} render={<Button variant="on-dark" iconOnly icon={<Minus />} aria-label="Earlier" className={step} />} />
      <div id={valueId} className="flex flex-col items-center gap-0.5">
        <span className="font-data text-xl font-semibold text-bar-foreground">{formatOffset(offset)}</span>
        {/* min-h keeps the row one height when the line is empty. */}
        <span className="min-h-4 font-ui text-xs text-bar-muted-foreground">{meaning}</span>
      </div>
      <Menu.Item closeOnClick={false} onClick={onLater} aria-describedby={valueId} render={<Button variant="on-dark" iconOnly icon={<Plus />} aria-label="Later" className={step} />} />
    </div>
  );
}

export { StepperSubtitleTiming };
