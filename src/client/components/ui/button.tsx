// v2/Button — design/design-system.lib.pen ht3RN
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive' | 'outline-destructive' | 'menu' | 'plex';
type ButtonSize = 'row' | 'default' | 'large';

type ButtonProps = ComponentProps<typeof ButtonPrimitive> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** A lucide icon element before the label. */
  icon?: ReactNode;
  /** Square button holding only the icon; give it an aria-label. */
  iconOnly?: boolean;
  /** Key hint after the label, such as "/" or "Esc". */
  kbd?: ReactNode;
  /** Swaps the icon for a spinner and keeps the width. */
  loading?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground not-data-disabled:hover:bg-primary-hover not-data-disabled:active:bg-primary-pressed',
  outline: 'border border-input bg-card text-foreground not-data-disabled:hover:bg-surface-hover not-data-disabled:active:bg-surface-pressed data-disabled:border-border',
  ghost: 'bg-transparent text-foreground not-data-disabled:hover:bg-surface-hover not-data-disabled:active:bg-surface-pressed data-disabled:bg-transparent',
  destructive: 'bg-destructive text-primary-foreground not-data-disabled:hover:bg-destructive-hover not-data-disabled:active:bg-destructive-pressed',
  'outline-destructive': 'border border-destructive bg-card text-destructive not-data-disabled:hover:bg-destructive-soft not-data-disabled:active:bg-destructive/20 data-disabled:border-border',
  menu: 'border border-input bg-card text-foreground not-data-disabled:hover:bg-surface-hover not-data-disabled:active:bg-surface-pressed data-disabled:border-border',
  plex: 'bg-plex text-plex-foreground not-data-disabled:hover:bg-plex-hover not-data-disabled:active:bg-plex-pressed aria-busy:opacity-[0.78]',
};

const icons: Record<ButtonSize, string> = {
  row: '[&>svg]:size-(--control-icon-row)',
  default: '[&>svg]:size-(--control-icon-default)',
  large: '[&>svg]:size-(--control-icon-large)',
};

const sizes: Record<ButtonSize, string> = {
  row: 'h-(--control-h-row) gap-1.5 rounded-(--control-radius-row) px-(--control-px-row) text-(length:--control-text-row)',
  default: 'h-(--control-h-default) gap-2 rounded-(--control-radius-default) px-(--control-px-default) text-(length:--control-text-default)',
  large: 'h-(--control-h-large) gap-2 rounded-(--control-radius-large) px-(--control-px-large) text-(length:--control-text-large)',
};

const squares: Record<ButtonSize, string> = {
  row: 'w-(--control-h-row) px-0',
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
  ...props
}: ButtonProps) {
  const spinner = <Spinner className="text-current" />;
  const hideContent = loading && !icon;
  return (
    <ButtonPrimitive
      type={type}
      aria-busy={loading || undefined}
      // A loading submit button cancels its click, which also stops Enter's implicit form submission.
      onClick={loading ? (event) => event.preventDefault() : onClick}
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center font-ui font-semibold whitespace-nowrap',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'data-disabled:cursor-not-allowed data-disabled:bg-muted data-disabled:text-faint-foreground',
        sizes[size],
        icons[size],
        variants[variant],
        iconOnly && squares[size],
        className,
      )}
      {...props}
    >
      {loading && icon ? spinner : icon}
      {children !== undefined && <span className={cn(hideContent && 'invisible')}>{children}</span>}
      {kbd !== undefined && (
        <Kbd onFill={variant === 'default' || variant === 'destructive'} className={cn('group-data-disabled:hidden', hideContent && 'invisible')}>
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
