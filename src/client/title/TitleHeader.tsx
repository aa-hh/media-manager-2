import { Ellipsis, ExternalLink, History as HistoryIcon, List, RefreshCw, Search, SlidersHorizontal, Star, Tag, Trash2, X } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { CardLibrary } from '@/components/ui/card-library';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FactStacked } from '@/components/ui/fact-stacked';
import { HeaderTitle } from '@/components/ui/header-title';
import { StatusInline } from '@/components/ui/status-inline';
import type { BookmarkState } from '@/components/ui/toggle-bookmark';
import { postJson, type Credits, type EpisodeDetail, type MovieDetail, type SeriesDetail } from '../library/api';
import { navigate, useLocation } from '../navigation';
import { statusLabel } from '../Search';
import { DeleteTitle } from './DeleteTitle';

// A movie already in the library carries its credits; a not-yet-added one has none.
export type Subject = { type: 'tv'; detail: SeriesDetail } | { type: 'movie'; detail: MovieDetail & { credits?: Credits } };
export type MonitoredState = BookmarkState;
export type TitleFact = { label: string; value: ReactNode };

// Sends one library write; true when Sonarr or Radarr accepted it.
export const sendAction = async (path: string, body: unknown, onUnauthenticated: () => void) => {
  try {
    const response = await postJson(path, body);
    if (response.status === 401) onUnauthenticated();
    return response.status === 204;
  } catch {
    return false;
  }
};

const runtimeText = (minutes: number | null) => {
  if (minutes === null || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} min` : `${hours} h ${minutes % 60} min`;
};

const metaLine = (subject: Subject) => {
  const { detail } = subject;
  const parts: string[] = [subject.type === 'tv' ? 'TV' : 'Movie'];
  if (subject.type === 'tv') parts.push(subject.detail.network ?? '');
  else parts.push(subject.detail.studio ?? '');
  parts.push(detail.year === null ? '' : String(detail.year), statusLabel(detail.status) ?? '', detail.certification ?? '');
  parts.push(detail.rating === null ? '' : `★ ${detail.rating.toFixed(1)}`);
  if (subject.type === 'tv') {
    const tv = subject.detail;
    const seasons = tv.statistics.seasonCount || tv.seasons.filter((season) => season.seasonNumber > 0).length;
    const episodes = tv.statistics.totalEpisodeCount;
    parts.push(seasons === 0 ? '' : `${seasons} ${seasons === 1 ? 'season' : 'seasons'}`);
    parts.push(episodes === 0 ? '' : `${episodes} episodes`);
  } else {
    parts.push(runtimeText(subject.detail.runtime));
  }
  parts.push(detail.genres.join(', '));
  return parts.filter((part) => part !== '').join(' · ');
};

export const episodeCode = (episode: Pick<EpisodeDetail, 'seasonNumber' | 'episodeNumber'>) => (
  `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')}`
);

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const airingFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const day = (iso: string | null | undefined) => {
  const time = iso === null || iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isNaN(time) ? null : dayFormat.format(time);
};

// External pages for the title, each only when the data has its id.
const titleLinks = (subject: Subject) => {
  const { detail } = subject;
  const tmdbKind = subject.type === 'tv' ? 'tv' : 'movie';
  return [
    detail.links.imdbId === null ? null : { label: 'IMDb', href: `https://www.imdb.com/title/${detail.links.imdbId}/` },
    subject.type === 'tv' && subject.detail.links.tvdbId !== null ? { label: 'TVDB', href: `https://www.thetvdb.com/?tab=series&id=${subject.detail.links.tvdbId}` } : null,
    detail.links.tmdbId === null ? null : { label: 'TMDB', href: `https://www.themoviedb.org/${tmdbKind}/${detail.links.tmdbId}` },
    subject.type === 'movie' && subject.detail.youTubeTrailerId !== null && subject.detail.youTubeTrailerId !== ''
      ? { label: 'Trailer', href: `https://www.youtube.com/watch?v=${encodeURIComponent(subject.detail.youTubeTrailerId)}` }
      : null,
  ].filter((link) => link !== null);
};

const movieRatingSites = [
  ['imdb', 'IMDb'], ['tmdb', 'TMDB'], ['trakt', 'Trakt'], ['rottenTomatoes', 'RT'], ['metacritic', 'Metacritic'],
] as const;

// TMDB scores out of 10 but shows as a percentage; Rotten Tomatoes and Metacritic already score out of 100.
const movieRatingValue = (site: (typeof movieRatingSites)[number][0], value: number) => {
  if (site === 'tmdb') return `${Math.round(value * 10)}%`;
  if (site === 'rottenTomatoes') return `${value}%`;
  if (site === 'metacritic') return String(value);
  return value.toFixed(1);
};

const votesText = (votes: number | null) => (votes === null || votes <= 0 ? undefined : `${votes.toLocaleString('en-GB')} votes`);

// A movie has one rating per site; a show has Sonarr's single rating, which the server does not attribute to a site.
const cardRatings = (subject: Subject) => {
  if (subject.type === 'tv') {
    const { rating, ratingVotes } = subject.detail;
    return rating === null ? [] : [{ source: 'Rating', icon: <Star />, value: rating.toFixed(1), votes: votesText(ratingVotes) }];
  }
  const { ratings } = subject.detail;
  return movieRatingSites.flatMap(([site, source]) => {
    const rating = ratings[site];
    return rating === null ? [] : [{ source, value: movieRatingValue(site, rating.value), votes: votesText(rating.votes) }];
  });
};

// The server sends the show's next and previous air time; when it has none, fall back to the earliest next and latest previous across the seasons.
const airing = (tv: SeriesDetail, which: 'nextAiring' | 'previousAiring') => {
  const times = tv.seasons
    .map((season) => season.statistics[which])
    .filter((time) => time !== null)
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const at = tv[which] ?? (which === 'nextAiring' ? times[0] : times[times.length - 1]);
  const time = at === undefined ? Number.NaN : Date.parse(at);
  if (Number.isNaN(time)) return null;
  const episode = tv.episodes.find((candidate) => candidate.airDate !== null && Date.parse(candidate.airDate) === time);
  const when = airingFormat.format(time);
  return episode === undefined ? when : `${episodeCode(episode)} · ${when}`;
};

type Cell = { label: string; value: string | null | undefined };

const tvFacts = (tv: SeriesDetail): Cell[][] => {
  const firstAired = tv.firstAired ?? tv.episodes
    .filter((episode) => episode.seasonNumber > 0 && episode.airDate !== null)
    .map((episode) => episode.airDate!)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0];
  const seasons = tv.statistics.seasonCount || tv.seasons.filter((season) => season.seasonNumber > 0).length;
  const episodes = tv.statistics.totalEpisodeCount;
  return [
    [{ label: 'Status', value: statusLabel(tv.status) }, { label: 'First aired', value: day(firstAired) }, { label: 'Last aired', value: day(tv.lastAired) }],
    [{ label: 'Network', value: tv.network }, { label: 'Air time', value: tv.airTime }, { label: 'Runtime', value: runtimeText(tv.runtime) }],
    [{ label: 'Certification', value: tv.certification }, { label: 'Original language', value: tv.language }, { label: 'Also known as', value: tv.alternateTitles.join(', ') }],
    [
      { label: 'Next episode', value: airing(tv, 'nextAiring') },
      { label: 'Previous episode', value: airing(tv, 'previousAiring') },
      { label: 'Seasons', value: seasons === 0 ? null : episodes === 0 ? String(seasons) : `${seasons} · ${episodes} episodes` },
    ],
  ];
};

const movieFacts = (movie: MovieDetail): Cell[][] => [
  [{ label: 'Status', value: statusLabel(movie.status) }, { label: 'In cinemas', value: day(movie.releaseDates.inCinemas) }, { label: 'Digital', value: day(movie.releaseDates.digital) }],
  [{ label: 'Studio', value: movie.studio }, { label: 'Runtime', value: runtimeText(movie.runtime) }, { label: 'Physical', value: day(movie.releaseDates.physical) }],
  [{ label: 'Certification', value: movie.certification }, { label: 'Original language', value: movie.originalLanguage }, { label: 'Collection', value: movie.collection }],
];

const credits = (movie: Extract<Subject, { type: 'movie' }>['detail'], job: string) => (
  movie.credits?.crew.filter((member) => member.job === job).map((member) => member.name).join(', ')
);

const crewFacts = (movie: Extract<Subject, { type: 'movie' }>['detail']): Cell[][] => [
  [{ label: 'Director', value: credits(movie, 'Director') }, { label: 'Screenplay', value: credits(movie, 'Screenplay') }, { label: 'Novel', value: credits(movie, 'Novel') }],
  [
    { label: 'Producers', value: credits(movie, 'Producer') },
    { label: 'Director of photography', value: credits(movie, 'Director of Photography') },
    { label: 'Music', value: credits(movie, 'Original Music Composer') },
  ],
];

// Rows of three; a row with no values is left out and a part-filled row keeps its values from the left.
function FactGrid({ rows, className }: { rows: Cell[][]; className: string }) {
  const filled = rows
    .map((row) => row.filter((cell) => cell.value !== null && cell.value !== undefined && cell.value !== ''))
    .filter((row) => row.length > 0);
  if (filled.length === 0) return null;
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {filled.map((row) => (
        <dl key={row[0].label} className="m-0 grid grid-cols-3 gap-6">
          {row.map((cell) => <FactStacked key={cell.label} label={cell.label} className="[overflow-wrap:anywhere]">{cell.value}</FactStacked>)}
        </dl>
      ))}
    </div>
  );
}

// Under the header of every title: the show or film itself on the left, the owner's copy (or the add choices still to make) in the card on the right.
function OverviewBand({ subject, owned, library }: { subject: Subject; owned: boolean; library: TitleFact[] }) {
  const { detail } = subject;
  const links = titleLinks(subject);
  const chips = [...detail.genres, ...(subject.type === 'movie' ? subject.detail.keywords : [])];
  return (
    <section aria-label="About" className="flex items-start gap-10 pt-6 pb-8">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h2 className="m-0 font-ui text-xl font-bold text-foreground">Overview</h2>
        {detail.overview !== null && detail.overview !== '' && <p className="m-0 text-body leading-normal break-words text-muted-foreground">{detail.overview}</p>}
        <FactGrid rows={subject.type === 'tv' ? tvFacts(subject.detail) : movieFacts(subject.detail)} className="pt-2" />
        {subject.type === 'movie' && <FactGrid rows={crewFacts(subject.detail)} className="pt-4" />}
        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            {links.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="focus-ring flex items-center gap-1 rounded-xs text-label text-foreground hover:underline">
                {link.label}
                <ExternalLink aria-hidden="true" className="size-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}
        {chips.length > 0 && (
          <ul aria-label="Genres and keywords" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {chips.map((chip, index) => <li key={`${index}-${chip}`}><Badge variant="outline" icon={<Tag />}>{chip}</Badge></li>)}
          </ul>
        )}
      </div>
      <CardLibrary title={owned ? undefined : 'Not in your library'} ratings={cardRatings(subject)} rows={library} tags={detail.tags} />
    </section>
  );
}

type Sent = 'sending' | 'sent' | 'failed';

export function TitleHeader({ subject, owned, badges, facts, monitored, onToggleMonitored, monitorProblem, history, onPick, picking = false, compact = false, onChangeMonitoring, add, addAction, onUnauthenticated }: {
  subject: Subject;
  owned: boolean;
  /** Status Badges under the meta line. */
  badges?: ReactNode;
  /** The library card's rows; Added and Folder follow when the title is in the library. */
  facts?: TitleFact[];
  monitored?: MonitoredState;
  onToggleMonitored?: () => void;
  monitorProblem?: string;
  /** Shown under the header when History is chosen from the menu. */
  history?: ReactNode;
  /** Pick a release: opens or closes the panel. */
  onPick?: () => void;
  picking?: boolean;
  compact?: boolean;
  onChangeMonitoring?: () => void;
  /** Content for a title not yet in the library (the season chips), drawn between the header and the overview band. */
  add?: ReactNode;
  /** The Add to library button for a title not yet in the library; drawn in the primary action slot. */
  addAction?: ReactNode;
  onUnauthenticated: () => void;
}) {
  const { detail } = subject;
  const service = subject.type === 'tv' ? 'Sonarr' : 'Radarr';
  const libraryRows: TitleFact[] = [
    ...(facts ?? []),
    ...(detail.added === null ? [] : [{ label: 'Added', value: day(detail.added) }]),
    ...(detail.path === null ? [] : [{ label: 'Folder', value: <span className="[overflow-wrap:anywhere]">{detail.path}</span> }]),
  ];
  const { state } = useLocation();
  const [search, setSearch] = useState<Sent | undefined>(undefined);
  const [refresh, setRefresh] = useState<Sent | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const target = subject.type === 'tv'
    ? { service: 'sonarr', kind: 'series', seriesId: detail.id }
    : { service: 'radarr', kind: 'movie', movieId: detail.id };

  const send = async (path: string, set: (value: Sent) => void) => {
    set('sending');
    set(await sendAction(path, target, onUnauthenticated) ? 'sent' : 'failed');
  };

  // Titles opened from search results carry the result as history state; going back keeps the search.
  const fromSearch = state !== null && state !== undefined;
  const crumb = fromSearch
    ? { label: 'Search', href: '/search', onClick: (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); window.history.back(); } }
    : { label: 'Library', href: '/', onClick: (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); navigate('/'); } };

  const status = (
    <>
      {search === 'sent' && <StatusInline status="sent">search sent</StatusInline>}
      {refresh === 'sent' && <StatusInline status="sent">refresh sent</StatusInline>}
      {(search === 'failed' || refresh === 'failed') && <StatusInline status="failed">{service} didn't answer.</StatusInline>}
    </>
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={compact ? 'ghost' : 'outline'} size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />} />
      <DropdownMenuContent>
        <DropdownMenuItem icon={<RefreshCw />} disabled={refresh === 'sending'} onClick={() => void send('/api/library/refresh', setRefresh)}>Refresh</DropdownMenuItem>
        {history !== undefined && (
          <DropdownMenuItem icon={<HistoryIcon />} onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Hide history' : 'History'}</DropdownMenuItem>
        )}
        {onChangeMonitoring !== undefined && <DropdownMenuItem icon={<SlidersHorizontal />} onClick={onChangeMonitoring}>Change monitoring</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Trash2 />} destructive onClick={() => setDeleting(true)}>{subject.type === 'tv' ? 'Delete show' : 'Delete movie'}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <HeaderTitle
        // Starts under the see-through app bar, so the backdrop runs up behind it.
        className="-mx-(--page-margin) -mt-(--topbar) w-auto pt-[calc(var(--topbar)+100px)]"
        compact={compact}
        actionsRight
        title={detail.title}
        backdropUrl={detail.backdropUrl ?? undefined}
        posterUrl={detail.posterUrl ?? undefined}
        breadcrumb={<Breadcrumb links={[crumb]} current={detail.title} />}
        bookmark={owned && monitored !== undefined ? { state: monitored, onToggle: onToggleMonitored } : { state: 'none' }}
        status={monitorProblem !== undefined && <StatusInline status="failed">{monitorProblem}</StatusInline>}
        meta={metaLine(subject)}
        badges={badges}
        primary={owned ? (
          <Button size="large" icon={<Search />} loading={search === 'sending'} onClick={() => void send('/api/library/search', setSearch)}>
            Search automatically
          </Button>
        ) : addAction}
        secondary={owned && onPick !== undefined && (
          <Button variant="outline" size="large" icon={picking ? <X /> : <List />} className={picking ? 'bg-selected' : undefined} onClick={onPick}>
            {picking ? 'Close Pick a release' : 'Pick a release'}
          </Button>
        )}
        more={owned && <>{menu}{status}</>}
      />
      {add !== undefined && !compact && <div className="pb-2">{add}</div>}

      {!compact && <OverviewBand subject={subject} owned={owned} library={libraryRows} />}
      {deleting && (
        <DeleteTitle
          target={subject.type === 'tv' ? { kind: 'series', id: detail.id } : { kind: 'movie', id: detail.id }}
          name={detail.title}
          codeOf={(episodeId) => {
            const episode = subject.type === 'tv' ? subject.detail.episodes.find((candidate) => candidate.id === episodeId) : undefined;
            return episode === undefined ? null : episodeCode(episode);
          }}
          onClose={() => setDeleting(false)}
          onUnauthenticated={onUnauthenticated}
        />
      )}
      {showHistory && history}
    </>
  );
}
