// Figma: FieldLabelledOptional — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1940
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
