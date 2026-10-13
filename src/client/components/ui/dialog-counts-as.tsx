// v2/Dialog/counts-as — ~/Projects/media-manager-2-design/design-system.lib.pen sxn6s
// v2/Dialog/counts-as/open — ~/Projects/media-manager-2-design/design-system.lib.pen QuXfd
import type { ReactNode } from 'react';
import { CollapsibleContent } from '@/components/ui/collapsible-content';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';

type DialogCountsAsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current value beside the title while closed, such as "Season 2 · E08 Sweet Vitriol". */
  summary: ReactNode;
  /** The season in plain words. */
  season: ReactNode;
  /** One Select with an inline, sm SelectTrigger. */
  select: ReactNode;
  help: ReactNode;
};

/**
 * Tertiary disclosure under the grab dialog's choice cards: closed shows "Counts as" and the current value; open,
 * a sentence of the season and one inline select, then a help line. The dialog's Enter shortcut skips everything
 * inside data-counts-as, so Enter opens it or picks an episode instead of grabbing.
 */
function DialogCountsAs({ open, onOpenChange, summary, season, select, help }: DialogCountsAsProps) {
  return (
    <Collapsible open={open} onOpenChange={(next) => onOpenChange(next)} data-counts-as="" className="flex flex-col gap-0.5">
      <CollapsibleTrigger summary={open ? undefined : summary} className="px-3">Counts as</CollapsibleTrigger>
      <CollapsibleContent className="gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-ui text-sm font-medium text-foreground">{season}</span>
          {select}
        </div>
        <p className="font-ui text-[13px] text-muted-foreground">{help}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export { DialogCountsAs };
