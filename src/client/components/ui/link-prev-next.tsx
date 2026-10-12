// v2/Link prev-next — ~/Projects/media-manager-2-design/design-system.lib.pen U5XiTa
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Step = { label: ReactNode; onClick?: () => void; disabled?: boolean; kbd?: ReactNode; 'aria-label'?: string };

const step = 'gap-1.5 text-muted-foreground not-data-disabled:hover:text-foreground';

/** Step between episodes or titles: two ghost buttons, each with its own hover, pressed, focus and disabled. */
function LinkPrevNext({ previous, next, className, ...props }: ComponentProps<'div'> & { previous?: Step; next?: Step }) {
  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      {previous && (
        <Button variant="ghost" className={step} icon={<ChevronLeft aria-hidden="true" />} kbd={previous.kbd} onClick={previous.onClick} disabled={previous.disabled} aria-label={previous['aria-label']}>
          {previous.label}
        </Button>
      )}
      {next && (
        <Button variant="ghost" className={step} icon={<ChevronRight aria-hidden="true" />} kbd={next.kbd} onClick={next.onClick} disabled={next.disabled} aria-label={next['aria-label']}>
          {next.label}
        </Button>
      )}
    </div>
  );
}

export { LinkPrevNext };
