// v2/Select trigger — ~/Projects/media-manager-2-design/design-system.lib.pen v8Swg
// v2/Select trigger/sm — ~/Projects/media-manager-2-design/design-system.lib.pen VlOeD (size="sm")
// v2/Select trigger/inline — ~/Projects/media-manager-2-design/design-system.lib.pen fzgYZ (variant="inline")
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDown, Plus } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SelectSize = 'row' | 'sm' | 'default' | 'large';

const sizes: Record<SelectSize, string> = {
  row: 'h-(--control-h-row) rounded-(--control-radius-row) pr-2 pl-(--control-px-row) text-(length:--control-text-row) [&_svg]:size-(--control-icon-row)',
  sm: 'h-(--control-h-sm) rounded-(--control-radius-default) pr-3 pl-(--control-px-default) text-(length:--control-text-default) [&_svg]:size-(--control-icon-default)',
  default: 'h-(--control-h-default) rounded-(--control-radius-default) pr-3 pl-(--control-px-default) text-(length:--control-text-default) [&_svg]:size-(--control-icon-default)',
  large: 'h-(--control-h-large) rounded-(--control-radius-large) pr-3.5 pl-(--control-px-large) text-(length:--control-text-large) [&_svg]:size-(--control-icon-large)',
};

const base = cn(
  'group inline-flex shrink-0 items-center gap-1.5 font-ui',
  'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
  'data-disabled:border-border! data-disabled:bg-muted! data-disabled:text-faint-foreground',
);

/** select-inline: a choice inside the add dialog's sentence. Empty marks a required choice not yet made. */
const inlineTriggerClass = (empty: boolean) => cn(
  base,
  'h-[38px] rounded-sm px-3 text-[22px] leading-[1.3] font-bold [&_svg]:size-4',
  empty
    ? 'border-[1.5px] border-warning bg-warning-soft text-warning'
    : 'border border-inline-control-border bg-inline-control text-inline-control-foreground hover:border-inline-control-border-hover hover:bg-inline-control-hover data-popup-open:border-[1.5px] data-popup-open:border-inline-control-foreground data-popup-open:bg-inline-control-hover',
);

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: SelectSize;
  /** Inline: the add dialog's sentence look; lead does not apply, and of the sizes only sm does (32 high, 14 px). */
  variant?: 'default' | 'inline';
  /** Inline only: a required choice not yet made, warning look with a plus instead of the chevron. */
  empty?: boolean;
  /** Grey label before the value, such as "Sort". */
  lead?: ReactNode;
  placeholder?: ReactNode;
};

/** The trigger only; it sits inside Select, and the open list is the dropdown menu content. Open shows the pressed fill and an upward chevron. */
function SelectTrigger({ size = 'default', variant = 'default', empty = false, lead, placeholder, className, children, ...props }: SelectTriggerProps) {
  const inline = variant === 'inline';
  return (
    <SelectPrimitive.Trigger
      className={cn(
        inline
          ? cn(inlineTriggerClass(empty), size === 'sm' && 'h-8 rounded-sm gap-1.5 px-2.5 text-sm font-semibold [&_svg]:size-3.5')
          : cn(
            base,
            'border border-input bg-card text-foreground',
            size !== 'row' && 'border-[1.5px]',
            'hover:border-muted-foreground hover:bg-surface-hover data-popup-open:border-muted-foreground data-popup-open:bg-surface-pressed',
            'data-invalid:border-destructive aria-invalid:border-destructive',
            sizes[size],
          ),
        className,
      )}
      {...props}
    >
      {lead !== undefined && <span className="font-normal text-subtle-foreground group-data-disabled:text-faint-foreground">{lead}</span>}
      <span className={cn('min-w-0 truncate', !inline && 'flex-1 text-left font-semibold')}>{children ?? <SelectPrimitive.Value placeholder={placeholder} />}</span>
      <SelectPrimitive.Icon className={cn('flex group-data-disabled:text-faint-foreground group-data-popup-open:rotate-180', !inline && 'text-muted-foreground')}>
        {inline && empty ? <Plus aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

const Select = SelectPrimitive.Root;

export { inlineTriggerClass, Select, SelectTrigger };
