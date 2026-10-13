// v2/Input/Search — ~/Projects/media-manager-2-design/design-system.lib.pen tY5yB
import { Input } from '@base-ui/react/input';
import { Search, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

type InputSearchProps = ComponentProps<typeof Input> & {
  /** search: the 48 px app bar field. field: the 40 px form input used inside FieldLabelled. */
  variant?: 'search' | 'field';
  /** Lead icon; the search variant shows the magnifier unless given null. */
  icon?: ReactNode;
  kbd?: ReactNode;
  /** Shows the Clear button while the field has text. */
  onClear?: () => void;
  clearLabel?: string;
  wrapperClassName?: string;
};

const looks = {
  search: cn(
    'h-12 gap-3 rounded-(--control-radius-large) border-[1.5px] border-transparent bg-muted px-(--space-4) text-base',
    'not-has-disabled:hover:bg-surface-pressed [&>svg]:size-5',
  ),
  field: cn(
    'h-(--control-h-default) gap-2 rounded-(--control-radius-default) border-input bg-card px-(--control-px-default) text-(length:--control-text-default) pointer-coarse:text-base',
    'not-has-disabled:hover:border-muted-foreground has-disabled:border-border has-disabled:bg-muted [&>svg]:size-4',
  ),
};

/** Rest: grey fill, no edge. Focus: white fill, input edge and the focus ring. */
function InputSearch({ variant = 'search', icon, kbd, onClear, clearLabel = 'Clear', wrapperClassName, className, value, ...props }: InputSearchProps) {
  const lead = icon === undefined && variant === 'search' ? <Search aria-hidden="true" /> : icon;
  const hasText = value !== undefined && value !== null && String(value) !== '';
  return (
    <div
      className={cn(
        'group flex items-center border font-ui text-muted-foreground transition-colors duration-(--duration-fast) ease-out',
        'has-[input:focus-visible]:border-input! has-[input:focus-visible]:bg-card! has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring',
        'has-data-invalid:border-destructive has-aria-invalid:border-destructive has-disabled:text-faint-foreground',
        looks[variant],
        wrapperClassName,
      )}
    >
      {lead}
      <Input
        value={value}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent text-foreground outline-hidden placeholder:text-muted-foreground',
          'disabled:text-faint-foreground disabled:placeholder:text-faint-foreground',
          className,
        )}
        {...props}
      />
      {onClear && hasText && (
        <button type="button" aria-label={clearLabel} onClick={onClear} className="inline-flex shrink-0 rounded-xs text-muted-foreground focus-ring">
          <X aria-hidden="true" className="size-4.5" />
        </button>
      )}
      {kbd !== undefined && <Kbd className="group-has-disabled:hidden">{kbd}</Kbd>}
    </div>
  );
}

export { InputSearch };
