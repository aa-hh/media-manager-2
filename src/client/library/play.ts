// Starts playback in the desktop app from a library card. The player screen is a later track; it takes over here.
import { desktopBridge } from '../desktopBridge';
import { getJson, type ContinueWatchingItem, type LibraryTitle, type MovieWatch, type SeriesWatch } from './api';
import { episodeLoad, movieLoad, type StartFrom } from './watch';

// Each Play click takes the next number; a cancelled load only stops playback when no newer Play has started since.
let latestLoad = 0;

type SeriesReply = { episodes: Array<{ id: number; seasonNumber: number; episodeNumber: number }>; watch: SeriesWatch };

/**
 * Reads the title's Plex ids from its detail reply, has the desktop app load it, then shows the picture full size.
 * Resolves false when Plex has nothing to play or the signal aborted; a load that finishes after an abort is stopped,
 * unless a newer Play has started, since the bridge's stop acts on the whole player.
 */
export async function playInDesktop(
  title: LibraryTitle,
  item: ContinueWatchingItem | undefined,
  from: StartFrom,
  onUnauthenticated: () => void,
  signal: AbortSignal,
): Promise<boolean> {
  const bridge = desktopBridge();
  if (bridge === undefined) return false;
  const thisLoad = ++latestLoad;
  const request = title.tv === null
    ? movieLoad((await getJson<{ watch: MovieWatch }>(`/api/library/movie/${title.id}`, onUnauthenticated, signal)).watch, from)
    : episodeLoad(await getJson<SeriesReply>(`/api/library/series/${title.id}`, onUnauthenticated, signal), item?.episode ?? null, from);
  if (request === null || signal.aborted) return false;
  await bridge.load(request);
  if (signal.aborted) {
    if (thisLoad === latestLoad) await bridge.stop();
    return false;
  }
  await bridge.setLayout('full');
  return true;
}
