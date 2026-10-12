import { CalendarX } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { CalendarDayHeader, CalendarEntry as CalendarEntryTile, CalendarHeader, CalendarMonthCell, CalendarNowLine } from '@/components/ui/calendar';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { LabelGroup } from '@/components/ui/label-group';
import { SkeletonCalendarEntry } from '@/components/ui/skeleton';
import { StripStillMissing } from '@/components/ui/strip-still-missing';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { buildRows } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, type CalendarEntry, type Outcome } from '../library/api';
import { subjectProgress, type SubjectProgress } from '../library/progress';
import { navigate, replace, useLocation, useScreenReady } from '../navigation';
import { groupByDay, entryWord, rangeLabel, shiftAnchor, stillMissing, windowFor, type CalendarGroup, type CalendarWindow, type View } from './model';

type Loaded = { entries: CalendarEntry[]; services: { sonarr: Outcome; radarr: Outcome } };
type LoadState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Loaded };

const views: Array<[View, string]> = [['week', 'Week'], ['month', 'Month'], ['forecast', 'Forecast']];
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const noProgress = new Map<string, SubjectProgress>();
const noEntries: CalendarEntry[] = [];

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

const openTarget = (group: CalendarGroup) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(targetOf(group));
};
const liveOf = (group: CalendarGroup, progress: Map<string, SubjectProgress>) => group.entries
  .map((entry) => progress.get(entry.kind === 'episode' ? `episode:${entry.id}` : `movie:${entry.id}`))
  .find((live) => live !== undefined);
const dayLabel = (day: Date) => `${weekdays[(day.getDay() + 6) % 7]} ${day.getDate()} ${shortMonth(day)}`;

function Entry({ group, progress, now, meta, compact = false }: {
  group: CalendarGroup;
  progress: Map<string, SubjectProgress>;
  now: number;
  meta: string[];
  compact?: boolean;
}) {
  const word = entryWord(group, progress, now);
  return (
    <CalendarEntryTile
      href={targetOf(group)}
      onClick={openTarget(group)}
      state={word === 'missing' ? 'missing' : 'normal'}
      title={compact && group.kind === 'episode' ? `${group.title} ${group.subtitle}` : group.title}
      meta={[...meta, word ?? ''].filter((part) => part !== '').join(' · ')}
      progress={liveOf(group, progress)?.percent ?? undefined}
      compact={compact}
    />
  );
}

type GridProps = {
  window: CalendarWindow;
  entries: CalendarEntry[];
  perDay: CalendarGroup[][];
  progress: Map<string, SubjectProgress>;
  now: number;
  loading: boolean;
};

function WeekGrid({ window, perDay, progress, now, loading }: GridProps) {
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return (
    <div className="flex justify-between">
      {window.days.map((day, index) => {
        const isToday = sameDay(day, today);
        const groups = perDay[index];
        const before = isToday ? groups.filter((group) => Date.parse(group.at) <= now) : groups;
        const after = isToday ? groups.slice(before.length) : [];
        const entry = (group: CalendarGroup) => <Entry key={group.key} group={group} progress={progress} now={now} meta={[timeOf(group), group.subtitle]} />;
        return (
          <Fragment key={day.getTime()}>
            {index > 0 && <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-border" />}
            <section aria-label={day.toDateString()} aria-current={isToday ? 'date' : undefined} className="flex w-47 min-w-0 shrink flex-col gap-2">
              <CalendarDayHeader
                day={weekdays[index]}
                date={day.getDate()}
                today={isToday}
                tag={isToday ? 'today' : sameDay(day, tomorrow) ? 'tomorrow' : undefined}
              />
              {loading
                ? <><SkeletonCalendarEntry /><SkeletonCalendarEntry /></>
                : (
                  <>
                    {before.map(entry)}
                    {isToday && <CalendarNowLine time={today.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />}
                    {after.map(entry)}
                  </>
                )}
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}

// A month cell holds three tiles; past that, two tiles and the count of the rest.
const MONTH_TILES = 3;

function MonthGrid({ window, perDay, progress, now, loading, month, onOpenDay }: GridProps & { month: number; onOpenDay: (day: Date) => void }) {
  const today = new Date(now);
  const weeks = Array.from({ length: window.days.length / 7 }, (_, week) => window.days.slice(week * 7, week * 7 + 7));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2" aria-hidden="true">
        {weekdays.map((name) => <span key={name} className="flex h-5 min-w-0 flex-1 items-center px-1.5 text-caption tracking-wider text-subtle-foreground uppercase">{name}</span>)}
      </div>
      {weeks.map((days, week) => (
        <div key={days[0].getTime()} className="flex gap-2">
          {days.map((day, index) => {
            const groups = perDay[week * 7 + index];
            const shown = groups.length > MONTH_TILES ? groups.slice(0, MONTH_TILES - 1) : groups;
            const rest = groups.length - shown.length;
            return (
              <CalendarMonthCell
                key={day.getTime()}
                role="group"
                aria-label={day.toDateString()}
                date={day.getDate()}
                today={sameDay(day, today)}
                outside={day.getMonth() !== month}
                more={rest > 0 ? <button type="button" onClick={() => onOpenDay(day)} className="rounded-xs hover:underline focus-ring">+{rest} more</button> : undefined}
                className="h-32 min-w-0 flex-1"
              >
                {loading
                  ? <SkeletonCalendarEntry />
                  : shown.length > 0 ? shown.map((group) => <Entry key={group.key} group={group} progress={progress} now={now} meta={[]} compact />) : undefined}
              </CalendarMonthCell>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Forecast({ window, entries, perDay, progress, now, loading }: GridProps) {
  const today = new Date(now);
  const missing = stillMissing(entries.filter((entry) => Date.parse(entry.at) < window.start.getTime()), progress, now);
  const missingDays = Array.from({ length: 7 }, (_, index) => new Date(window.lookback.getFullYear(), window.lookback.getMonth(), window.lookback.getDate() + index));
  const missingGroups = groupByDay(missing, missingDays).flat();
  return (
    <div className="flex flex-col gap-1">
      {!loading && missingGroups.length > 0 && (
        <>
          <StripStillMissing lead="Aired, still missing" className="mt-6">
            {missingGroups.map((group) => `${group.title} ${group.subtitle}`).join(' · ')}
          </StripStillMissing>
          {missingGroups.map((group) => (
            <Entry key={group.key} group={group} progress={progress} now={now} meta={[group.subtitle, `aired ${dayLabel(new Date(group.at))}`]} />
          ))}
        </>
      )}
      {window.days.map((day, index) => {
        const groups = perDay[index];
        return (
          <section key={day.getTime()} aria-label={day.toDateString()} className="flex flex-col gap-1">
            <LabelGroup count={!loading && groups.length > 0 ? groups.length : undefined}>
              {dayLabel(day)}{sameDay(day, today) ? ' · today' : ''}
            </LabelGroup>
            {loading
              ? <><SkeletonCalendarEntry /><SkeletonCalendarEntry /></>
              : groups.length === 0
                ? <p className="text-label font-normal text-subtle-foreground">Nothing airs.</p>
                : groups.map((group) => <Entry key={group.key} group={group} progress={progress} now={now} meta={[timeOf(group), group.subtitle]} />)}
          </section>
        );
      })}
    </div>
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
  // With no ?at= the calendar follows the clock, so a tab left open past midnight moves to the new day.
  const [today, setToday] = useState(() => isoDay(new Date()));
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => setToday(isoDay(new Date())), midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, [today]);
  const anchor = useMemo(() => parseDay(at) ?? parseDay(today) ?? new Date(), [at, today]);
  const window = useMemo(() => windowFor(view, anchor), [view, anchor]);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const from = (view === 'forecast' ? window.lookback : window.start).toISOString();
  const until = window.end.toISOString();
  // Each load cancels the one before, so a Retry still in flight cannot land on a window the user has since left.
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(() => {
    requestRef.current?.abort();
    const { signal } = requestRef.current = new AbortController();
    setState({ kind: 'loading' });
    getJson<Loaded>(`/api/library/calendar?start=${encodeURIComponent(from)}&end=${encodeURIComponent(until)}`, onUnauthenticated, signal)
      .then((data) => { if (!signal.aborted) setState({ kind: 'ready', data }); })
      .catch(() => { if (!signal.aborted) setState({ kind: 'failed' }); });
  }, [from, until, onUnauthenticated]);
  useEffect(() => {
    load();
    return () => requestRef.current?.abort();
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
  const loading = state.kind === 'loading';
  const late = useScreenReady(!loading);
  // Stepping weeks or switching views crossfades; the screen's first draw is already part of the screen change.
  const shown = `${view}:${isoDay(window.start)}`;
  const [firstShown] = useState(shown);
  const entries = state.kind === 'ready' ? state.data.entries : noEntries;
  const perDay = useMemo(() => groupByDay(entries, window.days), [entries, window.days]);
  const missing = stillMissing(entries, progress, now).length;
  const grid = { window, entries, perDay, progress, now, loading };

  return (
    <div className={cn('flex flex-col pt-2 pb-6', view === 'week' ? 'gap-6' : view === 'month' && 'gap-4')}>
      <h2 className="sr-only">Calendar</h2>
      <CalendarHeader
        range={rangeLabel(view, window)}
        missing={missing > 0 ? `${missing} missing` : undefined}
        onPrevious={() => step(-1)}
        onToday={() => go(view, null)}
        onNext={() => step(1)}
        previousLabel="Previous"
        nextLabel="Next"
        timeZone={`Times in ${zone}`}
        view={(
          <ToggleGroup aria-label="Calendar view" value={view} onValueChange={(value) => go(value as View, parseDay(at) === undefined ? null : anchor)}>
            {views.map(([value, label]) => <ToggleGroupItem key={value} value={value}>{label}</ToggleGroupItem>)}
          </ToggleGroup>
        )}
      />
      {state.kind === 'failed'
        ? <Callout title="The calendar could not be read." action={<Button variant="outline" onClick={() => load()}>Retry</Button>} className="max-w-130" />
        : (
          <div
            key={`${view}:${isoDay(window.start)}:${state.kind}`}
            className={cn('flex flex-col', (shown !== firstShown || late) && 'transition-opacity duration-(--duration-base) ease-out starting:opacity-0', view === 'week' ? 'gap-6' : view === 'month' && 'gap-4')}
          >
            {state.kind === 'ready' && [serviceProblem('Sonarr', state.data.services.sonarr), serviceProblem('Radarr', state.data.services.radarr)]
              .filter((line) => line !== undefined)
              .map((line) => <Callout key={line} look="warning" title={line} className="max-w-130" />)}
            {view !== 'forecast' && state.kind === 'ready' && entries.length === 0 && (
              <EmptyState icon={<CalendarX aria-hidden="true" />} title={view === 'week' ? 'Nothing airs this week.' : 'Nothing airs this month.'} />
            )}
            {view === 'week' && <WeekGrid {...grid} />}
            {view === 'month' && <MonthGrid {...grid} month={anchor.getMonth()} onOpenDay={(day) => go('week', day)} />}
            {view === 'forecast' && <Forecast {...grid} />}
          </div>
        )}
    </div>
  );
}
