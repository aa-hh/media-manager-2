// v2/AppBar/Nav item — ~/Projects/media-manager-2-design/design-system.lib.pen ACA2W
// v2/AppBar/Desktop — ~/Projects/media-manager-2-design/design-system.lib.pen F5qou
import type { ComponentProps, ReactNode } from 'react';
import logo from '@/assets/logos/media-manager-2.png';
import { cn } from '@/lib/utils';

type AppBarNavItemProps = ComponentProps<'a'> & {
  /** The page this link opens is showing. */
  current?: boolean;
  /** Count pill; hidden at 0. */
  count?: number;
  /** Red pill on destructive-soft, for problems. */
  countRisk?: boolean;
};

/** One link in the app bar, 40 px. Active: selected fill and a black 600 label. aria-disabled greys it out. */
function AppBarNavItem({ current = false, count, countRisk = false, className, children, ...props }: AppBarNavItemProps) {
  return (
    <a
      aria-current={current ? 'page' : undefined}
      className={cn(
        'group inline-flex h-10 shrink-0 items-center gap-1.5 rounded-(--control-radius-default) px-2.5 font-ui text-sm',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        current
          ? 'bg-selected font-semibold text-foreground'
          : 'font-medium text-muted-foreground hover:bg-surface-hover hover:text-foreground active:bg-surface-pressed active:text-foreground',
        'aria-disabled:pointer-events-none aria-disabled:text-faint-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            'inline-flex h-4.5 items-center rounded-full px-1.5 font-data text-xs font-semibold group-aria-disabled:hidden',
            countRisk ? 'bg-destructive-soft text-destructive' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </a>
  );
}

type AppBarDesktopProps = ComponentProps<'header'> & {
  /** The product name; may be a focusable heading element. */
  productName: ReactNode;
  /** The 48 px InputSearch; it fills the space between the name and the navigation. */
  search?: ReactNode;
  /** AppBarNavItem links. */
  nav?: ReactNode;
  navLabel?: string;
  /** Right end: the ghost Sign out button and its problem text. */
  actions?: ReactNode;
  /** Signed out: the product name only. */
  signedOut?: boolean;
};

/** Top bar, 64 px, white with a line under, page-margin side padding. The 28 px logo is the small-size render, design/app-logo/small-on-light.png. */
function AppBarDesktop({ productName, search, nav, navLabel = 'Main', actions, signedOut = false, className, ...props }: AppBarDesktopProps) {
  return (
    <header className={cn('flex h-(--topbar) w-full items-center gap-6 border-b border-border bg-card px-(--page-margin)', className)} {...props}>
      <div className="flex shrink-0 items-center gap-2.5 font-ui text-base font-extrabold tracking-[-0.2px] text-foreground">
        <img src={logo} alt="" width={28} height={28} className="size-7" />
        {productName}
      </div>
      {!signedOut && (
        <>
          <div className="flex min-w-0 flex-1">{search}</div>
          {nav !== undefined && <nav aria-label={navLabel} className="flex shrink-0 items-center gap-0.5">{nav}</nav>}
          {actions !== undefined && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
        </>
      )}
    </header>
  );
}

export { AppBarDesktop, AppBarNavItem };
