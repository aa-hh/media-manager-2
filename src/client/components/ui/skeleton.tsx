// Figma: Skeleton — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-381
// Figma: SkeletonRow — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-384
// Figma: SkeletonRowTwoLine — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-392
// Figma: SkeletonPosterCard — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-417
// Figma: SkeletonSearchResult — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-423
// Figma: SkeletonCalendarEntry — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-431
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Grey block while data loads, 160 by 14 and radius 4 unless sized with classes.
 * A light band sweeps across the window once per duration-shimmer and every block shows its slice of it
 * (skeleton-shimmer in globals.css); under reduced motion the block stays still and plain.
 */
function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('h-3.5 w-40 shrink-0 rounded-xs bg-muted skeleton-shimmer motion-reduce:bg-none', className)}
      {...props}
    />
  );
}

/** Loading row in a 40 px table. */
function SkeletonRow({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex h-(--row) w-full items-center gap-4 px-4', className)} {...props}>
      <Skeleton className="w-12" />
      <Skeleton className="w-auto flex-1" />
      <Skeleton className="w-30" />
      <Skeleton className="w-30" />
      <Skeleton className="w-22.5" />
    </div>
  );
}

/** Loading row in a 56 px two-line table. */
function SkeletonRowTwoLine({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex h-(--row-two-line) w-full items-center gap-4 px-4', className)} {...props}>
      <Skeleton className="w-12" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="w-70" />
        <Skeleton className="h-3 w-45" />
      </div>
      <Skeleton className="w-30" />
      <Skeleton className="w-30" />
      <Skeleton className="w-22.5" />
    </div>
  );
}

/** Loading poster card: 210 by 315 poster, title and meta lines. */
function SkeletonPosterCard({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex w-(--poster-width) flex-col gap-2', className)} {...props}>
      <Skeleton className="h-78.75 w-(--poster-width) rounded-md" />
      <Skeleton className="w-30" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Loading search result: poster thumb and three lines, 84 px. */
function SkeletonSearchResult({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex h-21 w-full items-center gap-3.5 px-4 py-2.5', className)} {...props}>
      <Skeleton className="h-15 w-10" />
      <div className="flex min-w-0 flex-col gap-2">
        <Skeleton className="w-60" />
        <Skeleton className="h-3 w-105" />
        <Skeleton className="h-3 w-140" />
      </div>
    </div>
  );
}

/** Loading calendar entry: a muted tile with two border-coloured lines. */
function SkeletonCalendarEntry({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div role="status" aria-label="Loading" className={cn('flex h-11 w-full flex-col gap-1.5 rounded-sm bg-muted py-1.5 pr-2 pl-2.5', className)} {...props}>
      <Skeleton className="h-3 w-25 bg-border" />
      <Skeleton className="h-2.5 w-17.5 bg-border" />
    </div>
  );
}

export { Skeleton, SkeletonCalendarEntry, SkeletonPosterCard, SkeletonRow, SkeletonRowTwoLine, SkeletonSearchResult };
