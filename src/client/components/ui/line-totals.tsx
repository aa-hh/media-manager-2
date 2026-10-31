// Figma: LineTotals — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2311
import { ArrowRight } from 'lucide-react';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Total = { value: ReactNode; word?: ReactNode };
type TotalsLink = { label: ReactNode; href: string; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void };

/** Library totals under the page title, with an optional red link (opens Flagged). */
function LineTotals({ totals, link, className, ...props }: ComponentProps<'p'> & { totals: Total[]; link?: TotalsLink }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-4 font-data text-[15px]', className)} {...props}>
      {totals.map((total, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="font-semibold text-foreground">{total.value}</span>
          {total.word !== undefined && <span className="text-muted-foreground">{total.word}</span>}
        </span>
      ))}
      {link && (
        <a href={link.href} onClick={link.onClick} className="flex items-center gap-1 rounded-xs font-semibold text-destructive hover:underline focus-ring">
          {link.label}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </p>
  );
}

export { LineTotals };
