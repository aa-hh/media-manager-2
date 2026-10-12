// v2/ToggleGroup — ~/Projects/media-manager-2-design/design-system.lib.pen cofqY
// v2/ToggleGroup item — ~/Projects/media-manager-2-design/design-system.lib.pen EBTr5
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group';
import { createContext, use, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ToggleGroupSize = 'row' | 'default' | 'large';

const SizeContext = createContext<ToggleGroupSize>('default');

const tracks: Record<ToggleGroupSize, string> = {
  row: 'h-(--control-h-row) rounded-(--control-radius-row) p-0.5',
  default: 'h-(--control-h-default) rounded-(--control-radius-default) p-0.75',
  large: 'h-(--control-h-large) rounded-(--control-radius-large) p-1',
};

const segments: Record<ToggleGroupSize, string> = {
  row: 'inset-y-0.5 rounded-xs',
  default: 'inset-y-0.75 rounded-sm',
  large: 'inset-y-1 rounded-(--control-radius-default)',
};

const items: Record<ToggleGroupSize, string> = {
  row: 'h-6 rounded-xs px-(--control-px-row)',
  default: 'h-7.5 rounded-sm px-3.5',
  large: 'h-9 rounded-(--control-radius-default) px-(--control-px-large)',
};

type ToggleGroupProps = Omit<ComponentProps<typeof ToggleGroupPrimitive>, 'value' | 'defaultValue' | 'onValueChange' | 'multiple'> & {
  value: string;
  onValueChange: (value: string) => void;
  size?: ToggleGroupSize;
};

/** Single choice: a white segment on a grey track, up to six items. The segment slides to the chosen item. */
function ToggleGroup({ value, onValueChange, size = 'default', className, children, ...props }: ToggleGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The segment is one element measured against the pressed item, so it can slide between items.
  useLayoutEffect(() => {
    const root = ref.current;
    if (root === null) return;
    const place = () => {
      const item = root.querySelector<HTMLElement>('[data-pressed]');
      root.style.setProperty('--segment-left', `${item?.offsetLeft ?? 0}px`);
      root.style.setProperty('--segment-width', `${item?.offsetWidth ?? 0}px`);
      root.toggleAttribute('data-segment-none', item === null);
      root.toggleAttribute('data-segment-risk', item?.hasAttribute('data-risk') ?? false);
    };
    place();
    const observer = new ResizeObserver(place);
    for (const child of root.children) observer.observe(child);
    return () => observer.disconnect();
  }, [value, children]);

  return (
    <SizeContext value={size}>
      <ToggleGroupPrimitive
        ref={ref}
        value={[value]}
        onValueChange={(next) => { if (next.length > 0) onValueChange(String(next[0])); }}
        className={cn('group/toggle relative inline-flex shrink-0 items-center gap-0.5 bg-muted', tracks[size], className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute left-(--segment-left) w-(--segment-width) border border-border bg-card',
            'transition-[left,width] duration-(--duration-base) ease-out',
            'group-data-segment-none/toggle:hidden group-data-segment-risk/toggle:border-destructive group-data-segment-risk/toggle:bg-destructive-soft',
            segments[size],
          )}
        />
        {children}
      </ToggleGroupPrimitive>
    </SizeContext>
  );
}

type ToggleGroupItemProps = ComponentProps<typeof Toggle> & {
  icon?: ReactNode;
  count?: ReactNode;
  /** When chosen, the segment turns red: for Remove when it would break a hit and run rule. */
  risk?: boolean;
};

function ToggleGroupItem({ icon, count, risk = false, className, children, ...props }: ToggleGroupItemProps) {
  const size = use(SizeContext);
  return (
    <Toggle
      data-risk={risk || undefined}
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center gap-1.5 font-ui text-[13px] font-medium text-muted-foreground',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:text-foreground active:bg-surface-pressed data-pressed:font-semibold data-pressed:text-foreground data-pressed:data-risk:text-destructive data-disabled:text-faint-foreground',
        items[size],
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="flex [&>svg]:size-3.5">{icon}</span>}
      {children}
      {count !== undefined && (
        <span className="font-data text-[13px] font-normal text-subtle-foreground group-data-pressed:text-muted-foreground group-data-disabled:text-faint-foreground">{count}</span>
      )}
    </Toggle>
  );
}

export { ToggleGroup, ToggleGroupItem };
