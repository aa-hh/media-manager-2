// v2/Collapsible trigger — ~/Projects/media-manager-2-design/design-system.lib.pen c5J2uH
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import { ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CollapsibleTriggerProps = ComponentProps<typeof CollapsiblePrimitive.Trigger> & {
  summary?: ReactNode;
  /** Trailing badge, such as a risk Badge with "1 problem". */
  badge?: ReactNode;
};

/** 40 px header that opens a group. The chevron turns 90 degrees as the panel opens. Children are the title. */
function CollapsibleTrigger({ summary, badge, className, children, ...props }: CollapsibleTriggerProps) {
  return (
    <CollapsiblePrimitive.Trigger
      className={cn(
        'group flex h-10 w-full items-center gap-2 rounded-sm px-3 text-left',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:bg-surface-hover active:bg-surface-pressed data-disabled:hover:bg-transparent',
        className,
      )}
      {...props}
    >
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-base) ease-out group-data-panel-open:rotate-90 group-data-disabled:text-faint-foreground"
      />
      <span className="shrink-0 font-ui text-sm font-semibold text-foreground group-data-disabled:text-faint-foreground">{children}</span>
      <span className="min-w-0 flex-1 truncate font-data text-sm text-muted-foreground group-data-disabled:text-faint-foreground">{summary}</span>
      {badge}
    </CollapsiblePrimitive.Trigger>
  );
}

const Collapsible = CollapsiblePrimitive.Root;

export { Collapsible, CollapsibleTrigger };
