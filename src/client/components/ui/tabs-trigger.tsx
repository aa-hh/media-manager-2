// Figma: TabsTrigger — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3545
// v2/TabsTrigger/large-icon — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=157-934
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TabsSize = 'default' | 'large';

const Tabs = TabsPrimitive.Root;
const TabsPanel = TabsPrimitive.Panel;

/**
 * Row of triggers; the 2 px black underline slides to the active trigger.
 * Large: the underline turns lime in dark mode (never a thin lime line on white). Pass the same size to each trigger.
 */
function TabsList({ size = 'default', className, children, ...props }: ComponentProps<typeof TabsPrimitive.List> & { size?: TabsSize }) {
  return (
    <TabsPrimitive.List className={cn('relative flex items-center', className)} {...props}>
      {children}
      <TabsPrimitive.Indicator className={cn('absolute bottom-0 left-0 translate-x-(--active-tab-left) h-0.5 w-(--active-tab-width) bg-foreground transition-[translate,width] duration-(--duration-base) ease-out', size === 'large' && 'dark:bg-best')} />
    </TabsPrimitive.List>
  );
}

/**
 * 40 px, no fill. Active: black 600 label over the underline.
 * Large (the Library media type): 48 px, 18 px label after a 20 px icon, the count in a Badge that turns off-white with dark numbers when active.
 */
function TabsTrigger({ size = 'default', icon, count, className, children, ...props }: ComponentProps<typeof TabsPrimitive.Tab> & { size?: TabsSize; icon?: ReactNode; count?: ReactNode }) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        'group inline-flex h-10 shrink-0 items-center gap-1.5 px-3 font-ui text-sm font-medium text-muted-foreground',
        size === 'large' && 'h-12 gap-2 px-3.5 text-[18px]',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'hover:text-foreground active:bg-surface-hover data-active:font-semibold data-active:text-foreground data-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    >
      {icon !== undefined && <span className="flex [&>svg]:size-5">{icon}</span>}
      {children}
      {count !== undefined && size === 'large' && (
        <Badge className="group-data-active:bg-primary group-data-active:text-primary-foreground group-data-disabled:text-faint-foreground">{count}</Badge>
      )}
      {count !== undefined && size === 'default' && (
        <span className="font-data text-[13px] font-medium text-subtle-foreground group-data-active:text-muted-foreground group-data-disabled:text-faint-foreground">{count}</span>
      )}
    </TabsPrimitive.Tab>
  );
}

export { Tabs, TabsList, TabsPanel, TabsTrigger };
