// v2/Bar/selection — ~/Projects/media-manager-2-design/design-system.lib.pen TPw8z
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// A Button on the black bar: white label and icon, white 12% hover, white focus ring, white 35% when disabled.
const onDark = cn(
  'bg-transparent text-bar-foreground focus-visible:outline-focus-on-dark',
  'not-data-disabled:hover:bg-bar-foreground/12 not-data-disabled:active:bg-bar-foreground/12',
  'data-disabled:bg-transparent data-disabled:text-bar-foreground/35',
);

/** One action on the selection bar, such as Search automatically; keeps the Button's icon and kbd props. */
function BarSelectionAction({ className, ...props }: Omit<ButtonProps, 'variant' | 'size'>) {
  return <Button variant="default" className={cn(onDark, 'gap-1.5', className)} {...props} />;
}

type BarSelectionProps = {
  open: boolean;
  /** Words such as "3 selected". */
  count: ReactNode;
  /** Up to three BarSelectionAction buttons. */
  children: ReactNode;
  hint?: ReactNode;
  onClear: () => void;
  clearLabel?: string;
  /** Key hint on Clear; show only where the shortcut exists. */
  clearKbd?: ReactNode;
};

/**
 * Appears when rows are selected and floats 16 px above the downloads bar, centred.
 * In: slide up 16 px and fade (duration-base, ease-out). Out: fade (duration-fast, ease-in), then it leaves the layout.
 */
function BarSelection({ open, count, children, hint, onClear, clearLabel = 'Clear selection', clearKbd }: BarSelectionProps) {
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      inert={!open}
      className={cn(
        'fixed bottom-[calc(var(--livebar)+var(--space-4))] left-1/2 z-40 h-14 -translate-x-1/2 items-center gap-1 rounded-lg bg-bar pr-2 pl-5',
        'shadow-[0_2px_6px_color-mix(in_srgb,var(--foreground)_6%,transparent),0_8px_24px_var(--shadow)]',
        'transition-discrete',
        open
          ? 'flex transition-[opacity,translate,display] duration-(--duration-base) ease-out starting:translate-y-(--motion-rise-16) starting:opacity-0'
          : 'hidden opacity-0 transition-[opacity,display] duration-(--duration-fast) ease-in',
      )}
    >
      <span className="font-ui text-sm font-semibold whitespace-nowrap text-bar-foreground">{count}</span>
      <span aria-hidden="true" className="w-3 shrink-0" />
      {children}
      <span aria-hidden="true" className="h-5 w-px shrink-0 bg-bar-foreground/20" />
      {hint !== undefined && <span className="font-ui text-xs font-normal whitespace-nowrap text-bar-muted-foreground">{hint}</span>}
      <BarSelectionAction icon={<X />} kbd={clearKbd} aria-label={clearLabel} onClick={onClear} className="px-2.5" />
    </div>
  );
}

export { BarSelection, BarSelectionAction };
