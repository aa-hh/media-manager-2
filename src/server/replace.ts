import type { GrabRecord, Grabs } from './grabs.js';
import type { createArr } from './services/arr.js';

type Arr = Pick<ReturnType<typeof createArr>, 'request' | 'configured'>;

// The only import refusal a replace may override. Sonarr says "...existing episode file(s)",
// Radarr "...existing movie file"; both begin the same way.
const NOT_AN_UPGRADE = /^not an upgrade for existing (episode|movie) file/i;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);

const messagesOf = (item: Record<string, unknown>) => (Array.isArray(item.statusMessages) ? item.statusMessages : []).flatMap((status) => {
  if (!isRecord(status)) return [];
  const messages = Array.isArray(status.messages) ? status.messages.filter((message): message is string => typeof message === 'string') : [];
  return messages.length > 0 ? messages : typeof status.title === 'string' ? [status.title] : [];
});

const rejectionsOf = (file: Record<string, unknown>) => (Array.isArray(file.rejections) ? file.rejections : []).flatMap((rejection) => {
  const reason = typeof rejection === 'string' ? rejection : isRecord(rejection) ? rejection.reason : undefined;
  return typeof reason === 'string' ? [reason] : [];
});

const sameDownload = (a: unknown, b: string) => typeof a === 'string' && a.toLowerCase() === b.toLowerCase();

export type ReplaceStep =
  | { kind: 'waiting' }
  | { kind: 'forced' }
  | { kind: 'completed' }
  | { kind: 'failed'; reason: string };

// A ManualImport normally finishes within seconds; one still blocked after this long did not run.
const IMPORT_GRACE_MS = 30 * 60_000;
// A sent grab normally shows in the queue within a couple of minutes.
const QUEUE_GRACE_MS = 15 * 60_000;

export const createReplaces = (
  services: { sonarr: Arr; radarr: Arr },
  grabs: Grabs,
  options: { now?: () => number; onCompleted?: (record: GrabRecord) => Promise<void> } = {},
) => {
  const now = options.now ?? Date.now;
  const get = async (service: Arr, path: string) => {
    const response = await service.request(path);
    if (response.status < 200 || response.status > 299) throw new Error(`HTTP ${response.status}`);
    return response.body;
  };

  const historyOutcome = async (record: GrabRecord, service: Arr, downloadId: string): Promise<ReplaceStep> => {
    const body = await get(service, `/api/v3/history?page=1&pageSize=50&downloadId=${encodeURIComponent(downloadId)}`);
    const records = isRecord(body) && Array.isArray(body.records) ? body.records : [];
    const events = records.filter((record): record is Record<string, unknown> => isRecord(record) && sameDownload(record.downloadId, downloadId));
    if (events.some((event) => event.eventType === 'downloadFolderImported')) return { kind: 'completed' };
    if (events.some((event) => event.eventType === 'downloadFailed')) return { kind: 'failed', reason: 'The download failed.' };
    if (events.some((event) => event.eventType === 'downloadIgnored')) return { kind: 'failed', reason: 'The download was ignored in Sonarr or Radarr.' };
    // History names the download before the queue shows it (the queue reads rTorrent on its
    // own schedule), so only a download missing from both for a while has really left.
    if (now() - record.updatedAt <= QUEUE_GRACE_MS) return { kind: 'waiting' };
    return { kind: 'failed', reason: 'The download left the queue without being imported.' };
  };

  // ManualImport builds the import with no rejections, so only files whose own refusal is
  // "Not an upgrade" go in; a sample, a dangerous file or a wrong title stays out.
  const force = async (record: GrabRecord, service: Arr, downloadId: string): Promise<ReplaceStep> => {
    const listed = await get(service, `/api/v3/manualimport?downloadId=${encodeURIComponent(downloadId)}&filterExistingFiles=false`);
    if (!Array.isArray(listed)) throw new Error('manualimport did not return a list');
    const files = listed.filter(isRecord);
    const importable = files.filter((file) => rejectionsOf(file).every((reason) => NOT_AN_UPGRADE.test(reason)));
    if (importable.length === 0) {
      const reasons = [...new Set(files.flatMap(rejectionsOf))];
      return { kind: 'failed', reason: reasons.length > 0 ? `Import blocked: ${reasons.join(' ')}` : 'The download has no file to import.' };
    }
    const target = record.target;
    const commandFiles = importable.map((file) => {
      const base = {
        path: file.path,
        folderName: file.folderName,
        quality: file.quality,
        languages: file.languages,
        releaseGroup: file.releaseGroup,
        indexerFlags: file.indexerFlags,
        downloadId,
      };
      if (target.kind === 'movie') return { ...base, movieId: target.movieId };
      const parsed = (Array.isArray(file.episodes) ? file.episodes : []).flatMap((episode) => (
        isRecord(episode) && positiveInteger(episode.id) ? [episode.id] : []
      ));
      const episodeIds = target.kind === 'episode' && parsed.length === 0 ? [target.episodeId]
        : target.kind === 'episodes' && parsed.length === 0 ? target.episodeIds
          : parsed;
      return { ...base, seriesId: target.seriesId, episodeIds, releaseType: file.releaseType };
    });
    if (commandFiles.some((file) => 'episodeIds' in file && file.episodeIds.length === 0)) {
      return { kind: 'failed', reason: 'Sonarr could not tell which episodes a file in this download is.' };
    }
    const response = await service.request('/api/v3/command', {
      method: 'POST',
      // "auto" hardlinks or copies while rTorrent still seeds; "move" would break seeding.
      body: { name: 'ManualImport', importMode: 'auto', files: commandFiles },
    });
    if (response.status < 200 || response.status > 299) throw new Error(`HTTP ${response.status}`);
    return { kind: 'forced' };
  };

  const step = async (record: GrabRecord): Promise<ReplaceStep> => {
    if (record.downloadId === null) return { kind: 'waiting' };
    const service = services[record.service];
    const queue = await get(service, '/api/v3/queue?page=1&pageSize=500&includeUnknownSeriesItems=true&includeUnknownMovieItems=true');
    const items = isRecord(queue) && Array.isArray(queue.records) ? queue.records : [];
    const item = items.find((entry): entry is Record<string, unknown> => isRecord(entry) && sameDownload(entry.downloadId, record.downloadId!));
    if (item === undefined) return historyOutcome(record, service, record.downloadId);
    const state = item.trackedDownloadState;
    if (state === 'failed' || state === 'failedPending' || item.trackedDownloadStatus === 'error') {
      return { kind: 'failed', reason: messagesOf(item).join(' ') || 'The download failed.' };
    }
    if (state !== 'importBlocked' && state !== 'importPending') return { kind: 'waiting' };
    if (item.trackedDownloadStatus !== 'warning') return { kind: 'waiting' };
    const messages = messagesOf(item);
    if (messages.length === 0) return { kind: 'waiting' };
    if (!messages.every((message) => NOT_AN_UPGRADE.test(message))) {
      return { kind: 'failed', reason: `Import blocked: ${[...new Set(messages)].join(' ')}` };
    }
    if (record.state === 'importing') {
      return now() - record.updatedAt > IMPORT_GRACE_MS
        ? { kind: 'failed', reason: "The forced import didn't finish; the download is still waiting in the queue." }
        : { kind: 'waiting' };
    }
    return force(record, service, record.downloadId);
  };

  return {
    step,
    // One pass over every replace still in flight; each record moves at most one step.
    async run() {
      for (const record of [...grabs.pending('replace'), ...grabs.importing()]) {
        let next: ReplaceStep;
        try {
          next = await step(record);
        } catch {
          continue;
        }
        if (next.kind === 'forced') grabs.update(record.id, { state: 'importing' });
        else if (next.kind === 'completed') {
          const completed = grabs.update(record.id, { state: 'completed', failure: null });
          try {
            await options.onCompleted?.(completed);
          } catch {
            // Protection is re-applied by its own reconcile job; the replace itself is done.
            console.error('Protecting a completed replace failed; the next reconcile retries it.');
          }
        }
        else if (next.kind === 'failed') grabs.update(record.id, { state: 'failed', failure: next.reason });
      }
    },
  };
};
