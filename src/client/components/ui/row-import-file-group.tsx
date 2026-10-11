// v2/Row/import-file-group — design/design-system.lib.pen N2L6Em
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Chevron 20, Check 24, Folder fill, Count 120, Size 96, Action 140.
const w = { chevron: 'w-5', check: 'w-6', count: 'w-30', size: 'w-24', action: 'w-35' };

type RowImportFileGroupProps = Omit<TableRowProps, 'progress'> & {
  open?: boolean;
  /** "mixed" when only some files are ticked. */
  checked: boolean | 'mixed';
  onCheckedChange: (checked: boolean) => void;
  checkLabel: string;
  folder: ReactNode;
  /** Such as "9 of 10 files". */
  count?: ReactNode;
  size?: ReactNode;
  /** The row-size Import button. */
  actions?: ReactNode;
};

/** Folder or pack heading in a manual import; the chevron turns 90 degrees as it opens. */
function RowImportFileGroup({ open = false, checked, onCheckedChange, checkLabel, folder, count, size, actions, ...props }: RowImportFileGroupProps) {
  return (
    <TableRow aria-expanded={open} {...props}>
      <TableCell className={w.chevron}>
        <ChevronRight
          aria-hidden="true"
          className={cn('size-4 text-muted-foreground transition-transform duration-(--duration-base) ease-out', open && 'rotate-90')}
        />
      </TableCell>
      <TableCell className={w.check}>
        <Checkbox
          checked={checked === true}
          indeterminate={checked === 'mixed'}
          onCheckedChange={(next) => onCheckedChange(next)}
          onClick={(event) => event.stopPropagation()}
          aria-label={checkLabel}
        />
      </TableCell>
      <TableCell fill className="font-ui font-semibold">
        <span className="truncate">{folder}</span>
      </TableCell>
      <TableCell className={cn(w.count, 'text-muted-foreground')}>{count}</TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell align="end" className={w.action}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowImportFileGroup };
