// v2/Option row — design/design-system.lib.pen qq4VX
import type { ComponentProps, ReactNode } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

type OptionRowProps = ComponentProps<'label'> & {
  /** A Radio (inside a RadioGroup) or a Checkbox. Selection shows in the control, never as a tint. */
  control: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  kbd?: ReactNode;
};

/** A radio or checkbox with a title and a line of explanation. The focus ring wraps the whole row. */
function OptionRow({ control, title, description, kbd, className, ...props }: OptionRowProps) {
  return (
    <label
      className={cn(
        'group flex w-full gap-2.5 rounded-sm p-2.5',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'not-has-data-disabled:hover:bg-surface-hover not-has-data-disabled:active:bg-surface-pressed',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
        '[&>[data-control]>*]:focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      <span data-control="" className="flex shrink-0">{control}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-ui text-sm font-semibold text-foreground group-has-data-disabled:text-faint-foreground">{title}</span>
        {description !== undefined && (
          <span className="font-ui text-[13px] leading-[1.4] text-muted-foreground group-has-data-disabled:text-faint-foreground">{description}</span>
        )}
      </span>
      {kbd !== undefined && <Kbd>{kbd}</Kbd>}
    </label>
  );
}

export { OptionRow };
