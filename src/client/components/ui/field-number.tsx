// v2/Field/number — ~/Projects/media-manager-2-design/design-system.lib.pen FIdi9
import type { ComponentProps, ReactNode } from 'react';
import { InputSearch } from '@/components/ui/input-search';
import { cn } from '@/lib/utils';

type FieldNumberProps = Omit<ComponentProps<typeof InputSearch>, 'variant' | 'icon' | 'kbd' | 'onClear'> & {
  /** Words before the box, such as "Up to". */
  before?: ReactNode;
  /** Words after the box, such as "hours +". */
  after?: ReactNode;
  /** Box width; 72 px by default. */
  boxClassName?: string;
};

/** A short number box with its words around it, read as one sentence. The label wraps all of it, so the words name the box. */
function FieldNumber({ before, after, boxClassName, className, ...props }: FieldNumberProps) {
  return (
    <label className={cn('inline-flex shrink-0 items-center gap-2 font-ui text-sm text-foreground', className)}>
      {before !== undefined && <span className="whitespace-nowrap">{before}</span>}
      <InputSearch
        variant="field"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        wrapperClassName={cn('w-18 px-3', boxClassName)}
        className="font-data placeholder:text-subtle-foreground"
        {...props}
      />
      {after !== undefined && <span className="whitespace-nowrap">{after}</span>}
    </label>
  );
}

export { FieldNumber };
