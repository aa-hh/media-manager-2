// Figma: Button — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2887
// v2/Button/on-dark — ~/Projects/media-manager-2-design/player.pen MW9IF; outline-on-dark and on-video are its instance overrides in player.pen GrqIz (Close player o98tyf, Skip intro AZemF).
// The on-dark, outline-on-dark and on-video looks are not in Figma yet.
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'outline-destructive' | 'menu' | 'plex' | 'jellyfin' | 'on-dark' | 'outline-on-dark' | 'on-video';
type ButtonSize = 'row' | 'sm' | 'default' | 'large';

type ButtonProps = ComponentProps<typeof ButtonPrimitive> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide icon element before the label. */
  icon?: ReactNode;
  /** Square button holding only the icon; give it an aria-label. */
  iconOnly?: boolean;
  /** Key hint after the label, such as "/" or "Esc". */
  kbd?: ReactNode;
  /** Swaps the icon for a spinner, keeps the width and the fill, and takes no clicks. */
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  // A menu trigger keeps the pressed fill while its menu is open, such as the poster card's Resume menu.
  default: 'text-action-foreground before:bg-action not-data-disabled:hover:before:bg-action-hover not-data-disabled:active:before:bg-action-pressed data-popup-open:before:bg-action-pressed',
  outline: 'text-foreground before:border-[1.5px] before:border-foreground before:bg-card not-data-disabled:hover:before:bg-surface-hover not-data-disabled:active:before:bg-surface-pressed data-disabled:before:border-border',
  ghost: 'text-foreground before:bg-transparent not-data-disabled:hover:before:bg-surface-hover not-data-disabled:active:before:bg-surface-pressed data-disabled:before:bg-transparent',
  destructive: 'text-primary-foreground before:bg-destructive not-data-disabled:hover:before:bg-destructive-hover not-data-disabled:active:before:bg-destructive-pressed',
  'outline-destructive': 'text-destructive before:border before:border-destructive before:bg-card not-data-disabled:hover:before:bg-destructive-soft not-data-disabled:active:before:bg-destructive/20 data-disabled:before:border-border',
  menu: 'text-foreground before:border-[1.5px] before:border-foreground before:bg-card not-data-disabled:hover:before:bg-surface-hover not-data-disabled:active:before:bg-surface-pressed data-disabled:before:border-border',
  plex: 'text-plex-foreground before:bg-plex not-data-disabled:hover:before:bg-plex-hover not-data-disabled:active:before:bg-plex-pressed aria-busy:opacity-[0.78]',
  jellyfin: 'text-jellyfin-foreground before:bg-jellyfin not-data-disabled:hover:before:bg-jellyfin-hover not-data-disabled:active:before:bg-jellyfin-pressed aria-busy:opacity-[0.78]',
  // Player controls over the picture: no fill or edge at rest, a 20 px icon; hover, press and an open menu add white 12%.
  'on-dark': 'gap-1.5 px-2.5 text-foreground-on-dark before:bg-transparent [&>svg]:size-5 not-data-disabled:hover:before:bg-surface-pressed-on-video not-data-disabled:active:before:bg-surface-pressed-on-video data-popup-open:before:bg-surface-pressed-on-video data-disabled:before:bg-transparent',
  // The second action over the picture, such as Close player: a 1.5 px white 24% edge, no fill.
  'outline-on-dark': 'px-4 text-foreground-on-dark before:border-[1.5px] before:border-input-on-dark before:bg-transparent not-data-disabled:hover:before:bg-surface-pressed-on-video not-data-disabled:active:before:bg-surface-pressed-on-video data-disabled:before:bg-transparent',
  // A control that floats on the moving picture, such as Skip intro: the dark translucent fill, the same edge, a 16 px icon.
  'on-video': 'px-4 text-foreground-on-dark before:border-[1.5px] before:border-input-on-dark before:bg-surface-on-video [&>svg]:size-4',
};

const onDark = new Set<ButtonVariant>(['on-dark', 'outline-on-dark', 'on-video']);

const icons: Record<ButtonSize, string> = {
  row: '[&>svg]:size-(--control-icon-row)',
  sm: '[&>svg]:size-(--control-icon-default)',
  default: '[&>svg]:size-(--control-icon-default)',
  large: '[&>svg]:size-(--control-icon-large)',
};

const sizes: Record<ButtonSize, string> = {
  row: 'h-(--control-h-row) gap-1.5 rounded-(--control-radius-row) not-data-disabled:hover:before:rounded-(--control-radius-row-hover) px-(--control-px-row) text-(length:--control-text-row)',
  sm: 'h-(--control-h-sm) gap-2 rounded-(--button-radius) not-data-disabled:hover:before:rounded-(--button-radius-hover) px-(--control-px-default) text-(length:--control-text-default)',
  default: 'h-(--control-h-default) gap-2 rounded-(--button-radius) not-data-disabled:hover:before:rounded-(--button-radius-hover) px-(--control-px-default) text-(length:--control-text-default)',
  large: 'h-(--control-h-large) gap-2 rounded-(--button-radius) not-data-disabled:hover:before:rounded-(--button-radius-hover) px-(--control-px-large) text-(length:--control-text-large)',
};

const squares: Record<ButtonSize, string> = {
  row: 'w-(--control-h-row) px-0',
  sm: 'w-(--control-h-sm) px-0',
  default: 'w-(--control-h-default) px-0',
  large: 'w-(--control-h-large) px-0',
};

function Button({
  variant = 'default',
  size = 'default',
  icon,
  iconOnly = false,
  kbd,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  'aria-label': ariaLabel,
  ...props
}: ButtonProps) {
  const spinner = <Spinner className="text-current" />;
  const hideContent = loading && !icon;
  return (
    <ButtonPrimitive
      type={type}
      aria-busy={loading || undefined}
      // A named button's visible text includes the key hint, so the name carries it too: "Close, Esc".
      aria-label={ariaLabel !== undefined && typeof kbd === 'string' ? `${ariaLabel}, ${kbd}` : ariaLabel}
      // A loading submit button cancels its click, which also stops Enter's implicit form submission.
      onClick={loading ? (event) => event.preventDefault() : onClick}
      className={cn(
        'group relative isolate inline-flex shrink-0 items-center justify-center font-ui font-semibold whitespace-nowrap',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        onDark.has(variant) ? 'focus-ring-on-dark' : 'focus-ring',
        // The fill and edge live on ::before so hover can grow them 2px each side without moving neighbours.
        'before:absolute before:inset-0 before:-z-10 before:rounded-[inherit]',
        'before:transition-[inset,border-radius,background-color,border-color] before:duration-(--duration-fast) before:ease-out active:before:duration-0 motion-reduce:before:transition-none',
        'not-data-disabled:hover:before:-inset-0.5 not-data-disabled:hover:focus-visible:outline-offset-4',
        'data-disabled:cursor-not-allowed data-disabled:before:bg-muted data-disabled:text-faint-foreground aria-busy:pointer-events-none',
        sizes[size],
        icons[size],
        variants[variant],
        // Inside table rows the outline edge is the thin row line colour.
        size === 'row' && (variant === 'outline' || variant === 'menu') && 'before:border before:border-border',
        iconOnly && squares[size],
        iconOnly && variant === 'on-dark' && 'w-10',
        className,
      )}
      {...props}
    >
      {loading && icon ? spinner : icon}
      {/* opacity, not visibility, so the hidden label still names the button while it loads. */}
      {children !== undefined && <span className={cn(hideContent && 'opacity-0')}>{children}</span>}
      {kbd !== undefined && (
        <Kbd
          aria-hidden="true"
          onFill={variant === 'default' || variant === 'destructive' || variant === 'on-video'}
          className={cn('group-data-disabled:hidden group-aria-busy:hidden', variant === 'on-video' && 'bg-kbd-on-video text-muted-foreground-on-dark', hideContent && 'invisible')}
        >
          {kbd}
        </Kbd>
      )}
      {variant === 'menu' && <ChevronDown aria-hidden="true" className={cn(hideContent && 'invisible')} />}
      {hideContent && <span className={cn('absolute inset-0 flex items-center justify-center', icons[size])}>{spinner}</span>}
    </ButtonPrimitive>
  );
}

export { Button };
export type { ButtonProps };
