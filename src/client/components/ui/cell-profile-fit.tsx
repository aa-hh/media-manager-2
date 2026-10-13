// v2/Cell/profile-fit — ~/Projects/media-manager-2-design/design-system.lib.pen rolXw
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

/** A release's quality profile score in a table cell, such as "+1600", after a check. No box. */
function CellProfileFit({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 font-data text-sm text-muted-foreground">
      <Check aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  );
}

export { CellProfileFit };
