// Figma: RowImportFile — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-11301
// Figma: RowImportFileHeader — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-11306
import type { ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { TableCell, TableHead, TableHeader, TableRow, type TableRowProps } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Check 24, File fill, Maps to 140, Quality 128, Size 72, Languages 160, Action 28.
const w = { check: 'w-6', mapsTo: 'w-35', quality: 'w-32', size: 'w-18', languages: 'w-40', action: 'w-7' };

function RowImportFileHeader() {
  return (
    <TableHeader>
      <TableHead className={w.check} />
      <TableHead fill>File</TableHead>
      <TableHead className={w.mapsTo}>Maps to</TableHead>
      <TableHead className={w.quality}>Quality</TableHead>
      <TableHead align="end" className={w.size}>Size</TableHead>
      <TableHead className={w.languages}>Languages</TableHead>
      <TableHead className={w.action} />
    </TableHeader>
  );
}

type RowImportFileProps = Omit<TableRowProps, 'progress' | 'marker'> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Names the checkbox for screen readers, such as the file name. */
  checkLabel: string;
  file: ReactNode;
  /** Episode words, or an episodes Select. */
  mapsTo?: ReactNode;
  /** Quality Badge or Select. */
  quality?: ReactNode;
  size?: ReactNode;
  /** Language words or Select. */
  languages?: ReactNode;
  actions?: ReactNode;
  /** Amber bar and amber Maps to words. */
  problem?: boolean;
};

/** One file in a manual import. Unchecked files dim. */
function RowImportFile({ checked, onCheckedChange, checkLabel, file, mapsTo, quality, size, languages, actions, problem = false, ...props }: RowImportFileProps) {
  const dim = !checked && 'text-subtle-foreground';
  return (
    <TableRow marker={problem ? 'warning' : undefined} {...props}>
      <TableCell className={w.check}>
        <Checkbox checked={checked} onCheckedChange={(next) => onCheckedChange(next)} aria-label={checkLabel} />
      </TableCell>
      <TableCell fill className={cn('text-muted-foreground', dim)}>
        <span className="truncate">{file}</span>
      </TableCell>
      <TableCell className={cn(w.mapsTo, 'font-semibold', problem && 'text-warning', dim)}>
        <span className="truncate">{mapsTo}</span>
      </TableCell>
      <TableCell className={w.quality}>{quality}</TableCell>
      <TableCell align="end" className={w.size}>{size}</TableCell>
      <TableCell className={cn(w.languages, 'text-muted-foreground')}>
        <span className="truncate">{languages}</span>
      </TableCell>
      <TableCell align="end" className={w.action}>{actions}</TableCell>
    </TableRow>
  );
}

export { RowImportFile, RowImportFileHeader };
