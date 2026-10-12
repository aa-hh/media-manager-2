// v2/Tooltip — ~/Projects/media-manager-2-design/design-system.lib.pen girD3
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';

// --delay-tooltip in globals.css; base-ui takes the delay as a number, so keep the two equal.
const tooltipDelay = 400;

type TooltipProps = {
  /** The element that shows the tooltip on hover or focus, such as an icon-only Button. */
  children: ReactElement;
  text: ReactNode;
  kbd?: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

/** Dark label for icon buttons and truncated text. Fades in after the tooltip delay. */
function Tooltip({ children, text, kbd, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={tooltipDelay} render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={8}>
          <TooltipPrimitive.Popup
            className={
              'flex max-w-96 items-center gap-1.5 rounded-sm bg-bar px-2 py-1.5 font-ui text-[13px] font-medium text-bar-foreground ' +
              'shadow-[0_2px_6px_color-mix(in_srgb,var(--foreground)_6%,transparent),0_8px_24px_var(--shadow)] ' +
              'transition-opacity duration-(--duration-fast) ease-out data-ending-style:opacity-0 data-starting-style:opacity-0'
            }
          >
            <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
            {kbd !== undefined && <Kbd onFill>{kbd}</Kbd>}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export { Tooltip };
