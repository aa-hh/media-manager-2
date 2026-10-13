// v2/Line/inset-notice — ~/Projects/media-manager-2-design/design-system.lib.pen cwdtI
// v2/Line/inset-notice/no button — ~/Projects/media-manager-2-design/design-system.lib.pen u9Mq5
// v2/Line/inset-notice/movie — ~/Projects/media-manager-2-design/design-system.lib.pen c90y1
import type { ReactNode } from 'react';

/** A notice inside the releases inset: one 40 px warning-soft line spanning the inset, the message, and an optional row-size outline Button at the right edge. */
function LineInsetNotice({ children, action, role = 'status' }: { children: ReactNode; action?: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div role={role} className="flex h-(--row) w-full shrink-0 items-center gap-4 border-b border-input bg-warning-soft pr-0 pl-2.5">
      <p className="min-w-0 flex-1 truncate font-ui text-[13px] text-foreground">{children}</p>
      {action}
    </div>
  );
}

export { LineInsetNotice };
