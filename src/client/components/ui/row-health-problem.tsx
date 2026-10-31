// Figma: RowHealthProblem — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4453
import type { ReactNode } from 'react';
import { TableCell, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Two lines, 56 px. Logo 28, Problem fill, Since 120, Automatic fix 280, Action 120.
const w = { logo: 'w-7', since: 'w-30', fix: 'w-70', action: 'w-30' };

type RowHealthProblemProps = Omit<TableRowProps, 'progress'> & {
  /** The real service or tracker Logo at 20 px. */
  logo: ReactNode;
  problem: ReactNode;
  detail?: ReactNode;
  since?: ReactNode;
  /** A 14 px icon or Spinner before the fix words, coloured by the screen. */
  fixIcon?: ReactNode;
  /** What the automatic fix is doing, or "Gave up after 3 tries". */
  fix?: ReactNode;
  /** One row-size outline Button. */
  actions?: ReactNode;
};

/** One health problem. Use marker "risk" for a named risk and "warning" for a warning; handled rows have none. */
function RowHealthProblem({ logo, problem, detail, since, fixIcon, fix, actions, className, ...props }: RowHealthProblemProps) {
  return (
    <TableRow className={cn('h-(--row-two-line)', className)} {...props}>
      <TableCell className={cn(w.logo, '[&_img]:size-5')}>{logo}</TableCell>
      <TableCell fill className="flex-col items-start justify-center gap-0.5">
        <span className="w-full truncate font-ui font-semibold select-text">{problem}</span>
        {detail !== undefined && <span className="w-full truncate text-[13px] text-muted-foreground">{detail}</span>}
      </TableCell>
      <TableCell className={cn(w.since, 'text-muted-foreground')}>{since}</TableCell>
      <TableCell className={cn(w.fix, 'gap-1.5')}>
        {fixIcon !== undefined && <span className="flex shrink-0 [&>svg]:size-3.5">{fixIcon}</span>}
        <span className="truncate">{fix}</span>
      </TableCell>
      <TableCell align="end" className={w.action}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowHealthProblem };
