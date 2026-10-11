import type { GrabRecord, Grabs } from './grabs.js';
import { NOT_BETTER } from './imports.js';
import { type ArrServices, type QueueItem, valueOrThrow } from './services/arr.js';

type Arr = ArrServices[keyof ArrServices];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);
const positiveInteger = (value: unknown): value is number => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
);

const messagesOf = (statusMessages: QueueItem['statusMessages']) => statusMessages.flatMap((status) => (
  status.messages.length > 0 ? status.messages : [status.title]
));

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
  services: ArrServices,
  grabs: Grabs,
  options: { now?: () => number; onCompleted?: (record: GrabRecord) => Promise<void> } = {},
) => {
  const now = options.now ?? Date.now;
  const get = async (service: Arr, path: string) => {
    const response = await service.request(path);
    if (response.status < 200 || response.status > 299) throw new Error(`HTTP ${response.status}`);
    return response.body;
  };

  const historyOutcome = async (record: GrabRecord, downloadId: string): Promise<ReplaceStep> => {
    const records = valueOrThrow(record.service === 'sonarr'
      ? await services.sonarr.history({ downloadId })
      : await services.radarr.history({ downloadId }));
    const events = records.filter((event) => sameDownload(event.downloadId, downloadId));
    if (events.some((event) => event.eventType === 'downloadFolderImported')) return { kind: 'completed' };
    if (events.some((event) => event.eventType === 'downloadFailed')) return { kind: 'failed', reason: 'The download failed.' };
    if (events.some((event) => event.eventType === 'downloadIgnored')) return { kind: 'failed', reason: 'The download was ignored in Sonarr or Radarr.' };
    // History names the download before the queue shows it (the queue reads rTorrent on its
    // own schedule), so only a download missing from both for a while has really left.
    if (now() - record.updatedAt <= QUEUE_GRACE_MS) return { kind: 'waiting' };
    return { kind: 'failed', reason: 'The download left the queue without being imported.' };
  };

  // ManualImport builds the import with no rejections, so only files whose own refusal is
  // not being better than the file in place go in; a sample, a dangerous file or a wrong title stays out.
  const force = async (record: GrabRecord, service: Arr, downloadId: string): Promise<ReplaceStep> => {
    const listed = await get(service, `/api/v3/manualimport?downloadId=${encodeURIComponent(downloadId)}&filterExistingFiles=false`);
    if (!Array.isArray(listed)) throw new Error('manualimport did not return a list');
    const files = listed.filter(isRecord);
    const importable = files.filter((file) => rejectionsOf(file).every((reason) => NOT_BETTER.test(reason)));
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
    const result = await service.forceImport(downloadId, commandFiles);
    if (result.kind === 'refused') return { kind: 'failed', reason: result.message };
    valueOrThrow(result);
    return { kind: 'forced' };
  };

  const step = async (record: GrabRecord): Promise<ReplaceStep> => {
    if (record.downloadId === null) return { kind: 'waiting' };
    const service = services[record.service];
    const queue = valueOrThrow(await service.queue());
    const item = queue.find((entry) => entry.downloadId === record.downloadId!.toUpperCase());
    if (item === undefined) return historyOutcome(record, record.downloadId);
    const state = item.trackedState;
    if (state === 'failed' || state === 'failedPending' || item.trackedStatus === 'error') {
      return { kind: 'failed', reason: messagesOf(item.statusMessages).join(' ') || 'The download failed.' };
    }
    if (state !== 'importBlocked' && state !== 'importPending') return { kind: 'waiting' };
    if (item.trackedStatus !== 'warning') return { kind: 'waiting' };
    const messages = messagesOf(item.statusMessages);
    if (messages.length === 0) return { kind: 'waiting' };
    if (!messages.every((message) => NOT_BETTER.test(message))) {
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
          // Reconcile only re-applies protection already recorded, so the replace stays open until protecting it succeeds.
          try {
            await options.onCompleted?.(record);
          } catch {
            console.error('Protecting a completed replace failed; the next pass retries it.');
            continue;
          }
          grabs.update(record.id, { state: 'completed', failure: null });
        }
        else if (next.kind === 'failed') grabs.update(record.id, { state: 'failed', failure: next.reason });
      }
    },
  };
};
