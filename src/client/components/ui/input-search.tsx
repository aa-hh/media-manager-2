// Figma: InputSearch — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-958
// The field and field-on-dark looks are the Input inside FieldLabelled in Figma, its on-dark and empty looks included: https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1769
import { Input } from '@base-ui/react/input';
import { Search, X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

type InputSearchProps = ComponentProps<typeof Input> & {
  /** search: the 48 px app bar field. field: the 36 px form input used inside FieldLabelled. field-on-dark: the same on the dark sign-in ground. */
  variant?: 'search' | 'field' | 'field-on-dark';
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
    'has-[input:focus-visible]:border-input! has-[input:focus-visible]:bg-card! has-[input:focus-visible]:outline-ring',
  ),
  field: cn(
    'h-(--control-h-default) gap-2 rounded-(--control-radius-default) border-input bg-card px-(--control-px-default) text-(length:--control-text-default) pointer-coarse:text-base',
    'not-has-disabled:hover:border-muted-foreground has-disabled:border-border has-disabled:bg-muted [&>svg]:size-4',
    'has-[input:focus-visible]:border-input! has-[input:focus-visible]:bg-card! has-[input:focus-visible]:outline-ring',
  ),
  'field-on-dark': cn(
    'h-(--control-h-default) gap-2 rounded-(--control-radius-default) border-input-on-dark bg-card-on-dark px-(--control-px-default) text-(length:--control-text-default) text-muted-foreground-on-dark pointer-coarse:text-base',
    'has-data-invalid:border-2 has-data-invalid:border-destructive-on-dark has-aria-invalid:border-2 has-aria-invalid:border-destructive-on-dark [&>svg]:size-4',
    'has-[input:focus-visible]:outline-focus-on-dark',
  ),
};

const inputText = {
  search: 'text-foreground placeholder:text-muted-foreground',
  field: 'text-foreground placeholder:text-subtle-foreground',
  'field-on-dark': 'text-foreground-on-dark placeholder:text-muted-foreground-on-dark',
};

/** Rest: grey fill, no edge. Focus: white fill, input edge and the focus ring. */
function InputSearch({ variant = 'search', icon, kbd, onClear, clearLabel = 'Clear', wrapperClassName, className, value, ...props }: InputSearchProps) {
  const lead = icon === undefined && variant === 'search' ? <Search aria-hidden="true" /> : icon;
  const hasText = value !== undefined && value !== null && String(value) !== '';
  return (
    <div
      className={cn(
        'group flex items-center border font-ui text-muted-foreground transition-colors duration-(--duration-fast) ease-out',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2',
        'has-data-invalid:border-destructive has-aria-invalid:border-destructive has-disabled:text-faint-foreground',
        looks[variant],
        wrapperClassName,
      )}
    >
      {lead}
      <Input
        value={value}
        className={cn(
          'h-full min-w-0 flex-1 bg-transparent outline-hidden',
          inputText[variant],
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
