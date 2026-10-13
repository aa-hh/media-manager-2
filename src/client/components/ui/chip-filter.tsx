// v2/Chip/filter — ~/Projects/media-manager-2-design/design-system.lib.pen yDjSk
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

/** A filter that is on, with a button that removes it. Only the remove button takes focus. */
function ChipFilter({ children, onRemove, removeLabel }: { children: ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border-[1.5px] border-input bg-card pr-1.5 pl-2.5 font-ui text-[13px] font-medium whitespace-nowrap text-foreground">
      {children}
      <button type="button" aria-label={removeLabel} onClick={onRemove} className="focus-ring flex rounded-full">
        <X aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </button>
    </span>
  );
}

export { ChipFilter };
