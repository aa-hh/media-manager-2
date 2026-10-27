// Figma: TooltipNext — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=109-295
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

// --delay-tooltip in globals.css, as in tooltip.tsx.
const tooltipDelay = 400;

type TooltipNextProps = {
  /** The player's Previous or Next button. */
  children: ReactElement;
  /** The item's still; a dark box stands in without one. */
  still?: string;
  /** "Next · S1 E5" or "Previous · S1 E3". */
  label: ReactNode;
  title: ReactNode;
};

/** Names the play queue item a Previous or Next button goes to, with its still, on the dark player surface. */
function TooltipNext({ children, still, label, title }: TooltipNextProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={tooltipDelay} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side="top" align="start" sideOffset={8}>
          <TooltipPrimitive.Popup
            className={
              'flex items-center gap-3 rounded-lg border border-border-on-video bg-bar p-2 shadow-[0_2px_6px_#0000004d,0_8px_24px_#00000066] ' +
              'transition-opacity duration-(--duration-fast) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0'
            }
          >
            <span className="h-13.5 w-24 shrink-0 overflow-hidden rounded-xs bg-black">
              {still !== undefined && <img src={still} alt="" className="size-full object-cover" />}
            </span>
            <span className="flex flex-col gap-0.5 pr-2">
              <span className="font-ui text-xs font-semibold text-bar-muted-foreground">{label}</span>
              <span className="font-ui text-sm font-semibold text-bar-foreground">{title}</span>
            </span>
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { TooltipNext };
