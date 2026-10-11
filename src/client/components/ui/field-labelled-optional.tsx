// v2/Field/labelled optional — design/design-system.lib.pen r4FA5
import type { ComponentProps } from 'react';
import { FieldLabelled } from '@/components/ui/field-labelled';

/** FieldLabelled for a field that may be left blank: the word Optional follows the label. */
function FieldLabelledOptional({ label, ...props }: ComponentProps<typeof FieldLabelled>) {
  return (
    <FieldLabelled
      label={(
        <>
          {label}
          <span className="ml-1.5 text-xs font-normal text-subtle-foreground">Optional</span>
        </>
      )}
      {...props}
    />
  );
}

export { FieldLabelledOptional };
