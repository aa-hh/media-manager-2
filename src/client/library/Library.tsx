import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildRows, formatBytes } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { navigate } from '../navigation';
import { Poster } from '../Search';
import { getJson, type LibraryTitle, type Outcome } from './api';
import { FIELDS, missingCount, movieWord, progressText, readFields, totals, writeFields, type Field } from './grid';
import { downloadingByShow, subjectProgress, type SubjectProgress } from './progress';

type Loaded = { titles: LibraryTitle[]; services: { sonarr: Outcome; radarr: Outcome } };
type LoadState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Loaded };
type Show = 'all' | 'tv' | 'movie';

const fieldLabels: Record<Field, string> = { year: 'Year', progress: 'Progress', size: 'Size', profile: 'Quality profile', added: 'Date added' };
const showLabels: Array<[Show, string]> = [['all', 'All titles'], ['tv', 'Shows'], ['movie', 'Movies']];
const noProgress = new Map<string, SubjectProgress>();

const serviceProblem = (name: 'Sonarr' | 'Radarr', outcome: Outcome) => {
  const missing = name === 'Sonarr' ? 'shows are' : 'movies are';
  if (outcome.kind === 'not_configured') return `${name} isn't connected yet, so ${missing} missing.`;
  if (outcome.kind === 'rejected') return `${name} refused the API key, so ${missing} missing.`;
  if (outcome.kind === 'unreachable') return `${name} didn't answer, so ${missing} missing.`;
  return undefined;
};

const addedOn = (added: string | null) => {
  const time = added === null ? Number.NaN : Date.parse(added);
  return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString();
};

function PosterCard({ title, fields, progress, downloading }: {
  title: LibraryTitle;
  fields: Field[];
  progress: Map<string, SubjectProgress>;
  downloading: number;
}) {
  const lines: Array<{ text: string; risk?: boolean }> = [];
  const word = title.tv === null ? movieWord(title, progress.get(`movie:${title.id}`)) : null;
  if (title.tv !== null) lines.push({ text: progressText(title.tv.episodeFileCount, downloading, title.tv.episodeCount) });
  else if (word !== null) lines.push({ text: word, risk: word === 'missing' || word === 'deleted' });
  if (!title.monitored) lines.push({ text: 'not monitored' });
  const facts = [
    fields.includes('year') && title.year !== null ? String(title.year) : '',
    fields.includes('size') ? formatBytes(title.sizeOnDisk) : '',
    fields.includes('profile') ? title.qualityProfile ?? '' : '',
    fields.includes('added') ? addedOn(title.added) : '',
  ].filter((fact) => fact !== '');
  return (
    <li>
      <a
        href={`/${title.tv === null ? 'movie' : 'series'}/${title.id}`}
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          navigate(`/${title.tv === null ? 'movie' : 'series'}/${title.id}`);
        }}
        className="group flex flex-col gap-2 focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--mm-ink)]"
      >
        <Poster url={title.posterUrl} className={cn('aspect-[2/3] w-full', !title.monitored && 'opacity-60')} />
        <div className="min-w-0">
          <p className="truncate font-ui text-[14px] font-semibold text-[var(--mm-ink)] group-hover:underline">{title.title}</p>
          {facts.length > 0 && <p className="truncate font-data text-[12px] text-[var(--mm-ink-2)]">{facts.join(' · ')}</p>}
          {lines.map((line) => (
            <p key={line.text} className={cn('truncate font-data text-[12px]', line.risk ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]')}>{line.text}</p>
          ))}
        </div>
      </a>
    </li>
  );
}

export function Library({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [show, setShow] = useState<Show>('all');
  const [fields, setFields] = useState<Field[]>(readFields);
  const [picking, setPicking] = useState(false);

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    getJson<Loaded>('/api/library/titles', onUnauthenticated)
      .then((data) => setState({ kind: 'ready', data }))
      .catch(() => setState({ kind: 'failed' }));
  }, [onUnauthenticated]);
  useEffect(load, [load]);

  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;
  const progress = useMemo(
    () => (snapshot === undefined ? noProgress : subjectProgress(snapshot, buildRows(snapshot))),
    [snapshot],
  );
  const perShow = useMemo(
    () => (snapshot === undefined ? new Map<number, number>() : downloadingByShow(snapshot, progress)),
    [snapshot, progress],
  );

  const toggleField = (field: Field) => {
    const next = FIELDS.filter((candidate) => (candidate === field ? !fields.includes(candidate) : fields.includes(candidate)));
    setFields(next);
    writeFields(next);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--mm-ground)] px-4 pb-16 pt-6 text-[var(--mm-ink)] sm:px-6">
      <h2 className="sr-only">Library</h2>
      {state.kind === 'loading' && <p className="font-ui text-[14px] text-[var(--mm-ink-2)]">Loading…</p>}
      {state.kind === 'failed' && (
        <div className="flex items-center gap-3">
          <p role="alert" className="font-ui text-[14px] text-[var(--mm-risk)]">The library could not be read.</p>
          <button type="button" onClick={load} className="h-8 border border-[var(--mm-ink-3)] px-3 font-ui text-[14px] font-semibold hover:bg-[var(--mm-row-hover)]">Retry</button>
        </div>
      )}
      {state.kind === 'ready' && (() => {
        const { titles, services } = state.data;
        const shown = titles.filter((title) => show === 'all' || title.type === show);
        const sum = totals(titles);
        const missing = missingCount(titles, progress, perShow);
        const problems = [serviceProblem('Sonarr', services.sonarr), serviceProblem('Radarr', services.radarr)].filter((line) => line !== undefined);
        return (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-ui text-[14px]">
              <span className="text-[var(--mm-ink-2)]">Sort · Date added, newest first</span>
              <div role="group" aria-label="Show" className="flex gap-1">
                {showLabels.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={show === value}
                    onClick={() => setShow(value)}
                    className={cn('h-8 px-3', show === value ? 'bg-[var(--mm-ink)] font-semibold text-[var(--mm-on-cell)]' : 'text-[var(--mm-ink-2)] hover:bg-[var(--mm-row-hover)]')}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)} className="h-8 border border-[var(--mm-ink-3)] px-3 font-semibold hover:bg-[var(--mm-row-hover)]">
                  Poster fields
                </button>
                {picking && (
                  <fieldset className="absolute left-0 top-9 z-10 flex min-w-44 flex-col gap-1 border border-[var(--mm-seam)] bg-[var(--mm-row)] p-3">
                    <legend className="sr-only">Poster fields</legend>
                    {FIELDS.map((field) => (
                      <label key={field} className="flex items-center gap-2">
                        <input type="checkbox" checked={fields.includes(field)} onChange={() => toggleField(field)} />
                        {fieldLabels[field]}
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>
              {missing > 0 && <span className="text-[var(--mm-risk)]">{missing} {missing === 1 ? 'title' : 'titles'} missing files</span>}
            </div>
            {problems.map((line) => <p key={line} role="alert" className="mt-3 font-ui text-[14px] text-[var(--mm-risk)]">{line}</p>)}
            {shown.length === 0
              ? <p className="mt-6 font-ui text-[14px] text-[var(--mm-ink-2)]">Nothing here yet.</p>
              : (
                <ul className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-6">
                  {shown.map((title) => (
                    <PosterCard key={`${title.service}:${title.id}`} title={title} fields={fields} progress={progress} downloading={perShow.get(title.id) ?? 0} />
                  ))}
                </ul>
              )}
            <p className="mt-10 border-t border-[var(--mm-seam)] pt-3 font-data text-[12px] text-[var(--mm-ink-2)]">
              {sum.shows} shows · {sum.movies} movies · {sum.episodes} episodes · {sum.files} files · {formatBytes(sum.sizeBytes)}
            </p>
          </>
        );
      })()}
    </div>
  );
}
