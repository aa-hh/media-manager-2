// v2/Item/episode-list — ~/Projects/media-manager-2-design/design-system.lib.pen GeZ6k
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ItemEpisodeListProps = ComponentProps<'div'> & {
  number: ReactNode;
  title: ReactNode;
  /** Air date and the chosen file. */
  detail?: ReactNode;
  /** One Badge, or nothing when normal. */
  state?: ReactNode;
  selected?: boolean;
};

/** Episode in a compact list, 56 px, outside a table. Selected: the 3 px bar, no fill. Use role="option" in a listbox. */
function ItemEpisodeList({ number, title, detail, state, selected = false, className, ...props }: ItemEpisodeListProps) {
  return (
    <div
      aria-selected={props.role === 'option' ? selected : undefined}
      className={cn(
        'relative flex h-14 w-full items-center gap-3 rounded-sm px-4',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        !selected && 'hover:bg-surface-hover active:bg-surface-pressed',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn('absolute top-2 left-0 h-10 w-0.75 rounded-[2px] bg-foreground transition-opacity duration-(--duration-fast) ease-out', selected ? 'opacity-100' : 'opacity-0')}
      />
      <span className="shrink-0 font-data text-sm font-semibold text-muted-foreground">{number}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-ui text-sm font-semibold text-foreground">{title}</span>
        {detail !== undefined && <span className="truncate font-data text-[13px] text-muted-foreground">{detail}</span>}
      </span>
      {state}
    </div>
  );
}

export { ItemEpisodeList };
