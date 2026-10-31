// Figma: Spinner — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-600
import { LoaderCircle, type LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 16 px by default; size it with a size-* class. Muted on white; pass text-bar-foreground on dark. */
function Spinner({ className, ...props }: LucideProps) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn('size-4 shrink-0 animate-[spin_var(--duration-spin)_linear_infinite] text-muted-foreground', className)}
      {...props}
    />
  );
}

export { Spinner };
