// v2/Bar/bottom-action — design/design-system.lib.pen z2z0d
import { PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BarBottomActionProps = {
  summary: ReactNode;
  /** The one main action, a large default Button. */
  action: ReactNode;
  /** Outline Button such as Discard edits; pass it with unsavedNote when there are unsaved edits. */
  secondary?: ReactNode;
  /** Amber words such as "Unsaved edits". */
  unsavedNote?: ReactNode;
  /** Desktop: the inline footer of an editor or panel (48 px, no fill, no line, summary in the UI font). Off: the phone footer. */
  inline?: boolean;
  className?: string;
};

/** Footer holding the one main action for a screen or an editor. */
function BarBottomAction({ summary, action, secondary, unsavedNote, inline = true, className }: BarBottomActionProps) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-3',
        inline ? 'h-12 bg-transparent' : 'h-20 border-t border-border bg-card px-4',
        className,
      )}
    >
      <p className={cn('min-w-0 flex-1 text-sm font-normal text-muted-foreground', inline ? 'font-ui' : 'font-data')}>{summary}</p>
      {unsavedNote !== undefined && (
        <span className="flex shrink-0 items-center gap-1.5 font-ui text-[13px] font-semibold text-warning">
          <PencilLine aria-hidden="true" className="size-3.5" />
          {unsavedNote}
        </span>
      )}
      {secondary}
      {action}
    </div>
  );
}

export { BarBottomAction };
