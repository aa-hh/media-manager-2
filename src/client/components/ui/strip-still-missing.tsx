// v2/Strip/still-missing — ~/Projects/media-manager-2-design/design-system.lib.pen EBkBo
import { CircleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type StripStillMissingProps = ComponentProps<'div'> & {
  /** Amber lead word, such as "Still missing". */
  lead: ReactNode;
  /** The missing items, in the data font. */
  children: ReactNode;
  /** Ghost button at the right, such as Next missing. */
  action?: { label: ReactNode; onClick: () => void; kbd?: ReactNode; disabled?: boolean };
};

/** Amber strip above an episode or movie table when monitored items are still missing. */
function StripStillMissing({ lead, action, className, children, ...props }: StripStillMissingProps) {
  return (
    <div role="status" className={cn('flex h-14 w-full items-center gap-2.5 rounded-md bg-warning-soft pr-2 pl-4', className)} {...props}>
      <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
      <span className="shrink-0 font-ui text-sm font-bold text-warning">{lead}</span>
      <span className="min-w-0 flex-1 truncate font-data text-sm font-normal text-foreground">{children}</span>
      {action !== undefined && (
        <Button
          variant="ghost"
          kbd={action.kbd}
          disabled={action.disabled}
          onClick={action.onClick}
          className="gap-1.5 not-data-disabled:hover:bg-card/60"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}

export { StripStillMissing };
