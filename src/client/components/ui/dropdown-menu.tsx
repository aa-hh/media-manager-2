// v2/DropdownMenu/Content — ~/Projects/media-manager-2-design/design-system.lib.pen D3lFb
// v2/DropdownMenu/Item — ~/Projects/media-manager-2-design/design-system.lib.pen Gtcpe
import { Menu } from '@base-ui/react/menu';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

// The float shadow every floating surface shares (DESIGN.md: only things that float get a shadow).
const content = cn(
  'flex w-62 flex-col rounded-lg border border-border bg-card p-1 text-foreground outline-hidden',
  'shadow-[0_2px_6px_color-mix(in_srgb,var(--foreground)_6%,transparent),0_8px_24px_var(--shadow)]',
  // Fade and a 4 px slide from the trigger; in with ease-out, out with ease-in.
  'transition-[opacity,translate] duration-(--duration-fast) ease-out data-ending-style:ease-in',
  'data-starting-style:opacity-0 data-ending-style:opacity-0',
  'data-[side=bottom]:data-starting-style:-translate-y-(--motion-rise-4) data-[side=bottom]:data-ending-style:-translate-y-(--motion-rise-4)',
  'data-[side=top]:data-starting-style:translate-y-(--motion-rise-4) data-[side=top]:data-ending-style:translate-y-(--motion-rise-4)',
  'data-[side=right]:data-starting-style:-translate-x-(--motion-rise-4) data-[side=right]:data-ending-style:-translate-x-(--motion-rise-4)',
  'data-[side=left]:data-starting-style:translate-x-(--motion-rise-4) data-[side=left]:data-ending-style:translate-x-(--motion-rise-4)',
);

// The highlight (hover or keyboard) is the focus cue; no ring inside menus.
const item = cn(
  'group flex h-8 w-full shrink-0 cursor-default items-center gap-2 rounded-xs px-2 font-ui text-sm font-normal text-foreground outline-hidden select-none',
  'transition-colors duration-(--duration-fast) ease-out',
  'data-highlighted:bg-surface-hover data-disabled:text-faint-foreground',
  '[&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground data-disabled:[&>svg]:text-faint-foreground',
);

const destructiveItem = 'text-destructive data-highlighted:bg-destructive-soft [&>svg]:text-destructive';

type ItemParts = {
  /** A 16 px lucide icon before the label. */
  icon?: ReactNode;
  /** Shortcut hint; show only where the shortcut exists. */
  kbd?: ReactNode;
};

function ItemBody({ icon, kbd, children }: ItemParts & { children?: ReactNode }) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {kbd !== undefined && <Kbd>{kbd}</Kbd>}
    </>
  );
}

const DropdownMenu = Menu.Root;
const DropdownMenuTrigger = Menu.Trigger;
const DropdownMenuGroup = Menu.Group;
const DropdownMenuSubmenu = Menu.SubmenuRoot;

type DropdownMenuContentProps = ComponentProps<typeof Menu.Popup> & Pick<ComponentProps<typeof Menu.Positioner>, 'side' | 'align' | 'sideOffset'>;

/** The floating list: 248 px, radius 12, 4 px padding, line edge and the float shadow. */
function DropdownMenuContent({ side = 'bottom', align = 'start', sideOffset = 4, className, ...props }: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-hidden">
        <Menu.Popup className={cn(content, className)} {...props} />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

type DropdownMenuItemProps = ComponentProps<typeof Menu.Item> & ItemParts & { destructive?: boolean };

/** One 32 px menu row. Destructive: red label and icon, risk-soft highlight. */
function DropdownMenuItem({ icon, kbd, destructive = false, className, children, ...props }: DropdownMenuItemProps) {
  return (
    <Menu.Item className={cn(item, destructive && destructiveItem, className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
    </Menu.Item>
  );
}

/** A menu row that keeps a check; the check shows at the right when on. */
function DropdownMenuCheckboxItem({ icon, kbd, className, children, ...props }: ComponentProps<typeof Menu.CheckboxItem> & ItemParts) {
  return (
    <Menu.CheckboxItem className={cn(item, className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
      <Menu.CheckboxItemIndicator className="flex text-foreground [&>svg]:size-4">
        <Check aria-hidden="true" />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  );
}

/** A menu row that opens a further menu; the chevron sits at the right. */
function DropdownMenuSubmenuTrigger({ icon, kbd, className, children, ...props }: ComponentProps<typeof Menu.SubmenuTrigger> & ItemParts) {
  return (
    <Menu.SubmenuTrigger className={cn(item, 'data-popup-open:bg-surface-hover', className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
      <ChevronRight aria-hidden="true" />
    </Menu.SubmenuTrigger>
  );
}

/** Small heading over a group of rows; place inside DropdownMenuGroup. */
function DropdownMenuGroupLabel({ className, ...props }: ComponentProps<typeof Menu.GroupLabel>) {
  return <Menu.GroupLabel className={cn('font-ui text-[11px] font-semibold tracking-[0.5px] text-subtle-foreground', className)} {...props} />;
}

/** 1 px line with 4 px above and below. */
function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('my-1 h-px w-full shrink-0 bg-border', className)} {...props} />;
}

/** The open list of a Select (its trigger is SelectTrigger): the same surface as the menu, dropping below the trigger. */
function SelectContent({
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Popup> & Pick<ComponentProps<typeof SelectPrimitive.Positioner>, 'side' | 'align' | 'sideOffset'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} alignItemWithTrigger={false} className="z-50 outline-hidden">
        <SelectPrimitive.Popup className={cn(content, 'min-w-(--anchor-width)', className)} {...props} />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

/** One option in a Select list; the chosen one carries the check. */
function SelectItem({ icon, className, children, ...props }: ComponentProps<typeof SelectPrimitive.Item> & Pick<ItemParts, 'icon'>) {
  return (
    <SelectPrimitive.Item className={cn(item, className)} {...props}>
      {icon}
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex text-foreground [&>svg]:size-4">
        <Check aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuTrigger,
  content as floatingSurface,
  SelectContent,
  SelectItem,
};
