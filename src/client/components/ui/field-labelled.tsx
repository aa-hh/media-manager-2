// Figma: FieldLabelled — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1769
import { Field } from '@base-ui/react/field';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FieldLabelledProps = ComponentProps<typeof Field.Root> & {
  label: ReactNode;
  help?: ReactNode;
  /** Replaces the help line; keep it to one short sentence. */
  error?: ReactNode;
  /** Button after the control, such as a ghost "Replace" for a saved secret. */
  action?: ReactNode;
  /** On the dark sign-in ground: light label, help and error text. */
  onDark?: boolean;
};

/** Label above a control (an InputSearch with variant "field"), help or error below. Width follows the container. */
function FieldLabelled({ label, help, error, action, onDark = false, className, children, ...props }: FieldLabelledProps) {
  return (
    <Field.Root invalid={error !== undefined || undefined} className={cn('flex w-full flex-col gap-1.5', className)} {...props}>
      <Field.Label className={cn('font-ui text-[13px] font-semibold data-disabled:text-faint-foreground', onDark ? 'text-foreground-on-dark' : 'text-foreground')}>{label}</Field.Label>
      <div className="flex w-full items-center gap-2 [&>*:first-child]:flex-1">
        {children}
        {action}
      </div>
      {error !== undefined
        ? <Field.Error match className={cn('font-ui text-xs', onDark ? 'leading-[1.45] text-destructive-on-dark' : 'text-destructive')}>{error}</Field.Error>
        : help !== undefined && <Field.Description className={cn('font-ui text-xs', onDark ? 'leading-[1.45] text-muted-foreground-on-dark' : 'text-subtle-foreground')}>{help}</Field.Description>}
    </Field.Root>
  );
}

export { FieldLabelled };
