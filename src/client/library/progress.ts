// Live progress for episodes and movies, derived from the Downloads snapshot so title pages and the calendar
// say exactly what the Downloads screen says. Pure: no runtime imports.
import type { Grab, Row, Snapshot, Tone } from '../downloads/model';

export type SubjectProgress = { word: string; tone: Tone; percent: number | null; downRate: number };

export const subjectProgress = (snapshot: Snapshot, rows: Row[]): Map<string, SubjectProgress> => {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const result = new Map<string, SubjectProgress>();
  const set = (key: string, row: Row) => result.set(key, { word: row.status.word, tone: row.status.tone, percent: row.progress, downRate: row.downRate });

  for (const item of snapshot.queue) {
    const row = (item.downloadId === null ? undefined : byKey.get(`torrent:${item.downloadId}`))
      ?? byKey.get(`queue:${item.service}:${item.queueId}`)
      ?? rows.find((candidate) => item.downloadId !== null && candidate.queueItem?.service === item.service && candidate.queueItem.downloadId === item.downloadId);
    if (row === undefined) continue;
    if (item.episodeId !== null) set(`episode:${item.episodeId}`, row);
    if (item.movieId !== null) set(`movie:${item.movieId}`, row);
  }
  for (const grab of snapshot.grabs) {
    if (grab.importedAt !== null || grab.failedAt !== null) continue;
    const row = byKey.get(`torrent:${grab.hash}`);
    if (row === undefined) continue;
    for (const id of grab.episodeIds) set(`episode:${id}`, row);
    if (grab.movieId !== null) set(`movie:${grab.movieId}`, row);
  }
  return result;
};

export const downloadingEpisodes = (progress: Map<string, SubjectProgress>, episodeIds: number[]) =>
  episodeIds.filter((id) => progress.get(`episode:${id}`)?.percent != null).length;

// Episodes downloading right now, counted per show through the series id the queue and grabs carry.
export const downloadingByShow = (snapshot: Snapshot, progress: Map<string, SubjectProgress>) => {
  const episodes = new Map<number, Set<number>>();
  const add = (seriesId: number | null, episodeId: number | null) => {
    if (seriesId === null || episodeId === null || progress.get(`episode:${episodeId}`)?.percent == null) return;
    episodes.set(seriesId, (episodes.get(seriesId) ?? new Set()).add(episodeId));
  };
  for (const item of snapshot.queue) add(item.seriesId, item.episodeId);
  for (const grab of snapshot.grabs) for (const id of grab.episodeIds) add(grab.seriesId, id);
  return new Map([...episodes].map(([seriesId, ids]) => [seriesId, ids.size]));
};

export type SeedingFact = { trackerHost: string; seedingSeconds: number; ratio: number; complete: boolean };

const concerns = (grab: Grab, subject: { episodeId: number } | { movieId: number }) =>
  'episodeId' in subject ? grab.episodeIds.includes(subject.episodeId) : grab.movieId === subject.movieId;

export const seedingFacts = (snapshot: Snapshot, subject: { episodeId: number } | { movieId: number }): SeedingFact[] => {
  const facts: SeedingFact[] = [];
  for (const grab of snapshot.grabs) {
    if (grab.importedAt === null || !concerns(grab, subject)) continue;
    const torrent = snapshot.torrents.find((candidate) => candidate.hash === grab.hash && candidate.goneAt === null);
    if (torrent === undefined) continue;
    facts.push({ trackerHost: torrent.trackerHost ?? '', seedingSeconds: torrent.seedingSeconds, ratio: torrent.ratioThousandths / 1000, complete: torrent.complete });
  }
  return facts;
};
