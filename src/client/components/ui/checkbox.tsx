// Figma: Checkbox — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3454
import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check, Minus } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** 16 px; checked and mixed fill black. The check scales 0.85 to 1 as it appears. */
function Checkbox({ className, indeterminate, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      indeterminate={indeterminate}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-xs border border-input bg-card',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:border-muted-foreground active:border-muted-foreground active:bg-surface-pressed',
        'data-checked:border-primary data-checked:bg-primary data-checked:hover:border-primary-hover data-checked:hover:bg-primary-hover',
        'data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:hover:border-primary-hover data-indeterminate:hover:bg-primary-hover',
        'data-disabled:border-border! data-disabled:bg-muted!',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className={cn(
          'flex text-primary-foreground data-disabled:text-faint-foreground',
          'transition-[scale,opacity] duration-(--duration-fast) ease-out data-starting-style:scale-85 motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:opacity-0',
        )}
      >
        {indeterminate ? <Minus aria-hidden="true" className="size-3" /> : <Check aria-hidden="true" className="size-3" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
