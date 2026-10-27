// Figma: FactStacked — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1256
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Label over value, 2 px apart, for the title page's three-column fact grid. Place inside a <dl>. */
function FactStacked({ label, className, children, ...props }: ComponentProps<'div'> & { label: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5', className)} {...props}>
      <dt className="text-body font-semibold text-foreground">{label}</dt>
      <dd className="text-body text-muted-foreground">{children}</dd>
    </div>
  );
}

export { FactStacked };
