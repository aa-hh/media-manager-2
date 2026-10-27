// v2/Fact — ~/Projects/media-manager-2-design/design-system.lib.pen TeJ1Y
// v2/Fact/row — ~/Projects/media-manager-2-design/design-system.lib.pen e95lV
import { useId, type ComponentProps, type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** Small capital label over a value, for the title header. Place inside a <dl>. */
function Fact({ label, className, children, ...props }: ComponentProps<'div'> & { label: ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)} {...props}>
      <dt className="font-ui text-[11px] font-semibold tracking-[0.5px] text-subtle-foreground uppercase">{label}</dt>
      <dd className="font-data text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

type FactRowProps = ComponentProps<'div'> & {
  label: ReactNode;
  /** Limits such as "minimum 0.6", or a MarkPendingChange. */
  note?: ReactNode;
  /** Disk use, 0 to 100; shows the bar. */
  progress?: number;
  /** Value and bar turn red when over a limit. */
  overLimit?: boolean;
};

/** Label, value, line under, 40 px. Place inside a <dl>. */
function FactRow({ label, note, progress, overLimit = false, className, children, ...props }: FactRowProps) {
  const labelId = useId();
  return (
    <div className={cn('flex h-(--row) items-center gap-3 border-b border-border', className)} {...props}>
      <dt id={labelId} className="w-35 shrink-0 truncate font-ui text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-3">
        {progress !== undefined && <Progress aria-labelledby={labelId} value={progress} tone={overLimit ? 'stalled' : 'downloading'} className="w-40" />}
        <span className={cn('font-data text-sm font-semibold', overLimit ? 'text-destructive' : 'text-foreground')}>{children}</span>
        {note !== undefined && <span className="font-data text-[13px] text-subtle-foreground">{note}</span>}
      </dd>
    </div>
  );
}

export { Fact, FactRow };
