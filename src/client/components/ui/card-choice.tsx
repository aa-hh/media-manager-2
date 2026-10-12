// v2/Card/choice — ~/Projects/media-manager-2-design/design-system.lib.pen E7Mh6m
import type { ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { Radio } from '@/components/ui/radio';
import { cn } from '@/lib/utils';

type CardChoiceProps = {
  /** The RadioGroup value this card picks. */
  value: string;
  title: ReactNode;
  description?: ReactNode;
  /** Number hint, such as "1"; show only where the shortcut exists. */
  kbd?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/**
 * A large choice in a panel or dialog; place inside RadioGroup. Selected: 2 px black edge and the radio on, no tint.
 * The second pixel of the edge is an inset shadow so the content does not move.
 */
function CardChoice({ value, title, description, kbd, disabled = false, className }: CardChoiceProps) {
  return (
    <label
      className={cn(
        'group flex w-full flex-col gap-1.5 rounded-md border border-border bg-card px-4 py-3.5',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'not-has-data-disabled:hover:bg-surface-hover not-has-data-disabled:active:bg-surface-pressed',
        'has-data-checked:border-foreground has-data-checked:shadow-[inset_0_0_0_1px_var(--foreground)]',
        'has-data-disabled:bg-muted',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring [&_[data-control]]:focus-visible:outline-none',
        className,
      )}
    >
      <span className="flex w-full items-center gap-2">
        <Radio value={value} disabled={disabled} data-control="" />
        <span className="min-w-0 flex-1 font-ui text-sm font-semibold text-foreground group-has-data-disabled:text-faint-foreground">{title}</span>
        {kbd !== undefined && <Kbd>{kbd}</Kbd>}
      </span>
      {description !== undefined && (
        <span className="font-ui text-[13px] leading-[1.45] font-normal text-muted-foreground group-has-data-disabled:text-faint-foreground">{description}</span>
      )}
    </label>
  );
}

export { CardChoice };
