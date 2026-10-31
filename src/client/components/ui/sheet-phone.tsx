// Figma: SheetPhone — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7991
import type { ReactNode } from 'react';

type SheetPhoneProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  /** A large default Button; the sheet stretches it full width. */
  primary?: ReactNode;
  /** A large outline Button, such as Cancel; stretched full width. */
  secondary?: ReactNode;
};

/** A sheet rising from the bottom of a phone screen: grab handle, title, content, then the actions stacked full width. */
function SheetPhone({ title, subtitle, children, primary, secondary }: SheetPhoneProps) {
  return (
    <div className="flex w-full flex-col gap-3 rounded-t-[10px] bg-popover px-4 pt-2 pb-6 shadow-float-up [&>button]:w-full">
      <div aria-hidden="true" className="flex justify-center">
        <span className="h-1 w-9 rounded-full bg-input" />
      </div>
      <div className="flex flex-col">
        <h2 className="font-ui text-lg font-bold text-foreground">{title}</h2>
        {subtitle !== undefined && <p className="text-data text-muted-foreground">{subtitle}</p>}
      </div>
      {children !== undefined && <div className="w-full">{children}</div>}
      {primary}
      {secondary}
    </div>
  );
}

export { SheetPhone };
