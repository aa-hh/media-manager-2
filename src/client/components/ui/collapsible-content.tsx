// Figma: CollapsibleContent — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8945
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * What a CollapsibleTrigger reveals, placed directly under it. The padding lines the content up with the trigger's title.
 * Height grows at duration-size and shrinks at duration-fast; instant under reduced motion.
 */
function CollapsibleContent({ className, children, ...props }: ComponentProps<typeof CollapsiblePrimitive.Panel>) {
  return (
    <CollapsiblePrimitive.Panel
      className={cn(
        'h-(--collapsible-panel-height) overflow-hidden transition-all duration-(--duration-size) ease-out',
        'data-ending-style:h-0 data-ending-style:duration-(--duration-fast) data-ending-style:ease-in data-starting-style:h-0 motion-reduce:transition-none',
      )}
      {...props}
    >
      <div className={cn('flex w-full flex-col gap-3 pt-0 pr-3 pb-4 pl-9', className)}>{children}</div>
    </CollapsiblePrimitive.Panel>
  );
}

export { CollapsibleContent };
