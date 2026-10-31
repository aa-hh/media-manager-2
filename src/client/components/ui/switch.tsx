// Figma: Switch — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-667
import { Switch as SwitchPrimitive } from '@base-ui/react/switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Settings only; monitored state uses ToggleBookmark. Track 32 by 18. */
function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-4.5 w-8 shrink-0 items-center rounded-full bg-input p-0.5',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:bg-subtle-foreground active:bg-muted-foreground',
        'data-checked:bg-primary data-checked:hover:bg-primary-hover',
        'data-disabled:bg-surface-pressed! data-disabled:data-checked:bg-faint-foreground!',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'size-3.5 rounded-full bg-card shadow-[0_1px_2px_color-mix(in_srgb,var(--foreground)_20%,transparent)] dark:shadow-[0_1px_2px_var(--shadow)]',
          'transition-transform duration-(--duration-fast) ease-out data-checked:translate-x-3.5',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
