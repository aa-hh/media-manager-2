// v2/Combobox item — design/design-system.lib.pen L7eQnT
import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ComboboxItemProps = ComponentProps<'div'> & {
  /** Icon or poster thumb before the label. */
  icon?: ReactNode;
  /** Right-hand detail, such as the year. */
  detail?: ReactNode;
  selected?: boolean;
};

/**
 * One option in a search or select list, 32 px. Render it through a base-ui item
 * (render={<ComboboxItem …/>}) so it receives data-highlighted, data-selected and data-disabled.
 * Highlight is the focus cue, with no ring; selected is a check and 600 weight, never a tint.
 */
function ComboboxItem({ icon, detail, selected, className, children, ...props }: ComboboxItemProps) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        'group flex h-8 w-full cursor-default items-center gap-2 rounded-xs px-2 font-ui text-sm text-foreground outline-hidden select-none',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'hover:bg-surface-hover data-highlighted:bg-surface-hover active:bg-surface-pressed data-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="flex shrink-0 text-muted-foreground [&>svg]:size-4">{icon}</span>}
      <span className="min-w-0 flex-1 truncate group-data-selected:font-semibold">{children}</span>
      {detail !== undefined && <span className="shrink-0 font-data text-[13px] text-subtle-foreground group-data-disabled:text-faint-foreground">{detail}</span>}
      <Check aria-hidden="true" className="hidden size-4 shrink-0 group-data-selected:block" />
    </div>
  );
}

export { ComboboxItem };
