// Figma: RowEpisodeReleases — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-18095
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type RowEpisodeReleasesProps = {
  /** Episode: the block starts at the title column (152); movie: at 16. */
  variant: 'episode' | 'movie';
  /** LineInsetNotice lines, above the filter row. */
  notices?: ReactNode;
  /** The filter row's content: the quality ToggleGroup and Refresh, or the searching line. */
  filter?: ReactNode;
  /** A RowReleaseHeader. */
  header?: ReactNode;
  /** The Yours row, which stays put above the scroll area. */
  pinned?: ReactNode;
  /** Release rows, or skeleton rows while searching. */
  children?: ReactNode;
  /** Caps the scroll area at four rows. */
  searching?: boolean;
  /** Changing it remounts the rows so they fade in, the first four first. */
  arrivalKey?: number;
  /** Shown in place of the header, the pinned row and the rows. */
  empty?: ReactNode;
  className?: string;
};

/**
 * The releases inset under an episode row (or the movie's tracked version): white, no card, no padding. Notices, the
 * filter row, the header and the pinned row stay put; the rows scroll in a 340 px area with a 6 px bar in a 16 px gutter.
 */
function RowEpisodeReleases({ variant, notices, filter, header, pinned, children, searching = false, arrivalKey, empty, className }: RowEpisodeReleasesProps) {
  return (
    // --inset lets a row inside the scroll area reach back to the table's left edge for the cooldown bar. The closing line
    // lies over the inset's last pixel, so it replaces the last row's own line instead of doubling it.
    <div
      role="rowgroup"
      className={cn(
        'relative w-full bg-card after:absolute after:right-4 after:bottom-0 after:h-px after:bg-input',
        variant === 'episode' ? '[--inset:152px] after:left-38' : '[--inset:16px] after:left-4',
        className,
      )}
    >
      <div className={cn('flex flex-col', variant === 'episode' ? 'ml-38' : 'ml-4')}>
        {notices !== undefined && <div className="mr-4 flex flex-col">{notices}</div>}
        {filter !== undefined && <div className="mr-4 flex h-(--row) items-center gap-2 pr-0 pl-2.5">{filter}</div>}
        {empty !== undefined
          ? <div className="flex justify-center py-4 pr-4 pl-2.5">{empty}</div>
          : (
            <>
              {header !== undefined && <div className="mr-4">{header}</div>}
              {pinned !== undefined && <div className="mr-4">{pinned}</div>}
            </>
          )}
      </div>
      {empty === undefined && (
        // Starts at the table's edge with the inset as padding, so the cooldown bar at x 0 sits inside the scroll box
        // and is neither clipped nor a cause of sideways scrolling.
        <div
          className={cn(
            'overflow-y-auto [scrollbar-gutter:stable]',
            variant === 'episode' ? 'pl-38' : 'pl-4',
            '[&::-webkit-scrollbar]:w-4 [&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[5px] [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-input [&::-webkit-scrollbar-thumb]:bg-clip-padding',
            searching ? 'max-h-40' : 'max-h-[340px]',
            // The growth waits for the first four rows to fade in.
            'transition-[max-height] delay-(--duration-fast) duration-(--duration-size) ease-out motion-reduce:transition-none',
          )}
        >
          <div
            key={arrivalKey}
            className={cn(
              'flex flex-col',
              '[&>*]:animate-[content-in_var(--duration-fast)_var(--ease-out)_both] [&>*:nth-child(n+5)]:[animation-delay:var(--duration-fast)]',
              'motion-reduce:[&>*]:animate-none',
            )}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export { RowEpisodeReleases };
