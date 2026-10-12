// v2/Toggle/Bookmark — ~/Projects/media-manager-2-design/design-system.lib.pen QSZ23
import { Bookmark, BookmarkMinus } from 'lucide-react';
import { cn } from '@/lib/utils';

type BookmarkState = 'all' | 'none' | 'mixed';

const labels: Record<BookmarkState, string> = { all: 'Monitored', none: 'Not monitored', mixed: 'Partly monitored' };

// The glyph mounts again on each state change and scales 0.85 to 1; under reduced motion it fades instead.
const glyph = 'size-4 transition-[scale,opacity] duration-(--duration-fast) ease-out starting:scale-85 motion-reduce:starting:scale-100 motion-reduce:starting:opacity-0';

/** Monitored toggle on show, season and episode rows. Disabled when there is no onToggle. */
function ToggleBookmark({ state, onToggle, className }: { state: BookmarkState; onToggle?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={state === 'all' ? true : state === 'none' ? false : 'mixed'}
      aria-label={labels[state]}
      title={labels[state]}
      disabled={onToggle === undefined}
      onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-sm',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        'enabled:hover:bg-surface-hover enabled:active:bg-surface-pressed disabled:text-faint-foreground',
        state === 'all' && 'text-foreground',
        state === 'none' && 'text-subtle-foreground',
        state === 'mixed' && 'bg-muted text-foreground enabled:hover:bg-surface-pressed',
        className,
      )}
    >
      {state === 'mixed'
        ? <BookmarkMinus key={state} aria-hidden="true" className={glyph} />
        : <Bookmark key={state} aria-hidden="true" className={cn(glyph, state === 'all' && 'fill-current')} />}
    </button>
  );
}

export { ToggleBookmark };
export type { BookmarkState };
