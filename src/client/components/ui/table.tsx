// v2/Table — ~/Projects/media-manager-2-design/design-system.lib.pen gp6Kh
// v2/Table/Header — ~/Projects/media-manager-2-design/design-system.lib.pen Fj6GM
// v2/Table/Row — ~/Projects/media-manager-2-design/design-system.lib.pen IODuw
// v2/Table/Cell — ~/Projects/media-manager-2-design/design-system.lib.pen I73rkQ
import { ArrowDown } from 'lucide-react';
import type { ComponentProps, CSSProperties } from 'react';
import { Logo, trackerLogo, trackerName } from '@/components/ui/logo';
import { cn } from '@/lib/utils';

/**
 * White, 1 px edge, radius 10, clips its rows. Children: a TableHeader, then rows. The rows sit in a body that
 * pulls up 1 px under the clipped bottom edge, so the last row's line is hidden however the rows are wrapped.
 */
function Table({ className, children, ...props }: ComponentProps<'div'>) {
  return (
    <div role="table" className={cn('flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card', className)} {...props}>
      <div className="-mb-px flex flex-col">{children}</div>
    </div>
  );
}

/** Column header row, 32 px, white, line under. Children are TableHead cells with the widths of the rows below. */
function TableHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div role="row" className={cn('flex h-(--row-header) w-full shrink-0 items-center gap-4 border-b border-border bg-card px-4', className)} {...props} />;
}

type CellProps = ComponentProps<'div'> & {
  /** Numbers right-align. */
  align?: 'start' | 'end';
  /** Takes the width the fixed columns leave. */
  fill?: boolean;
};

const cellLayout = (align: CellProps['align'], fill: boolean) => cn('flex h-full items-center gap-1', fill ? 'min-w-0 flex-1' : 'shrink-0', align === 'end' && 'justify-end');

/** Column header: 11/600 capitals in subtle-foreground. Sorted shows the arrow. */
function TableHead({ align, fill = false, sorted = false, className, children, ...props }: CellProps & { sorted?: boolean }) {
  return (
    <div
      role="columnheader"
      aria-sort={sorted ? 'descending' : undefined}
      className={cn(cellLayout(align, fill), 'font-ui text-[11px] font-semibold tracking-[0.5px] whitespace-nowrap text-subtle-foreground uppercase', className)}
      {...props}
    >
      {children}
      {sorted && <ArrowDown aria-hidden="true" className="size-3 shrink-0 text-foreground" />}
    </div>
  );
}

/** One cell: data font 14 in foreground. Put text, a badge, a mark, a button or a logo inside. */
function TableCell({ align, fill = false, className, ...props }: CellProps) {
  return <div role="cell" className={cn(cellLayout(align, fill), 'font-data text-sm text-foreground', className)} {...props} />;
}

type TableRowProps = ComponentProps<'div'> & {
  /** Selected tint plus the 3 px black bar. */
  selected?: boolean;
  /** Red or amber 3 px bar on the left edge. */
  marker?: 'risk' | 'warning';
  /** best-soft tint for the best release. */
  best?: boolean;
  /** Grabbed: a 3 px black line along the bottom edge at this percent; it grows from 0. */
  progress?: number;
};

/**
 * The base row, 40 px with 16 px side padding. Hover and pressed fills, the selected tint and bar, risk and
 * warning bars, the best tint and a 2 px inner focus edge. Give it tabIndex when the screen moves focus to rows.
 */
function TableRow({ selected = false, marker, best = false, progress, className, children, onClick, ...props }: TableRowProps) {
  return (
    <div
      role="row"
      data-selected={selected || undefined}
      onClick={onClick}
      className={cn(
        'relative flex h-(--row) w-full shrink-0 items-center gap-4 border-b border-border px-4',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0',
        'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
        selected ? 'bg-selected' : best ? 'bg-best-soft' : 'bg-card hover:bg-surface-hover',
        onClick !== undefined && 'cursor-pointer',
        onClick !== undefined && !selected && 'active:bg-surface-pressed',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-0.75 transition-opacity duration-(--duration-fast) ease-out',
          marker === 'risk' ? 'bg-destructive' : marker === 'warning' ? 'bg-warning' : 'bg-foreground',
          selected || marker !== undefined ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
      {progress !== undefined && (
        <span
          aria-hidden="true"
          style={{ '--row-progress': `${progress}%` } as CSSProperties}
          className="pointer-events-none absolute bottom-0 left-0 h-0.75 w-(--row-progress) rounded-r-[2px] bg-foreground transition-[width] duration-(--duration-slow) ease-out starting:w-0"
        />
      )}
    </div>
  );
}

/** Tracker cell content shared by the release, version, download and blocklist rows: the real logo at 16 px, then the name as the design writes it. */
function TableCellTracker({ name, className }: { name: string; className?: string }) {
  // An empty name is no tracker at all, not a blank logo slot.
  if (name === '') return null;
  const logo = trackerLogo(name);
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5 text-muted-foreground', className)}>
      {logo !== undefined && <Logo name={logo} alt="" className="size-4" />}
      <span className="truncate">{trackerName(name)}</span>
    </span>
  );
}

export { Table, TableCell, TableCellTracker, TableHead, TableHeader, TableRow };
export type { TableRowProps };
