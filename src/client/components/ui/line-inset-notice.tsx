// Figma: LineInsetNotice — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1237
import type { ReactNode } from 'react';

/**
 * A notice inside the releases inset: a warning-soft line spanning the inset, the message, and an optional row-size outline
 * Button at the right edge, drawn without its white fill and with the darker input edge. One line of words is 40 px with its bottom line (10 + 20 + 9 + 1); a longer message wraps.
 */
function LineInsetNotice({ children, action, role = 'status' }: { children: ReactNode; action?: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div role={role} className="flex min-h-(--row) w-full shrink-0 items-center gap-4 border-b border-input bg-warning-soft pr-0 pl-2.5 [&>button]:before:border-input [&>button]:before:bg-transparent">
      <p className="min-w-0 flex-1 pt-2.5 pb-[9px] font-ui text-[13px] leading-5 text-foreground select-text">{children}</p>
      {action}
    </div>
  );
}

export { LineInsetNotice };
