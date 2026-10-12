// v2/Select trigger — ~/Projects/media-manager-2-design/design-system.lib.pen v8Swg
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type SelectSize = 'row' | 'default' | 'large';

const sizes: Record<SelectSize, string> = {
  row: 'h-(--control-h-row) rounded-(--control-radius-row) pr-2 pl-(--control-px-row) text-(length:--control-text-row) [&_svg]:size-(--control-icon-row)',
  default: 'h-(--control-h-default) rounded-(--control-radius-default) pr-3 pl-(--control-px-default) text-(length:--control-text-default) [&_svg]:size-(--control-icon-default)',
  large: 'h-(--control-h-large) rounded-(--control-radius-large) pr-3.5 pl-(--control-px-large) text-(length:--control-text-large) [&_svg]:size-(--control-icon-large)',
};

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: SelectSize;
  /** Grey label before the value, such as "Sort". */
  lead?: ReactNode;
  placeholder?: ReactNode;
};

/** The trigger only; it sits inside Select, and the open list is the dropdown menu content. Open shows the pressed fill and an upward chevron. */
function SelectTrigger({ size = 'default', lead, placeholder, className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'group inline-flex shrink-0 items-center gap-1.5 border border-input bg-card font-ui text-foreground',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:border-muted-foreground hover:bg-surface-hover data-popup-open:border-muted-foreground data-popup-open:bg-surface-pressed',
        'data-invalid:border-destructive aria-invalid:border-destructive',
        'data-disabled:border-border! data-disabled:bg-muted! data-disabled:text-faint-foreground',
        sizes[size],
        className,
      )}
      {...props}
    >
      {lead !== undefined && <span className="font-normal text-subtle-foreground group-data-disabled:text-faint-foreground">{lead}</span>}
      <span className="min-w-0 truncate font-semibold">{children ?? <SelectPrimitive.Value placeholder={placeholder} />}</span>
      <SelectPrimitive.Icon className="flex text-muted-foreground group-data-disabled:text-faint-foreground group-data-popup-open:rotate-180">
        <ChevronDown aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

const Select = SelectPrimitive.Root;

export { Select, SelectTrigger };
