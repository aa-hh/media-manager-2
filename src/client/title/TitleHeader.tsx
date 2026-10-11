import { Ellipsis, History as HistoryIcon, List, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Fact } from '@/components/ui/fact';
import { HeaderTitle } from '@/components/ui/header-title';
import { StatusInline } from '@/components/ui/status-inline';
import type { BookmarkState } from '@/components/ui/toggle-bookmark';
import { postJson, type MovieDetail, type SeriesDetail } from '../library/api';
import { navigate, useLocation } from '../navigation';
import { statusLabel } from '../Search';

export type Subject = { type: 'tv'; detail: SeriesDetail } | { type: 'movie'; detail: MovieDetail };
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

const externalLink = (label: string, href: string) => (
  <a key={label} href={href} target="_blank" rel="noreferrer" className="focus-ring rounded-xs underline underline-offset-2 hover:text-muted-foreground">{label}</a>
);

// What Sonarr or Radarr knows beyond the facts each page passes: shown under them, each only when the data has it.
const titleFacts = (subject: Subject): TitleFact[] => {
  const { detail } = subject;
  const tmdbKind = subject.type === 'tv' ? 'tv' : 'movie';
  const links = [
    detail.links.imdbId === null ? null : externalLink('IMDb', `https://www.imdb.com/title/${detail.links.imdbId}/`),
    subject.type === 'tv' && subject.detail.links.tvdbId !== null ? externalLink('TVDB', `https://www.thetvdb.com/?tab=series&id=${subject.detail.links.tvdbId}`) : null,
    detail.links.tmdbId === null ? null : externalLink('TMDB', `https://www.themoviedb.org/${tmdbKind}/${detail.links.tmdbId}`),
  ].filter((link) => link !== null);
  return [
    ...(subject.type === 'tv' && subject.detail.language !== null ? [{ label: 'Language', value: subject.detail.language }] : []),
    ...(subject.type === 'movie' && subject.detail.collection !== null ? [{ label: 'Collection', value: subject.detail.collection }] : []),
    ...(detail.path === null ? [] : [{ label: 'Folder', value: <span className="[overflow-wrap:anywhere]">{detail.path}</span> }]),
    ...(detail.tags.length === 0 ? [] : [{ label: 'Tags', value: detail.tags.join(', ') }]),
    ...(links.length === 0 ? [] : [{ label: 'Links', value: <span className="flex gap-3">{links}</span> }]),
  ];
};

type Sent = 'sending' | 'sent' | 'failed';

export function TitleHeader({ subject, owned, badges, facts, monitored, onToggleMonitored, monitorProblem, history, onPick, picking = false, compact = false, onChangeMonitoring, add, onUnauthenticated }: {
  subject: Subject;
  owned: boolean;
  /** Status Badges under the meta line. */
  badges?: ReactNode;
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
  /** The add controls for a title not yet in the library; they take the place of the actions. */
  add?: ReactNode;
  onUnauthenticated: () => void;
}) {
  const { detail } = subject;
  const service = subject.type === 'tv' ? 'Sonarr' : 'Radarr';
  const allFacts = [...(facts ?? []), ...titleFacts(subject)];
  const { state } = useLocation();
  const [search, setSearch] = useState<Sent | undefined>(undefined);
  const [refresh, setRefresh] = useState<Sent | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
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
      <DropdownMenuTrigger render={<Button variant="ghost" size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />} />
      <DropdownMenuContent>
        <DropdownMenuItem icon={<RefreshCw />} disabled={refresh === 'sending'} onClick={() => void send('/api/library/refresh', setRefresh)}>Refresh</DropdownMenuItem>
        {history !== undefined && (
          <DropdownMenuItem icon={<HistoryIcon />} onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Hide history' : 'History'}</DropdownMenuItem>
        )}
        {onChangeMonitoring !== undefined && <DropdownMenuItem icon={<SlidersHorizontal />} onClick={onChangeMonitoring}>Change monitoring</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <HeaderTitle
        className="-mx-(--page-margin) w-auto"
        compact={compact}
        title={detail.title}
        backdropUrl={detail.backdropUrl ?? undefined}
        posterUrl={detail.posterUrl ?? undefined}
        breadcrumb={<Breadcrumb links={[crumb]} current={detail.title} />}
        bookmark={owned && monitored !== undefined ? { state: monitored, onToggle: onToggleMonitored } : { state: 'none' }}
        status={monitorProblem !== undefined && <StatusInline status="failed">{monitorProblem}</StatusInline>}
        meta={metaLine(subject)}
        badges={badges}
        overview={detail.overview ?? undefined}
        primary={add ?? (owned && (
          <Button size="large" icon={<Search />} loading={search === 'sending'} onClick={() => void send('/api/library/search', setSearch)}>
            Search automatically
          </Button>
        ))}
        secondary={owned && onPick !== undefined && (
          <Button variant="outline" size="large" icon={picking ? <X /> : <List />} className={picking ? 'bg-selected' : undefined} onClick={onPick}>
            {picking ? 'Close Pick a release' : 'Pick a release'}
          </Button>
        )}
        more={owned && <>{menu}{status}</>}
        facts={allFacts.length > 0
          ? allFacts.map((fact) => <Fact key={fact.label} label={fact.label}>{fact.value}</Fact>)
          : undefined}
      />
      {/* Hand-off to AA-32 (Second versions and safe deletion): delete show/movie and delete version. */}
      {showHistory && history}
    </>
  );
}
