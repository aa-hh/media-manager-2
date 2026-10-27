// Figma: Radio — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-648
import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** 16 px circle; selected fills black with a white dot that scales 0.85 to 1. Use inside RadioGroup. */
function Radio({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-card',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:border-muted-foreground active:border-muted-foreground active:bg-surface-pressed',
        'data-checked:border-primary data-checked:bg-primary data-checked:hover:border-primary data-checked:hover:bg-primary-hover',
        'data-disabled:border-border! data-disabled:bg-muted!',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        className={cn(
          'size-1.5 rounded-full bg-primary-foreground data-disabled:bg-faint-foreground',
          'transition-[scale,opacity] duration-(--duration-fast) ease-out data-starting-style:scale-85 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:opacity-0',
        )}
      />
    </RadioPrimitive.Root>
  );
}

export { Radio, RadioGroup };
