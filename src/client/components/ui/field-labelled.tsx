// v2/Field/labelled — ~/Projects/media-manager-2-design/design-system.lib.pen N61zp
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
};

/** Label above a control (an InputSearch with variant "field"), help or error below. Width follows the container. */
function FieldLabelled({ label, help, error, action, className, children, ...props }: FieldLabelledProps) {
  return (
    <Field.Root invalid={error !== undefined || undefined} className={cn('flex w-full flex-col gap-1.5', className)} {...props}>
      <Field.Label className="font-ui text-[13px] font-semibold text-foreground data-disabled:text-faint-foreground">{label}</Field.Label>
      <div className="flex w-full items-center gap-2 [&>*:first-child]:flex-1">
        {children}
        {action}
      </div>
      {error !== undefined
        ? <Field.Error match className="font-ui text-xs text-destructive">{error}</Field.Error>
        : help !== undefined && <Field.Description className="font-ui text-xs text-subtle-foreground">{help}</Field.Description>}
    </Field.Root>
  );
}

export { FieldLabelled };
