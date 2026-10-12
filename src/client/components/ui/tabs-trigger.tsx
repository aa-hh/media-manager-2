// v2/Tabs trigger — ~/Projects/media-manager-2-design/design-system.lib.pen Qf3qz
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;
const TabsPanel = TabsPrimitive.Panel;

/** Row of triggers; the 2 px black underline slides to the active trigger. */
function TabsList({ className, children, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List className={cn('relative flex items-center', className)} {...props}>
      {children}
      <TabsPrimitive.Indicator className="absolute bottom-0 left-(--active-tab-left) h-0.5 w-(--active-tab-width) bg-foreground transition-[left,width] duration-(--duration-base) ease-out" />
    </TabsPrimitive.List>
  );
}

/** 40 px, no fill. Active: black 600 label over the underline. */
function TabsTrigger({ count, className, children, ...props }: ComponentProps<typeof TabsPrimitive.Tab> & { count?: ReactNode }) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'group inline-flex h-10 shrink-0 items-center gap-1.5 px-3 font-ui text-sm font-medium text-muted-foreground',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:text-foreground active:bg-surface-hover data-active:font-semibold data-active:text-foreground data-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="font-data text-[13px] font-medium text-subtle-foreground group-data-active:text-muted-foreground group-data-disabled:text-faint-foreground">{count}</span>
      )}
    </TabsPrimitive.Tab>
  );
}

export { Tabs, TabsList, TabsPanel, TabsTrigger };
