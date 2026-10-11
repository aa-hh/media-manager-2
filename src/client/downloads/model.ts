// Shapes served by /api/downloads and the event stream; the server's types in src/server are the source of truth.
export type Service = 'sonarr' | 'radarr';

export type Torrent = {
  hash: string;
  name: string;
  sizeBytes: number;
  completedBytes: number;
  downRate: number;
  upRate: number;
  started: boolean;
  active: boolean;
  complete: boolean;
  message: string;
  ratioThousandths: number;
  seedersConnected: number;
  trackerHost: string | null;
  goneAt: number | null;
};

export type QueueItem = {
  service: Service;
  queueId: number;
  downloadId: string | null;
  movieId: number | null;
  episodeId: number | null;
  title: string;
  label: string;
  status: string;
  trackedStatus: string;
  trackedState: string;
  statusMessages: { title: string; messages: string[] }[];
  errorMessage: string;
  indexer: string;
  quality: string;
  formats: string[];
  formatScore: number;
  estimatedCompletion: string | null;
};

export type Grab = {
  hash: string;
  service: Service;
  movieId: number | null;
  episodeIds: number[];
  releaseTitle: string;
  indexer: string;
  byHand: boolean;
};

export type Problem = {
  id: number;
  kind: string;
  subject: { type: string; service: Service | null; id: string };
  hash: string | null;
  state: 'handling' | 'needs_you' | 'resolved';
  summary: string;
  steps: { at: number; kind: string; text: string }[];
};

export type Snapshot = { torrents: Torrent[]; queue: QueueItem[]; grabs: Grab[]; problems: Problem[] };

export type Tone = 'normal' | 'risk';

export type Row = {
  key: string;
  label: string;
  release: string;
  quality: string;
  tracker: string;
  // null when the release is not in rTorrent yet.
  progress: number | null;
  timeLeft: string;
  status: { word: string; tone: Tone; detail: string };
  seeders: number | null;
  ratio: string;
  formats: string;
  score: string;
  problems: Problem[];
  // The queue item actions go through; null when Sonarr and Radarr are no longer tracking the download.
  queueItem: QueueItem | null;
  delayedUntil: number | null;
  byHand: boolean;
  // Set when Sonarr or Radarr stopped the import, so the owner can finish it by hand.
  importable: { service: Service; downloadId: string } | null;
  downRate: number;
  upRate: number;
  downloading: boolean;
};

export type Group = { key: 'needs_you' | 'handling' | 'rest'; title: string; rows: Row[] };

const units = ['B', 'KB', 'MB', 'GB', 'TB'];
export const formatBytes = (bytes: number) => {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};
export const formatSpeed = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)}/s`;

export const formatDuration = (milliseconds: number) => {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
};

const resolution = (quality: string) => /(\d{3,4}p)/i.exec(quality)?.[1] ?? quality;
const source = (quality: string) => quality.replace(/-?\d{3,4}p/i, '').replace(/^-|-$/g, '');
const serviceName = (service: Service) => (service === 'sonarr' ? 'Sonarr' : 'Radarr');

// Sonarr and Radarr name blocked imports in their status messages; the first line says why in their own words.
const queueReason = (item: QueueItem) => item.statusMessages.flatMap((message) => message.messages)[0] ?? item.errorMessage;

const labelFor = (items: QueueItem[], fallback: string) => {
  const labels = [...new Set(items.map((item) => item.label).filter((label) => label !== ''))];
  if (labels.length === 0) return fallback;
  if (labels.length === 1) return labels[0];
  return `${labels[0]} and ${labels.length - 1} more`;
};

const torrentStatus = (torrent: Torrent, items: QueueItem[], problems: Problem[]): Row['status'] => {
  if (problems.some((problem) => problem.kind === 'stalled')) return { word: 'stalled', tone: 'risk', detail: `${torrent.seedersConnected} seeders connected` };
  if (torrent.message !== '') return { word: 'error', tone: 'risk', detail: torrent.message };
  const blocked = items.find((item) => item.trackedState === 'importBlocked' || item.trackedState === 'failedPending'
    || (item.trackedStatus === 'warning' && torrent.complete));
  if (blocked !== undefined) return { word: 'import blocked', tone: 'risk', detail: queueReason(blocked) };
  if (items.some((item) => item.trackedState === 'importing')) return { word: 'importing', tone: 'normal', detail: 'into the library folder' };
  if (torrent.complete) {
    if (items.some((item) => item.trackedState === 'importPending')) return { word: 'waiting to import', tone: 'normal', detail: '' };
    return { word: 'seeding', tone: 'normal', detail: torrent.upRate > 0 ? `${formatSpeed(torrent.upRate)} up` : '' };
  }
  if (!torrent.started) return { word: 'paused', tone: 'normal', detail: '' };
  if (!torrent.active) return { word: 'queued', tone: 'normal', detail: "in rTorrent's queue" };
  if (torrent.downRate > 0) return { word: 'downloading', tone: 'normal', detail: formatSpeed(torrent.downRate) };
  return { word: 'waiting for peers', tone: torrent.seedersConnected === 0 ? 'risk' : 'normal', detail: `${torrent.seedersConnected} seeders connected` };
};

const describeQueue = (items: QueueItem[], grab: Grab | undefined) => {
  const first = items[0];
  return {
    quality: first === undefined ? '' : resolution(first.quality),
    release: [first === undefined ? '' : source(first.quality), first?.indexer ?? grab?.indexer ?? ''].filter((part) => part !== '').join(' · '),
    formats: first === undefined ? '' : first.formats.join(' · '),
    score: first === undefined || first.formatScore === 0 ? '' : `${first.formatScore > 0 ? '+' : ''}${first.formatScore}`,
  };
};

const problemKeysFor = (service: Service, items: QueueItem[], grab: Grab | undefined) => {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.movieId !== null) keys.add(`movie:${service}:${item.movieId}`);
    if (item.episodeId !== null) keys.add(`episode:${service}:${item.episodeId}`);
  }
  if (grab?.movieId != null) keys.add(`movie:${service}:${grab.movieId}`);
  for (const id of grab?.episodeIds ?? []) keys.add(`episode:${service}:${id}`);
  return keys;
};

// One row per download: a torrent in rTorrent with what Sonarr or Radarr know of it, or a queue entry rTorrent doesn't have yet.
// Each open problem joins the row it is about; problems about no download (a tracker, a dependency) get a row of their own.
export const buildRows = (snapshot: Snapshot): Row[] => {
  const grabs = new Map(snapshot.grabs.map((grab) => [grab.hash, grab]));
  const queueByHash = new Map<string, QueueItem[]>();
  const queueWithoutTorrent: QueueItem[][] = [];
  const torrentHashes = new Set(snapshot.torrents.filter((torrent) => torrent.goneAt === null).map((torrent) => torrent.hash));
  const looseByDownload = new Map<string, QueueItem[]>();
  for (const item of snapshot.queue) {
    if (item.downloadId !== null && torrentHashes.has(item.downloadId)) {
      queueByHash.set(item.downloadId, [...(queueByHash.get(item.downloadId) ?? []), item]);
    } else if (item.downloadId !== null) {
      const key = `${item.service}:${item.downloadId}`;
      looseByDownload.set(key, [...(looseByDownload.get(key) ?? []), item]);
    } else {
      queueWithoutTorrent.push([item]);
    }
  }
  queueWithoutTorrent.push(...looseByDownload.values());

  const unclaimed = new Set(snapshot.problems.filter((problem) => problem.state !== 'resolved'));
  const claim = (hash: string | null, keys: Set<string>) => {
    const found: Problem[] = [];
    for (const problem of unclaimed) {
      const subjectKey = `${problem.subject.type}:${problem.subject.service ?? ''}:${problem.subject.id}`;
      if ((hash !== null && (problem.hash === hash || (problem.subject.type === 'torrent' && problem.subject.id === hash))) || keys.has(subjectKey)) {
        found.push(problem);
        unclaimed.delete(problem);
      }
    }
    return found;
  };

  const rows: Row[] = [];
  for (const torrent of snapshot.torrents) {
    if (torrent.goneAt !== null) continue;
    const items = queueByHash.get(torrent.hash) ?? [];
    const grab = grabs.get(torrent.hash);
    const service = items[0]?.service ?? grab?.service;
    const described = describeQueue(items, grab);
    const remaining = torrent.sizeBytes - torrent.completedBytes;
    const problems = claim(torrent.hash, service === undefined ? new Set() : problemKeysFor(service, items, grab));
    const status = torrentStatus(torrent, items, problems);
    rows.push({
      key: `torrent:${torrent.hash}`,
      label: labelFor(items, torrent.name),
      release: described.release,
      quality: described.quality,
      tracker: torrent.trackerHost ?? '',
      progress: torrent.sizeBytes > 0 ? Math.floor((torrent.completedBytes / torrent.sizeBytes) * 100) : 0,
      timeLeft: torrent.complete ? '' : torrent.downRate > 0 ? formatDuration((remaining / torrent.downRate) * 1000) : '–',
      status,
      seeders: torrent.seedersConnected,
      ratio: (torrent.ratioThousandths / 1000).toFixed(2),
      formats: described.formats,
      score: described.score,
      problems,
      queueItem: items[0] ?? null,
      delayedUntil: null,
      byHand: grab?.byHand ?? false,
      importable: service !== undefined && (status.word === 'import blocked' || problems.some((problem) => problem.kind.startsWith('import_')))
        ? { service, downloadId: torrent.hash }
        : null,
      downRate: torrent.downRate,
      upRate: torrent.upRate,
      downloading: !torrent.complete && torrent.started,
    });
  }
  for (const items of queueWithoutTorrent) {
    const item = items[0];
    const grab = item.downloadId === null ? undefined : grabs.get(item.downloadId);
    const described = describeQueue(items, grab);
    const delayedUntil = item.status === 'delay' && item.estimatedCompletion !== null ? Date.parse(item.estimatedCompletion) : null;
    rows.push({
      key: `queue:${item.service}:${item.queueId}`,
      label: labelFor(items, item.title),
      release: described.release,
      quality: described.quality,
      tracker: '',
      progress: null,
      timeLeft: '',
      status: item.status === 'delay'
        ? { word: 'delayed', tone: 'normal', detail: '' }
        : item.trackedStatus === 'warning' || item.trackedStatus === 'error'
          ? { word: item.status === 'failed' ? 'failed' : 'warning', tone: 'risk', detail: queueReason(item) }
          : { word: item.status.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase(), tone: 'normal', detail: '' },
      seeders: null,
      ratio: '',
      formats: described.formats,
      score: described.score,
      problems: claim(item.downloadId, problemKeysFor(item.service, items, grab)),
      queueItem: item,
      delayedUntil: delayedUntil === null || Number.isNaN(delayedUntil) ? null : delayedUntil,
      byHand: grab?.byHand ?? false,
      importable: null,
      downRate: 0,
      upRate: 0,
      downloading: false,
    });
  }
  for (const problem of unclaimed) {
    rows.push({
      key: `problem:${problem.id}`,
      label: problem.subject.type === 'dependency' || problem.subject.type === 'tracker'
        ? problem.subject.id
        : `${problem.subject.service === null ? '' : `${serviceName(problem.subject.service)} `}${problem.subject.type} ${problem.subject.id}`,
      release: '',
      quality: '',
      tracker: problem.subject.type === 'tracker' ? problem.subject.id : '',
      progress: null,
      timeLeft: '',
      status: { word: problem.kind.replace(/_/g, ' '), tone: 'risk', detail: '' },
      seeders: null,
      ratio: '',
      formats: '',
      score: '',
      problems: [problem],
      queueItem: null,
      delayedUntil: null,
      byHand: false,
      importable: null,
      downRate: 0,
      upRate: 0,
      downloading: false,
    });
  }
  return rows;
};

export const groupRows = (rows: Row[]): Group[] => {
  const needsYou = rows.filter((row) => row.problems.some((problem) => problem.state === 'needs_you'));
  const handling = rows.filter((row) => !needsYou.includes(row) && row.problems.length > 0);
  const rest = rows.filter((row) => row.problems.length === 0);
  return [
    { key: 'needs_you' as const, title: 'NEEDS YOU', rows: needsYou },
    { key: 'handling' as const, title: 'BEING HANDLED BY MEDIA-MANAGER-2', rows: handling },
    { key: 'rest' as const, title: 'EVERYTHING ELSE', rows: rest },
  ].filter((group) => group.rows.length > 0);
};

// The latest fix attempt, or the problem itself when nothing has been tried yet.
export const latestStep = (problem: Problem) => problem.steps.at(-1)?.text ?? problem.summary;

export const applyEvent = (snapshot: Snapshot, type: string, data: unknown): Snapshot => {
  if (type === 'torrents') {
    const { changed, gone } = data as { changed: Torrent[]; gone: string[] };
    const byHash = new Map(snapshot.torrents.map((torrent) => [torrent.hash, torrent]));
    for (const torrent of changed) byHash.set(torrent.hash, torrent);
    for (const hash of gone) byHash.delete(hash);
    return { ...snapshot, torrents: [...byHash.values()] };
  }
  if (type === 'queue') {
    const { service, items } = data as { service: Service; items: QueueItem[] };
    return { ...snapshot, queue: [...snapshot.queue.filter((item) => item.service !== service), ...items] };
  }
  if (type === 'grab') {
    const grab = data as Grab;
    return { ...snapshot, grabs: [...snapshot.grabs.filter((existing) => existing.hash !== grab.hash), grab] };
  }
  if (type === 'problem') {
    const problem = data as Problem;
    const others = snapshot.problems.filter((existing) => existing.id !== problem.id);
    return { ...snapshot, problems: problem.state === 'resolved' ? others : [...others, problem] };
  }
  return snapshot;
};
