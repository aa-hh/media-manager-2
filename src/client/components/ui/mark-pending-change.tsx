// Figma: MarkPendingChange — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-865
import { ArrowRight, Clock3 } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarkPendingChangeProps = ComponentProps<'span'> & {
  /** Old value; leave out in Fact/row, where Value already shows it. */
  from?: ReactNode;
  to: ReactNode;
  /** Clock icon; turn off when space is tight. */
  icon?: boolean;
};

/** A change waiting for Sonarr or Radarr, or an unsaved edit. Give it an aria-label such as "Monitored changing from off to on". */
function MarkPendingChange({ from, to, icon = true, className, ...props }: MarkPendingChangeProps) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-xs bg-warning-soft px-1.5 font-data text-[13px] whitespace-nowrap [&>svg]:size-3 [&>svg]:text-warning', className)} {...props}>
      {icon && <Clock3 aria-hidden="true" />}
      {from !== undefined && <span className="font-medium text-subtle-foreground">{from}</span>}
      <ArrowRight aria-hidden="true" />
      <span className="font-semibold text-foreground">{to}</span>
    </span>
  );
}

export { MarkPendingChange };
