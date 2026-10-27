// Figma: StatusInline — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2905
import { AlertCircle, Check } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type InlineStatus = 'sent' | 'failed' | 'busy';

/** Result of an action next to the control that started it, in words. */
function StatusInline({ status, className, children, ...props }: ComponentProps<'span'> & { status: InlineStatus }) {
  return (
    <span
      // Failures interrupt; a caller's own role still wins because props spread after.
      role={status === 'failed' ? 'alert' : 'status'}
      className={cn('inline-flex h-5 items-center gap-1.5 font-ui text-[13px] font-medium', status === 'failed' ? 'text-destructive' : 'text-muted-foreground', className)}
      {...props}
    >
      {status === 'sent' && <Check aria-hidden="true" className="size-3 shrink-0" />}
      {status === 'failed' && <AlertCircle aria-hidden="true" className="size-3 shrink-0" />}
      {status === 'busy' && <Spinner className="size-3" />}
      {children}
    </span>
  );
}

export { StatusInline };
export type { InlineStatus };
