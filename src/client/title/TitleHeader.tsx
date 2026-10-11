import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes } from '../downloads/model';
import { postJson, type MovieDetail, type SeriesDetail } from '../library/api';
import { Poster, statusLabel } from '../Search';
import { cutoffLine } from './rows';

export type Subject = { type: 'tv'; detail: SeriesDetail } | { type: 'movie'; detail: MovieDetail };
export type MonitoredState = 'all' | 'none' | 'mixed';

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

export function ActionButton({ children, onClick, disabled, filled, label }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
      className={cn(
        'h-8 shrink-0 px-3 font-ui text-[14px] font-semibold disabled:opacity-50',
        'focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
        filled ? 'bg-[var(--mm-ink)] text-[var(--mm-on-cell)]' : 'border border-[var(--mm-ink-3)] text-[var(--mm-ink)] hover:bg-[var(--mm-row-hover)]',
      )}
    >
      {children}
    </button>
  );
}

const bookmarkLabels: Record<MonitoredState, string> = { all: 'Monitored', none: 'Not monitored', mixed: 'Partly monitored' };

export function Bookmark({ state, onToggle, className }: { state: MonitoredState; onToggle?: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={state === 'all' ? true : state === 'none' ? false : 'mixed'}
      aria-label={bookmarkLabels[state]}
      title={bookmarkLabels[state]}
      disabled={onToggle === undefined}
      onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center text-[var(--mm-ink-2)] hover:text-[var(--mm-ink)] disabled:hover:text-[var(--mm-ink-2)]',
        'focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-[var(--mm-ink)]',
        className,
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill={state === 'all' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M6 3h12v18l-6-4-6 4z" />
        {state === 'mixed' && <path d="M9 10h6" strokeLinecap="round" />}
      </svg>
    </button>
  );
}

const runtimeText = (minutes: number | null) => {
  if (minutes === null || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes % 60}m`;
};

const metaLine = (subject: Subject) => {
  const { detail } = subject;
  const parts: string[] = [detail.year === null ? '' : String(detail.year)];
  if (subject.type === 'tv') {
    const tv = subject.detail;
    const seasons = tv.statistics.seasonCount || tv.seasons.filter((season) => season.seasonNumber > 0).length;
    const episodes = tv.statistics.totalEpisodeCount;
    parts.push(tv.network ?? '', tv.language ?? '');
    parts.push(seasons === 0 ? '' : `${seasons} ${seasons === 1 ? 'season' : 'seasons'}${episodes > 0 ? `, ${episodes} episodes` : ''}`);
    parts.push(tv.statistics.sizeOnDisk > 0 ? `${formatBytes(tv.statistics.sizeOnDisk)} on disk` : '');
  } else {
    const movie = subject.detail;
    parts.push(movie.studio ?? '', runtimeText(movie.runtime));
    parts.push(movie.sizeOnDisk > 0 ? `${formatBytes(movie.sizeOnDisk)} on disk` : '');
  }
  parts.push(cutoffLine(detail.qualityProfile) ?? '');
  return parts.filter((part) => part !== '').join(' · ');
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-[var(--mm-ink-3)]">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

type Sent = 'sending' | 'sent' | 'failed';

export function TitleHeader({ subject, owned, statusWord, monitored, onToggleMonitored, monitorProblem, history, onUnauthenticated }: {
  subject: Subject;
  owned: boolean;
  statusWord?: string | null;
  monitored?: MonitoredState;
  onToggleMonitored?: () => void;
  monitorProblem?: string;
  history?: ReactNode;
  onUnauthenticated: () => void;
}) {
  const { detail } = subject;
  const service = subject.type === 'tv' ? 'Sonarr' : 'Radarr';
  const [search, setSearch] = useState<Sent | undefined>(undefined);
  const [refresh, setRefresh] = useState<Sent | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const target = subject.type === 'tv'
    ? { service: 'sonarr', kind: 'series', seriesId: detail.id }
    : { service: 'radarr', kind: 'movie', movieId: detail.id };
  const status = statusWord !== undefined ? statusWord : statusLabel(detail.status);
  const links = [
    detail.links.imdbId === null ? null : { label: 'IMDb', href: `https://www.imdb.com/title/${detail.links.imdbId}/` },
    subject.type === 'tv' && subject.detail.links.tvdbId !== null ? { label: 'TVDB', href: `https://thetvdb.com/?tab=series&id=${subject.detail.links.tvdbId}` } : null,
    detail.links.tmdbId === null ? null : { label: 'TMDB', href: `https://www.themoviedb.org/${subject.type === 'tv' ? 'tv' : 'movie'}/${detail.links.tmdbId}` },
  ].filter((link) => link !== null);

  const send = async (path: string, set: (value: Sent) => void) => {
    set('sending');
    set(await sendAction(path, target, onUnauthenticated) ? 'sent' : 'failed');
  };

  return (
    <section aria-label={detail.title} className="flex flex-col gap-6 sm:flex-row">
      <Poster url={detail.posterUrl} className="h-60 w-40" />
      <div className="min-w-0 max-w-3xl flex-1 font-ui text-[14px]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {owned && monitored !== undefined && <Bookmark state={monitored} onToggle={onToggleMonitored} />}
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">{detail.title}</h2>
          {status !== null && (
            <span className={cn('font-data text-[13px]', statusWord === 'missing' || statusWord === 'deleted' ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]')}>
              {status}
            </span>
          )}
          {detail.rating !== null && <span className="font-data text-[13px] text-[var(--mm-ink-2)]">★ {detail.rating.toFixed(1)}</span>}
        </div>
        {monitorProblem !== undefined && <p role="alert" className="mt-1 text-[var(--mm-risk)]">{monitorProblem}</p>}
        <p className="mt-2 font-data text-[13px] text-[var(--mm-ink-2)]">{metaLine(subject)}</p>
        {detail.overview !== null && <p className="mt-3 text-[var(--mm-ink-2)]">{detail.overview}</p>}
        <dl className="mt-4 flex flex-col gap-1 font-data text-[13px]">
          {detail.certification !== null && <Fact label="Certification">{detail.certification}</Fact>}
          {detail.genres.length > 0 && <Fact label="Genres">{detail.genres.join(', ')}</Fact>}
          {subject.type === 'movie' && subject.detail.collection !== null && <Fact label="Collection">{subject.detail.collection}</Fact>}
          {detail.path !== null && <Fact label="Path">{detail.path}</Fact>}
          {detail.tags.length > 0 && <Fact label="Tags">{detail.tags.join(', ')}</Fact>}
          {links.length > 0 && (
            <Fact label="Links">
              <span className="flex gap-3">
                {links.map((link) => (
                  <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--mm-ink)]">{link.label}</a>
                ))}
              </span>
            </Fact>
          )}
        </dl>
        {owned && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <ActionButton disabled={search === 'sending'} onClick={() => void send('/api/library/search', setSearch)}>Search automatically</ActionButton>
            <ActionButton disabled={refresh === 'sending'} onClick={() => void send('/api/library/refresh', setRefresh)}>Refresh</ActionButton>
            {history !== undefined && (
              <ActionButton onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Hide history' : 'History'}</ActionButton>
            )}
            {/* Hand-off to AA-32 (Second versions and safe deletion): delete show/movie and delete version. */}
            {search === 'sent' && <span role="status" className="text-[var(--mm-ink-2)]">search sent</span>}
            {refresh === 'sent' && <span role="status" className="text-[var(--mm-ink-2)]">refresh sent</span>}
            {(search === 'failed' || refresh === 'failed') && <span role="alert" className="text-[var(--mm-risk)]">{service} didn't answer.</span>}
          </div>
        )}
        {showHistory && history}
      </div>
    </section>
  );
}
