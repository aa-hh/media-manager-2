import { ArrowRight, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SkeletonPosterCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Arrival } from '../Arrival';
import { Card, openLink } from './Card';
import { visibleCards, type Row as RowData } from './model';

type RowProps = {
  heading: string;
  intro?: string;
  /** Sits between the heading and the arrows, such as the release window toggle. */
  control?: ReactNode;
  /** Undefined while loading. */
  row: RowData | undefined;
  seeAll?: { label: string; path: string };
  /** Numbers the cards, for Trending. */
  ranked?: boolean;
  /** Date tab and countdown instead of the rating. */
  upcoming?: boolean;
  onRetry: () => void;
};

const STEP = 242;
const SKELETONS = 8;

const readScroll = (key: string) => {
  try {
    return Number(window.sessionStorage.getItem(key) ?? 0);
  } catch { /* storage unavailable: start at the beginning */ }
  return 0;
};

const writeScroll = (key: string, left: number) => {
  try {
    window.sessionStorage.setItem(key, String(left));
  } catch { /* the position just won't be restored */ }
};

/** One Discover row: heading, arrows, and a strip that scrolls sideways to a See all card. */
export function Row({ heading, intro, control, row, seeAll, ranked = false, upcoming = false, onRetry }: RowProps) {
  const strip = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const restored = useRef(false);
  const left = useRef(0);
  const key = `mm2.discover.scroll.${heading}`;
  const loading = row === undefined || (row.pending && row.results.length === 0 && !row.failed);
  const results = row !== undefined && !loading && !row.failed ? row.results : undefined;

  const measure = useCallback(() => {
    const element = strip.current;
    if (element === null) return;
    left.current = element.scrollLeft;
    const start = element.scrollLeft <= 0;
    const end = element.scrollLeft >= element.scrollWidth - element.clientWidth - 1;
    // Runs on every scroll event; a fresh object each time would re-render the whole strip per frame.
    setEnds((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  useLayoutEffect(() => {
    const element = strip.current;
    if (results === undefined || element === null) return;
    if (!restored.current) {
      restored.current = true;
      element.scrollTo({ left: readScroll(key), behavior: 'instant' });
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [results, key, measure]);

  useEffect(() => () => {
    if (restored.current) writeScroll(key, left.current);
  }, [key]);

  const move = (direction: 1 | -1) => {
    const element = strip.current;
    if (element === null) return;
    element.scrollBy({ left: direction * visibleCards(element.clientWidth) * STEP });
  };

  const stripClass = cn(
    'flex gap-8 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    '-mx-(--page-margin) px-(--page-margin) scroll-px-(--page-margin)',
  );
  const minis = (results ?? []).filter((result) => result.posterUrl !== null).slice(0, 4);

  return (
    <section aria-label={heading} className="flex flex-col gap-5">
      <div className={cn('flex w-full flex-wrap', control === undefined ? 'items-end gap-2' : 'items-center gap-3')}>
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
          <h2 className="font-ui text-lg font-bold text-foreground [overflow-wrap:anywhere]">{heading}</h2>
          {intro !== undefined && <p className="font-ui text-[13px] text-muted-foreground">{intro}</p>}
        </div>
        {control}
        <Button variant="outline" iconOnly icon={<ChevronLeft />} aria-label={`Previous ${heading}`} className="size-8" disabled={results === undefined || ends.start} onClick={() => move(-1)} />
        <Button variant="outline" iconOnly icon={<ChevronRight />} aria-label={`Next ${heading}`} className="size-8" disabled={results === undefined || ends.end} onClick={() => move(1)} />
        {seeAll !== undefined && (
          <Button variant="ghost" nativeButton={false} render={<a href={seeAll.path} onClick={openLink(seeAll.path)} />} className="h-8 px-2 text-[13px]">
            Show more
          </Button>
        )}
      </div>
      {row?.failed === true ? (
        <div className="flex h-30 flex-col items-center justify-center gap-3 rounded-md bg-muted">
          <p className="font-ui text-sm font-semibold text-foreground">Couldn't load these titles</p>
          <Button variant="outline" icon={<RotateCw />} onClick={onRetry}>Try again</Button>
        </div>
      ) : results?.length === 0 ? (
        <div className="flex h-30 items-center justify-center rounded-md bg-muted">
          <p className="font-ui text-sm font-semibold text-foreground">No titles to show</p>
        </div>
      ) : (
        <Arrival
          ready={results !== undefined}
          skeleton={(
            <ul aria-label={`Loading ${heading}`} className={stripClass}>
              {Array.from({ length: SKELETONS }, (_, index) => (
                <li key={index} className="shrink-0">
                  <SkeletonPosterCard />
                </li>
              ))}
            </ul>
          )}
        >
          {results !== undefined && (
          <ul ref={strip} onScroll={measure} className={stripClass}>
            {results.map((result, index) => (
              <li key={`${result.type}:${result.tmdbId}`} className="shrink-0">
                <Card result={result} rank={ranked ? index + 1 : undefined} upcoming={upcoming} />
              </li>
            ))}
            {seeAll !== undefined && (
              <li className="shrink-0">
                <a
                  href={seeAll.path}
                  onClick={openLink(seeAll.path)}
                  className="flex h-78.75 w-52.5 flex-col items-center justify-center gap-3.5 rounded-lg bg-muted p-5 focus-ring"
                >
                  {minis.length > 0 && (
                    <span className="grid grid-cols-2 gap-1.5">
                      {minis.map((result) => (
                        <img
                          key={`${result.type}:${result.tmdbId}`}
                          src={result.posterUrl ?? undefined}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-24 w-16 rounded-md object-cover opacity-85"
                        />
                      ))}
                    </span>
                  )}
                  <span className="font-ui text-[15px] font-bold text-foreground">See all {seeAll.label.toLowerCase()}</span>
                  <ArrowRight aria-hidden="true" className="size-4.5 text-foreground" />
                </a>
              </li>
            )}
          </ul>
          )}
        </Arrival>
      )}
    </section>
  );
}
