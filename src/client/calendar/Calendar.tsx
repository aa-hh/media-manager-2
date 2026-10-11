import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { buildRows } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, type CalendarEntry, type Outcome } from '../library/api';
import { subjectProgress, type SubjectProgress } from '../library/progress';
import { navigate, replace, useLocation } from '../navigation';
import { groupByDay, entryWord, rangeLabel, shiftAnchor, stillMissing, windowFor, type CalendarGroup, type CalendarWindow, type View } from './model';

type Loaded = { entries: CalendarEntry[]; services: { sonarr: Outcome; radarr: Outcome } };
type LoadState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Loaded };

const views: Array<[View, string]> = [['week', 'Week'], ['month', 'Month'], ['forecast', 'Forecast']];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const noProgress = new Map<string, SubjectProgress>();

const serviceProblem = (name: 'Sonarr' | 'Radarr', outcome: Outcome) => {
  const missing = name === 'Sonarr' ? 'episodes are' : 'movies are';
  if (outcome.kind === 'not_configured') return `${name} isn't connected yet, so ${missing} missing.`;
  if (outcome.kind === 'rejected') return `${name} refused the API key, so ${missing} missing.`;
  if (outcome.kind === 'unreachable') return `${name} didn't answer, so ${missing} missing.`;
  return undefined;
};

const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDay = (value: string | null) => {
  const match = value === null ? null : /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
};
const sameDay = (a: Date, b: Date) => isoDay(a) === isoDay(b);
const shortMonth = (date: Date) => date.toLocaleDateString('en-GB', { month: 'short' });
const timeOf = (group: CalendarGroup) => (group.kind === 'episode'
  ? new Date(group.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : '');
const targetOf = (group: CalendarGroup) => {
  const entry = group.entries[0];
  return entry.kind === 'episode' ? `/series/${entry.seriesId}` : `/movie/${entry.id}`;
};

function GroupButton({ group, progress, now }: { group: CalendarGroup; progress: Map<string, SubjectProgress>; now: number }) {
  const word = entryWord(group, progress, now);
  const time = timeOf(group);
  return (
    <button
      type="button"
      onClick={() => navigate(targetOf(group))}
      className="flex w-full min-w-0 flex-col px-2 py-1 text-left hover:bg-[var(--mm-row-hover)] focus-visible:outline-1 focus-visible:outline-[var(--mm-ink)]"
    >
      <span className="truncate font-ui text-[13px] font-semibold">{group.title}</span>
      <span className="truncate font-data text-[12px] text-[var(--mm-ink-2)]">{[group.subtitle, time].filter((part) => part !== '').join(' · ')}</span>
      {word !== null && <span className={cn('truncate font-data text-[12px]', word === 'missing' ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]')}>{word}</span>}
    </button>
  );
}

function DayCell({ day, groups, today, dimmed, label, progress, now }: {
  day: Date;
  groups: CalendarGroup[];
  today: boolean;
  dimmed?: boolean;
  label: string;
  progress: Map<string, SubjectProgress>;
  now: number;
}) {
  return (
    <section
      aria-label={day.toDateString()}
      aria-current={today ? 'date' : undefined}
      className={cn('flex min-h-24 min-w-0 flex-col gap-1 border border-[var(--mm-seam)] p-1', today && 'border-[var(--mm-ink)]', dimmed && 'opacity-40')}
    >
      <h3 className={cn('px-1 font-data text-[12px]', today ? 'font-semibold text-[var(--mm-ink)]' : 'text-[var(--mm-ink-2)]')}>{label}{today ? ' · today' : ''}</h3>
      {groups.map((group) => <GroupButton key={group.key} group={group} progress={progress} now={now} />)}
    </section>
  );
}

function Days({ view, window, entries, progress, now, month }: {
  view: View;
  window: CalendarWindow;
  entries: CalendarEntry[];
  progress: Map<string, SubjectProgress>;
  now: number;
  month: number;
}) {
  const today = new Date(now);
  const perDay = groupByDay(entries, window.days);
  const missing = view === 'forecast'
    ? stillMissing(entries.filter((entry) => Date.parse(entry.at) < window.start.getTime()), progress, now)
    : [];
  const missingDays = Array.from({ length: 7 }, (_, index) => new Date(window.lookback.getFullYear(), window.lookback.getMonth(), window.lookback.getDate() + index));
  const missingGroups = groupByDay(missing, missingDays).flat();
  return (
    <>
      {view !== 'forecast' && (
        <div className="mt-4 hidden grid-cols-7 gap-1 font-data text-[12px] text-[var(--mm-ink-2)] lg:grid" aria-hidden="true">
          {weekdays.map((name) => <span key={name} className="px-1">{name}</span>)}
        </div>
      )}
      {view === 'forecast' && (
        <section aria-label="Aired, still missing" className="mt-4 border border-[var(--mm-seam)] p-2">
          <h3 className={cn('font-ui text-[14px] font-semibold', missing.length > 0 && 'text-[var(--mm-risk)]')}>{missing.length} aired, still missing</h3>
          {missingGroups.map((group) => <GroupButton key={group.key} group={group} progress={progress} now={now} />)}
        </section>
      )}
      <div className={cn('mt-2 grid gap-1', view === 'forecast' ? 'grid-cols-1' : view === 'week' ? 'grid-cols-1 lg:grid-cols-7' : 'grid-cols-7')}>
        {window.days.map((day, index) => {
          const boundary = day.getDate() === 1 || index === 0;
          const label = view === 'month'
            ? (boundary ? `${day.getDate()} ${shortMonth(day)}` : String(day.getDate()))
            : `${weekdays[(day.getDay() + 6) % 7]} ${day.getDate()} ${shortMonth(day)}`;
          return (
            <DayCell
              key={day.getTime()}
              day={day}
              groups={perDay[index]}
              today={sameDay(day, today)}
              dimmed={view === 'month' && day.getMonth() !== month}
              label={label}
              progress={progress}
              now={now}
            />
          );
        })}
      </div>
    </>
  );
}

const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

export function Calendar({ downloads, onUnauthenticated }: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const requested = params.get('view');
  const view: View = requested === 'month' || requested === 'forecast' ? requested : 'week';
  const at = params.get('at');
  const anchor = useMemo(() => parseDay(at) ?? new Date(), [at]);
  const window = useMemo(() => windowFor(view, anchor), [view, anchor]);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const from = (view === 'forecast' ? window.lookback : window.start).toISOString();
  const until = window.end.toISOString();
  const load = useCallback((signal?: AbortSignal) => {
    setState({ kind: 'loading' });
    getJson<Loaded>(`/api/library/calendar?start=${encodeURIComponent(from)}&end=${encodeURIComponent(until)}`, onUnauthenticated, signal)
      .then((data) => setState({ kind: 'ready', data }))
      .catch(() => { if (signal?.aborted !== true) setState({ kind: 'failed' }); });
  }, [from, until, onUnauthenticated]);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const go = useCallback((nextView: View, nextAnchor: Date | null) => {
    const query = new URLSearchParams({ view: nextView });
    if (nextAnchor !== null) query.set('at', isoDay(nextAnchor));
    replace(`/calendar?${query.toString()}`);
  }, []);
  const step = (delta: number) => go(view, shiftAnchor(view, anchor, delta));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (inField(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowLeft') go(view, shiftAnchor(view, anchor, -1));
      else if (event.key === 'ArrowRight') go(view, shiftAnchor(view, anchor, 1));
      else if (event.key === 't') go(view, null);
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, view, anchor]);

  const snapshot = downloads.kind === 'ready' ? downloads.snapshot : undefined;
  const progress = useMemo(
    () => (snapshot === undefined ? noProgress : subjectProgress(snapshot, buildRows(snapshot))),
    [snapshot],
  );
  const now = Date.now();
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const control = 'h-8 px-3 font-ui text-[14px] font-semibold hover:bg-[var(--mm-row-hover)]';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--mm-ground)] px-4 pb-16 pt-6 text-[var(--mm-ink)] sm:px-6">
      <h2 className="sr-only">Calendar</h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="tablist" aria-label="Calendar view" className="flex gap-1">
          {views.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => go(value, parseDay(at) === undefined ? null : anchor)}
              className={cn('h-8 px-3 font-ui text-[14px]', view === value ? 'bg-[var(--mm-ink)] font-semibold text-[var(--mm-on-cell)]' : 'text-[var(--mm-ink-2)] hover:bg-[var(--mm-row-hover)]')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} className={control}>‹</button>
          <button type="button" onClick={() => go(view, null)} className={control}>Today</button>
          <button type="button" aria-label="Next" onClick={() => step(1)} className={control}>›</button>
        </div>
        <span className="font-ui text-[16px] font-semibold">{rangeLabel(view, window)}</span>
        <span className="font-data text-[12px] text-[var(--mm-ink-2)]">times in {zone}</span>
      </div>
      {state.kind === 'loading' && <p className="mt-4 font-ui text-[14px] text-[var(--mm-ink-2)]">Loading…</p>}
      {state.kind === 'failed' && (
        <div className="mt-4 flex items-center gap-3">
          <p role="alert" className="font-ui text-[14px] text-[var(--mm-risk)]">The calendar could not be read.</p>
          <button type="button" onClick={() => load()} className="h-8 border border-[var(--mm-ink-3)] px-3 font-ui text-[14px] font-semibold hover:bg-[var(--mm-row-hover)]">Retry</button>
        </div>
      )}
      {state.kind === 'ready' && (
        <>
          {[serviceProblem('Sonarr', state.data.services.sonarr), serviceProblem('Radarr', state.data.services.radarr)]
            .filter((line) => line !== undefined)
            .map((line) => <p key={line} role="alert" className="mt-3 font-ui text-[14px] text-[var(--mm-risk)]">{line}</p>)}
          <Days view={view} window={window} entries={state.data.entries} progress={progress} now={now} month={anchor.getMonth()} />
        </>
      )}
    </div>
  );
}
