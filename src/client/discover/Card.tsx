import { Calendar, CalendarClock, Check, Star } from 'lucide-react';
import { memo, type MouseEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { LibraryPosterCard } from '@/components/ui/library-poster-card';
import { navigateFrom } from '../navigation';
import { countdown, dateTab, titlePath, type DiscoverResult } from './model';

export const openLink = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigateFrom(path, event.currentTarget);
};

const prefetched = new Set<string>();
const prefetch = (url: string | null) => {
  if (url === null || prefetched.has(url)) return;
  prefetched.add(url);
  new Image().src = url;
};

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const ratingFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type CardProps = { result: DiscoverResult; rank?: number; upcoming?: boolean };

/** A Discover title as a poster card that opens its title page. */
export const Card = memo(function Card({ result, rank, upcoming = false }: CardProps) {
  const path = titlePath(result);
  const when = upcoming ? countdown(result.date, localToday()) : undefined;
  return (
    <LibraryPosterCard
      href={path}
      onClick={openLink(path)}
      // Pointing at a card starts its backdrop downloading, so the title page has it by the time it opens.
      onPointerEnter={() => prefetch(result.backdropUrl)}
      onFocus={() => prefetch(result.backdropUrl)}
      poster={result.posterUrl ?? undefined}
      title={result.title}
      rank={rank}
      kind={result.type}
      year={result.year}
      genres={result.genres.length > 0 ? result.genres.join(', ') : undefined}
      overview={result.overview ?? undefined}
      dateTab={upcoming && result.date !== null ? dateTab(result.date) : undefined}
      badges={(
        <>
          {!upcoming && result.rating !== null && (
            <Badge icon={<Star aria-hidden="true" />} className="font-data text-[13px] text-foreground">{result.rating.toFixed(1)}</Badge>
          )}
          {result.libraryId !== null && <Badge variant="strong" icon={<Check aria-hidden="true" />}>In library</Badge>}
          {when !== undefined && (
            <Badge icon={when === 'No date yet' ? <Calendar aria-hidden="true" /> : <CalendarClock aria-hidden="true" />} className="text-foreground">{when}</Badge>
          )}
        </>
      )}
    />
  );
});
