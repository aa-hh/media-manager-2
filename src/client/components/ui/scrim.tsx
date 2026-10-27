// Figma: Scrim — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-5349
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Dims the whole page behind a dialog: black at 30%. The Dialog renders it as its backdrop, so it fades with the dialog. */
function Scrim({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('fixed inset-0 z-50 bg-scrim', className)} {...props} />;
}

export { Scrim };
