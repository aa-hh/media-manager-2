// Windows, same-day grouping and status words for the calendar. Pure: type-only imports.
import type { CalendarEntry } from '../library/api';
import type { SubjectProgress } from '../library/progress';

export type View = 'week' | 'month' | 'forecast';
export type CalendarWindow = { start: Date; end: Date; days: Date[]; lookback: Date };
type EpisodeEntry = Extract<CalendarEntry, { kind: 'episode' }>;
export type CalendarGroup = {
  key: string;
  service: 'sonarr' | 'radarr';
  kind: 'episode' | 'movie';
  title: string;
  subtitle: string;
  at: string;
  count: number;
  entries: CalendarEntry[];
};

const FORECAST_DAYS = 5;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Calendar-day arithmetic through the Date constructor, so daylight-saving changes never shift a day.
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const mondayOf = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const windowFor = (view: View, anchor: Date): CalendarWindow => {
  const day = midnight(anchor);
  let start = day;
  let end = addDays(day, FORECAST_DAYS);
  if (view === 'week') {
    start = mondayOf(day);
    end = addDays(start, 7);
  } else if (view === 'month') {
    start = mondayOf(new Date(day.getFullYear(), day.getMonth(), 1));
    end = addDays(mondayOf(new Date(day.getFullYear(), day.getMonth() + 1, 0)), 7);
  }
  const days: Date[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) days.push(cursor);
  return { start, end, days, lookback: addDays(start, -7) };
};

const dayAndMonth = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]}`;

// "5 – 11 October 2026" · "28 September – 4 October 2026" · "October 2026" · "Next 5 days · 8 – 12 October".
export const rangeLabel = (view: View, window: CalendarWindow) => {
  const first = window.days[0];
  const last = window.days[window.days.length - 1];
  if (view === 'month') {
    // The grid starts at most six days before the 1st, so its 15th cell always sits inside the month.
    const inside = window.days[14];
    return `${MONTHS[inside.getMonth()]} ${inside.getFullYear()}`;
  }
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();
  const range = sameMonth ? `${first.getDate()} – ${dayAndMonth(last)}` : `${dayAndMonth(first)} – ${dayAndMonth(last)}`;
  if (view === 'forecast') return `Next ${window.days.length} days · ${range}`;
  return `${range} ${last.getFullYear()}`;
};

export const shiftAnchor = (view: View, anchor: Date, delta: number) => {
  const day = midnight(anchor);
  if (view === 'month') return new Date(day.getFullYear(), day.getMonth() + delta, 1);
  return addDays(day, delta * (view === 'week' ? 7 : FORECAST_DAYS));
};

const pad = (value: number) => String(value).padStart(2, '0');
const episodeCode = (season: number, episode: number) => `S${pad(season)}E${pad(episode)}`;
const releaseWords = { cinema: 'in cinemas', digital: 'digital release', physical: 'physical release' } as const;

const episodeSubtitle = (episodes: EpisodeEntry[]) => {
  const sorted = [...episodes].sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  const first = sorted[0];
  if (sorted.length === 1) return `${episodeCode(first.seasonNumber, first.episodeNumber)}${first.title === null || first.title === '' ? '' : ` ${first.title}`}`;
  if (!sorted.every((episode) => episode.seasonNumber === first.seasonNumber)) {
    return sorted.map((episode) => episodeCode(episode.seasonNumber, episode.episodeNumber)).join(', ');
  }
  const numbers = sorted.map((episode) => episode.episodeNumber);
  const consecutive = numbers.every((number, index) => index === 0 || number === numbers[index - 1] + 1);
  const code = episodeCode(first.seasonNumber, numbers[0]);
  return consecutive ? `${code}–E${pad(numbers[numbers.length - 1])}` : `${code}, ${numbers.slice(1).map((number) => `E${pad(number)}`).join(', ')}`;
};

// One list of groups per day, in the order of `days`. One show's episodes on the same local day collapse into one group.
export const groupByDay = (entries: CalendarEntry[], days: Date[]): CalendarGroup[][] =>
  days.map((day) => {
    const key = dayKey(day);
    const today = entries
      .filter((entry) => dayKey(new Date(entry.at)) === key)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const groups: CalendarGroup[] = [];
    const shows = new Map<number, EpisodeEntry[]>();
    for (const entry of today) {
      if (entry.kind === 'movie') {
        groups.push({
          key: `movie:${entry.id}:${entry.release}:${key}`,
          service: 'radarr',
          kind: 'movie',
          title: entry.title,
          subtitle: releaseWords[entry.release],
          at: entry.at,
          count: 1,
          entries: [entry],
        });
        continue;
      }
      const existing = shows.get(entry.seriesId);
      if (existing !== undefined) {
        existing.push(entry);
        continue;
      }
      const episodes = [entry];
      shows.set(entry.seriesId, episodes);
      groups.push({ key: `series:${entry.seriesId}:${key}`, service: 'sonarr', kind: 'episode', title: entry.seriesTitle, subtitle: '', at: entry.at, count: 0, entries: episodes });
    }
    for (const group of groups) {
      group.count = group.entries.length;
      if (group.kind === 'episode') group.subtitle = episodeSubtitle(group.entries as EpisodeEntry[]);
    }
    return groups;
  });

const liveFor = (entry: CalendarEntry, progress: Map<string, SubjectProgress>) =>
  progress.get(entry.kind === 'episode' ? `episode:${entry.id}` : `movie:${entry.id}`);

// A movie counts as missing only once Radarr calls it available; a cinema date alone does not owe a file.
const isMissing = (entry: CalendarEntry, progress: Map<string, SubjectProgress>, now: number) =>
  Date.parse(entry.at) <= now
  && entry.monitored
  && !entry.hasFile
  && (entry.kind === 'episode' || entry.isAvailable)
  && liveFor(entry, progress) === undefined;

// Words only for exceptions: live progress wins, then missing; not-aired, downloaded and healthy entries print nothing.
export const entryWord = (group: CalendarGroup, progress: Map<string, SubjectProgress>, now: number): string | null => {
  for (const entry of group.entries) {
    const live = liveFor(entry, progress);
    if (live === undefined) continue;
    return live.percent === null ? live.word : `${live.word} ${Math.round(live.percent)}%`;
  }
  return group.entries.some((entry) => isMissing(entry, progress, now)) ? 'missing' : null;
};

// Entries that already aired, are monitored, have no file and nothing downloading.
export const stillMissing = (entries: CalendarEntry[], progress: Map<string, SubjectProgress>, now: number) =>
  entries.filter((entry) => isMissing(entry, progress, now));
