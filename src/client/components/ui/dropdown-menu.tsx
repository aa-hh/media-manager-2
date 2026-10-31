// Figma: DropdownMenuContent — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-673
// Figma: DropdownMenuItem — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3626
// Figma: DropdownMenuRadioItem — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-587
// Figma: v2/ToggleGroup/on-dark (DropdownMenuToggleGroup) — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=135-1642
// Figma: v2/ToggleGroupItem/on-dark (DropdownMenuToggleGroupItem) — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=135-1617
import { Menu } from '@base-ui/react/menu';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Check, ChevronRight } from 'lucide-react';
import { createContext, use, type ComponentProps, type ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

// The float shadow every floating surface shares (DESIGN.md: only things that float get a shadow).
const content = cn(
  'flex w-62 flex-col rounded-lg border border-border bg-popover p-1 text-foreground outline-hidden shadow-float',
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

// The dark menus over the player's picture: bar fill, white 12% edge, a deeper shadow; rows highlight white 8%.
const contentOnDark = 'border-border-on-video bg-bar text-bar-foreground shadow-[0_2px_6px_#0000004d,0_8px_24px_#00000066]';
const itemOnDark = 'text-bar-foreground data-highlighted:bg-surface-hover-on-video [&>svg]:text-bar-muted-foreground';
const indicatorOnDark = 'text-bar-foreground';

// Set by DropdownMenuContent so every row inside takes the dark look without a prop of its own.
const OnDarkContext = createContext(false);

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

type DropdownMenuContentProps = ComponentProps<typeof Menu.Popup> & Pick<ComponentProps<typeof Menu.Positioner>, 'side' | 'align' | 'sideOffset'> & {
  /** The dark menu over the player's picture; set its width with className (260 to 340 in the player). */
  onDark?: boolean;
};

/** The floating list: 248 px, radius 12, 4 px padding, line edge and the float shadow. */
function DropdownMenuContent({ side = 'bottom', align = 'start', sideOffset = 4, onDark = false, className, ...props }: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50 outline-hidden">
        <OnDarkContext value={onDark}>
          <Menu.Popup className={cn(content, onDark && contentOnDark, className)} {...props} />
        </OnDarkContext>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

type DropdownMenuItemProps = ComponentProps<typeof Menu.Item> & ItemParts & { destructive?: boolean };

/** One 32 px menu row. Destructive: red label and icon, risk-soft highlight. */
function DropdownMenuItem({ icon, kbd, destructive = false, className, children, ...props }: DropdownMenuItemProps) {
  const onDark = use(OnDarkContext);
  return (
    <Menu.Item className={cn(item, onDark && itemOnDark, destructive && destructiveItem, className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
    </Menu.Item>
  );
}

/** A menu row that keeps a check; the check shows at the right when on. */
function DropdownMenuCheckboxItem({ icon, kbd, className, children, ...props }: ComponentProps<typeof Menu.CheckboxItem> & ItemParts) {
  const onDark = use(OnDarkContext);
  return (
    <Menu.CheckboxItem className={cn(item, onDark && itemOnDark, className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
      <Menu.CheckboxItemIndicator className={cn('flex text-foreground [&>svg]:size-4', onDark && indicatorOnDark)}>
        <Check aria-hidden="true" />
      </Menu.CheckboxItemIndicator>
    </Menu.CheckboxItem>
  );
}

/** One choice of several, such as a version, an audio track or a quality step; holds DropdownMenuRadioItem rows. */
const DropdownMenuRadioGroup = Menu.RadioGroup;

/** A row in a DropdownMenuRadioGroup; the chosen one carries the check at the right. */
function DropdownMenuRadioItem({ icon, kbd, className, children, ...props }: ComponentProps<typeof Menu.RadioItem> & ItemParts) {
  const onDark = use(OnDarkContext);
  return (
    <Menu.RadioItem className={cn(item, onDark && itemOnDark, className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
      <Menu.RadioItemIndicator className={cn('flex text-foreground [&>svg]:size-4', onDark && indicatorOnDark)}>
        <Check aria-hidden="true" />
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  );
}

/**
 * A toggle group inside a dark menu (v2/ToggleGroup/on-dark): a 36 px white 8% track, 3 px padding, the choices sharing the
 * width. Its choices are menu radio items, not toggle buttons, because a menu may hold only menu items; Up and Down reach
 * them like any row and Left and Right move along the group. Drawn only for `DropdownMenuContent onDark`.
 */
function DropdownMenuToggleGroup({ className, onKeyDown, ...props }: ComponentProps<typeof Menu.RadioGroup>) {
  return (
    <Menu.RadioGroup
      className={cn('flex h-9 w-full gap-0.5 rounded-(--control-radius-default) bg-surface-hover-on-video p-0.75', className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]:not([aria-disabled="true"])')];
        const at = items.indexOf(event.target as HTMLElement);
        const next = items[at + (event.key === 'ArrowRight' ? 1 : -1)];
        if (at === -1 || next === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        next.focus();
      }}
      {...props}
    />
  );
}

/** One choice in a DropdownMenuToggleGroup: 13/600 `muted-foreground-on-dark`; chosen, a `foreground-on-dark` segment with a `bar` label. A click keeps the menu open. */
function DropdownMenuToggleGroupItem({ className, ...props }: ComponentProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      closeOnClick={false}
      className={cn(
        'flex h-full min-w-0 flex-1 cursor-default items-center justify-center rounded-(--control-radius-row) px-1 font-ui text-[13px] font-semibold whitespace-nowrap select-none',
        'text-muted-foreground-on-dark outline-hidden transition-colors duration-(--duration-fast) ease-out',
        'data-highlighted:bg-surface-hover-on-video data-highlighted:text-foreground-on-dark',
        // Chosen wins over highlighted; a highlighted chosen item shows a 2 px inner `bar` edge so the keyboard's place stays visible.
        'data-checked:bg-foreground-on-dark data-checked:text-bar data-checked:data-highlighted:bg-foreground-on-dark data-checked:data-highlighted:text-bar',
        'data-checked:data-highlighted:shadow-[inset_0_0_0_2px_var(--bar)] data-disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

/** A menu row that opens a further menu; the chevron sits at the right. */
function DropdownMenuSubmenuTrigger({ icon, kbd, className, children, ...props }: ComponentProps<typeof Menu.SubmenuTrigger> & ItemParts) {
  const onDark = use(OnDarkContext);
  return (
    <Menu.SubmenuTrigger className={cn(item, 'data-popup-open:bg-surface-hover', onDark && cn(itemOnDark, 'data-popup-open:bg-surface-hover-on-video'), className)} {...props}>
      <ItemBody icon={icon} kbd={kbd}>{children}</ItemBody>
      <ChevronRight aria-hidden="true" />
    </Menu.SubmenuTrigger>
  );
}

/** Small heading over a group of rows; place inside DropdownMenuGroup. */
function DropdownMenuGroupLabel({ className, ...props }: ComponentProps<typeof Menu.GroupLabel>) {
  const onDark = use(OnDarkContext);
  return (
    <Menu.GroupLabel
      className={cn('font-ui text-[11px] font-semibold tracking-[0.5px] text-subtle-foreground', onDark && 'px-2 pt-2 pb-1 text-xs tracking-normal text-bar-muted-foreground', className)}
      {...props}
    />
  );
}

/** 1 px line with 4 px above and below. */
function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Menu.Separator>) {
  const onDark = use(OnDarkContext);
  return <Menu.Separator className={cn('my-1 h-px w-full shrink-0 bg-border', onDark && 'bg-border-on-video', className)} {...props} />;
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuToggleGroup,
  DropdownMenuToggleGroupItem,
  DropdownMenuTrigger,
  content as floatingSurface,
  SelectContent,
  SelectItem,
};
