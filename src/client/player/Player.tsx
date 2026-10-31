// The in-app player: state above Home (PlayerProvider in SignedIn) and one element drawn by Home outside its keyed screen
// (Player), so navigation never unmounts it. /play/<ratingKey> shows it full size (the key is empty while the opening screen works out
// what to play), any other address as the mini player.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { PlayerMenu, PlayerQueueItem } from '@/components/ui/player-stage';
import type { UpNextStep } from '@/components/ui/player-up-next';
import { desktopBridge, type LoadRequest } from '../desktopBridge';
import { buildRows, formatSpeed } from '../downloads/model';
import type { DownloadsState } from '../downloads/useDownloads';
import { getJson, postJson, type ContinueWatchingItem, type EpisodeDetail, type LibraryTitle, type LibraryWatch, type SeriesWatch } from '../library/api';
import { loadRequestFor } from '../library/play';
import { subjectProgress } from '../library/progress';
import { clockText, continueMeta, minutesText } from '../library/watch';
import { navigate, replace, replaceScreen, useLocation } from '../navigation';
import {
  BACK_SECONDS, FORWARD_SECONDS, LOAD_AHEAD, OPENING_REQUEST, TIMELINE_EVERY_MS, openOutcome, retryRequest, retryStep,
  activeMarker, applyEvent, clampSeek, isPlayAddress, clampVolume, formatLine, originalLabel, hasSoundCommands, hasSubtitleScale, subtitleScaleOf, volumeKey, wheelStep, loadAheadChoice, nextEpisode, openingAt, playedBetween, qualityLabel, queueNeighbours, reloadAt,
  reportNow, reportsPeriodically, screenFor, streamKey, timelineQuery, timelineState, triedText, upNextChoice,
  type AudioTrack, type BridgeEvent, type Playback, type QueueItem, type StartReply, type SubtitleTrack, type TimelineState,
} from './model';
import { setPlayerHandler, type Loaded, type OpenRequest, type PlayerSeries, type PlayerTitle } from './open';
import { PlayerScreen, type UpNextView } from './PlayerScreen';
import './player.css';

// --- Who this player is to Plex

// Every call to Plex uses the desktop app's own player ids from the start reply, so Plex sees one player (network §1).
// A reply without them (a desktop build older than the page) falls back to ids made for this page load.
const fallbackIds = {
  clientId: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/\+/g, '-').replace(/\//g, '_'),
  sessionIdentifier: crypto.randomUUID(),
};
const idsOf = (reply: StartReply | null) => ({
  clientId: reply?.clientId ?? fallbackIds.clientId,
  sessionIdentifier: reply?.sessionIdentifier ?? fallbackIds.sessionIdentifier,
});

// --- State

type SeriesReply = PlayerSeries;
type NextItem = { request: LoadRequest; title: PlayerTitle; view: Omit<UpNextView, 'countdown' | 'steps' | 'onPlayNow'> };
type UpNext =
  | { kind: 'choosing' }
  | { kind: 'countdown'; item: NextItem; endsAt: number }
  | { kind: 'waiting'; item: NextItem; episodeId: number; hasFile: boolean };

type Session = {
  /** Changes with every load, so a reply or failure from an older one is dropped. */
  load: number;
  request: LoadRequest;
  title: PlayerTitle;
  reply: StartReply | null;
  playback: Playback;
  openedAt: number;
  saved: { audio: boolean; subtitles: boolean; delay: boolean };
  subtitleDelay: number;
  upNext: UpNext | null;
};

type Controller = {
  close: (to?: string) => void;
  playPause: () => void;
  seek: (seconds: number) => void;
  seekBy: (seconds: number) => void;
  setFullscreen: (on: boolean) => void;
  toggleMute: () => void;
  changeVolume: (by: number) => void;
  setVolume: (percent: number) => void;
  chooseAudio: (track: AudioTrack) => void;
  chooseSubtitle: (track: SubtitleTrack | null) => void;
  changeSubtitleDelay: (change: number | 'reset') => void;
  chooseSubtitleScale: (scale: number) => void;
  chooseQuality: (kbps: number | undefined) => void;
  readLoadAhead: () => void;
  chooseLoadAhead: (value: string) => void;
  clearSaved: () => void;
  skipMarker: (kind: 'intro' | 'credits', endSeconds: number) => void;
  playItem: (item: NextItem) => void;
  playQueueItem: (item: QueueItem) => void;
  retry: () => void;
  reportNow: () => void;
};

type PlayerContextValue = {
  session: Session | null;
  series: SeriesReply | null;
  plexDownSince: number | null;
  nextReportAt: number;
  qualityKbps: number | undefined;
  loadAheadBytes: number;
  fullscreen: boolean;
  /** mpv's volume and mute; null when the desktop app has no volume commands (a build older than the page). */
  sound: Sound | null;
  /** The subtitle text size (mpv's sub-scale); null when the desktop app cannot set it. */
  subtitleScale: number | null;
  downloads: DownloadsState;
  returnFocus: RefObject<HTMLElement | null>;
  controller: Controller;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

const okWatch = (watch: SeriesWatch) => (watch !== null && watch.kind === 'ok' ? watch : null);
const episodeCode = (season: number | null, episode: number | null) => (season === null || episode === null ? null : `S${season} E${episode}`);
// mpv sends no event when a load applies saved values it already had, so each start reply carries them; a desktop build
// older than the page sends neither, and the page keeps what it had.
type Sound = { volume: number; muted: boolean };
const soundOf = (reply: StartReply, was: Sound) => ({ volume: reply.volume ?? was.volume, muted: reply.muted ?? was.muted });
/** The subtitle delay in seconds that Plex saved for a track; 0 for Off or a track with none. */
const savedDelay = (track: SubtitleTrack | null | undefined) => (track?.offsetMs ?? 0) / 1000;

const startFailure = (error: unknown, name: string) => {
  const text = error instanceof Error ? error.message : '';
  if (text.includes('plex_refused')) return `Plex refused to play ${name} in every way it was asked.`;
  if (text.includes('not_found')) return `Plex no longer has this file of ${name}. It may have been replaced.`;
  if (text.includes('plex_unreachable') || text.includes('plex_tv_unavailable')) return 'None of the addresses Plex gave for the server answered from this computer.';
  return `Plex didn't answer when asked to play ${name}.`;
};

/** Holds the player for the signed-in app; inside the desktop app it takes every Play (src/client/player/open.ts). */
export function PlayerProvider({ downloads, onUnauthenticated, children }: { downloads: DownloadsState; onUnauthenticated: () => void; children: ReactNode }) {
  const bridge = desktopBridge();
  const { pathname } = useLocation({ includePlay: true });
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [series, setSeries] = useState<SeriesReply | null>(null);
  const [plexDownSince, setPlexDownSince] = useState<number | null>(null);
  const [nextReportAt, setNextReportAt] = useState(0);
  const [qualityKbps, setQualityKbps] = useState<number | undefined>(undefined);
  const qualityRef = useRef<number | undefined>(undefined);
  const [loadAheadBytes, setLoadAheadBytes] = useState(LOAD_AHEAD[2].bytes);
  const [fullscreen, setFullscreenState] = useState(false);
  // mpv's sound, from the start reply and mpv's events. The ref is what handlers read between renders; the state draws the slider.
  const [sound, setSoundState] = useState<Sound>({ volume: 100, muted: false });
  const soundRef = useRef(sound);
  const setSound = useCallback((next: Sound) => {
    soundRef.current = next;
    setSoundState(next);
  }, []);
  const [subtitleScale, setSubtitleScale] = useState(1);
  // Each start reply carries the desktop app's saved size; a build older than the page sends none, and the page keeps what it had.
  const takeSaved = useCallback((reply: StartReply) => {
    setSound(soundOf(reply, soundRef.current));
    if (reply.subtitleScale !== undefined) setSubtitleScale(subtitleScaleOf(reply.subtitleScale));
  }, [setSound]);
  const fullscreenRef = useRef(false);
  const loads = useRef(0);
  const givenSeries = useRef<{ id: number; promise: Promise<SeriesReply> } | null>(null);
  // The last Play opened, so Retry can work out again what it plays when that failed.
  const lastOpen = useRef<OpenRequest | null>(null);
  const playedMs = useRef(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const downloadsRef = useRef(downloads);
  downloadsRef.current = downloads;
  const unauthenticatedRef = useRef(onUnauthenticated);
  unauthenticatedRef.current = onUnauthenticated;
  // postJson leaves a 401 to its caller; here it goes to onUnauthenticated (src/client/AGENTS.md).
  const post = useCallback((path: string, body: unknown) => postJson(path, body).then((response) => {
    if (response.status === 401) unauthenticatedRef.current();
    return response;
  }), []);
  const delaySave = useRef<number | undefined>(undefined);

  // The ref is the source of truth: bridge events and timers read it between renders.
  const commit = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  const change = useCallback((edit: (current: Session) => Session) => {
    if (sessionRef.current !== null) commit(edit(sessionRef.current));
  }, [commit]);

  const sendTimeline = useCallback((s: Session, state: TimelineState, options: { continuing?: boolean; keepalive?: boolean } = {}) => {
    if (s.reply === null) return;
    const item = s.reply.playQueue.items.find((entry) => entry.ratingKey === s.request.ratingKey);
    const query = timelineQuery({
      ratingKey: s.request.ratingKey,
      state,
      position: s.playback.position,
      duration: s.playback.duration > 0 ? s.playback.duration : (s.reply.durationMs ?? 0) / 1000,
      playedMs: playedMs.current,
      playQueueItemID: item?.playQueueItemID ?? null,
      continuing: options.continuing,
      ...idsOf(s.reply),
    });
    fetch(`/api/playback/timeline?${new URLSearchParams(query)}`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, keepalive: options.keepalive })
      .then((response) => {
        if (response.status === 401) unauthenticatedRef.current();
        return response.ok;
      }, () => false)
      .then((ok) => setPlexDownSince((since) => (ok ? null : since ?? Date.now())));
  }, []);

  // A load of `request`: `fresh` starts the opening state (a new title or a retry); otherwise the same title restarts at a
  // second (quality or track change, a transcode Plex lost) and shows as buffering.
  const startLoad = useCallback(async (request: LoadRequest, title: PlayerTitle, fresh: boolean) => {
    if (bridge === undefined) return false;
    const load = ++loads.current;
    if (fresh) {
      playedMs.current = 0;
      commit({
        load, request, title, reply: null, playback: openingAt(request.offsetSeconds), openedAt: Date.now(),
        saved: { audio: false, subtitles: false, delay: false }, subtitleDelay: 0, upNext: null,
      });
    } else {
      change((s) => ({ ...s, load, request, playback: { ...s.playback, phase: 'playing', restarting: true } }));
    }
    try {
      const reply = await bridge.load(request) as unknown as StartReply;
      if (loads.current !== load) return false;
      takeSaved(reply);
      // A new title starts at the chosen subtitle's offset saved in Plex; a reload of the same title keeps the delay it had.
      const delay = fresh ? savedDelay(reply.tracks.subtitle.find((track) => track.selected)) : null;
      // A request without a version takes the one the server picked, so later reloads of this title ask for the same one.
      const picked = request.mediaIndex === undefined && typeof reply.mediaIndex === 'number' ? reply.mediaIndex : undefined;
      // A new title is where the server started it (Plex's saved position on resume), not the page's guess, so a stop or
      // a failure before its first frame reports that second to Plex.
      change((s) => ({
        ...s, reply, subtitleDelay: delay ?? s.subtitleDelay,
        ...(fresh ? { playback: { ...s.playback, position: reply.startPositionSeconds } } : {}),
        ...(picked === undefined ? {} : { request: { ...s.request, mediaIndex: picked } }),
      }));
      if (delay !== null) void bridge.setSubtitleDelay(delay).catch(() => undefined);
      return true;
    } catch (error) {
      if (loads.current !== load) return false;
      change((s) => ({ ...s, playback: { ...s.playback, phase: 'failed', buffering: false, restarting: false, failure: { message: startFailure(error, title.name), tried: [] } } }));
      return false;
    }
  }, [bridge, change, commit, takeSaved]);

  const setFullscreen = useCallback((on: boolean) => {
    fullscreenRef.current = on;
    setFullscreenState(on);
    void bridge?.setFullscreen(on).catch(() => undefined);
  }, [bridge]);

  const close = useCallback((to?: string) => {
    const s = sessionRef.current;
    if (s === null) return;
    loads.current += 1;
    if (s.reply !== null && s.playback.phase !== 'failed') sendTimeline(s, 'stopped');
    if (s.reply !== null && !s.reply.decision.directPlay) void post('/api/playback/stop', { session: s.reply.session, clientId: idsOf(s.reply).clientId }).catch(() => undefined);
    if (fullscreenRef.current) setFullscreen(false);
    void bridge?.stop().catch(() => undefined);
    commit(null);
    qualityRef.current = undefined;
    setQualityKbps(undefined);
    setPlexDownSince(null);
    if (to !== undefined) {
      if (isPlayAddress(window.location.pathname)) replaceScreen(to);
      else navigate(to);
    } else if (isPlayAddress(window.location.pathname)) {
      window.history.back();
    }
    const focus = returnFocus.current;
    returnFocus.current = null;
    if (focus !== null) window.requestAnimationFrame(() => { if (focus.isConnected) focus.focus(); });
  }, [bridge, commit, post, sendTimeline, setFullscreen]);

  // A Play from a card or title page. As in Plex's own app, the opening screen shows at once; what to play is worked out
  // behind it, and the title playing stops now rather than under the opening screen.
  const open = useCallback(async (asked: OpenRequest) => {
    const openedAt = Date.now();
    const { title, load: findLoad, series } = asked;
    lastOpen.current = asked;
    const s = sessionRef.current;
    if (s?.reply != null) sendTimeline(s, 'stopped');
    // Also a title still opening: its first frame would otherwise end this one's opening screen.
    if (s !== null) void bridge?.stop().catch(() => undefined);
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('[data-player-root]') === null) returnFocus.current = active;
    const load = ++loads.current;
    givenSeries.current = series === undefined || title.seriesId === null ? null : { id: title.seriesId, promise: series };
    commit({
      load, request: OPENING_REQUEST, title, reply: null, playback: openingAt(0), openedAt,
      saved: { audio: false, subtitles: false, delay: false }, subtitleDelay: 0, upNext: null,
    });
    if (!isPlayAddress(window.location.pathname)) navigate('/play/');
    let found: Loaded = null;
    let failure: unknown;
    try {
      found = await findLoad();
    } catch (error) {
      failure = error ?? new Error('failed');
    }
    const outcome = openOutcome({ current: loads.current, load, failed: failure !== undefined, found });
    if (outcome === 'fail') change((current) => ({ ...current, playback: { ...current.playback, phase: 'failed', failure: { message: startFailure(failure, title.name), tried: [] } } }));
    if (outcome === 'close') close();
    if (outcome !== 'play' || found === null) return false;
    const { request } = found;
    if (isPlayAddress(window.location.pathname)) replace(`/play/${request.ratingKey}`);
    return startLoad({ ...request, flags: reloadAt(request, request.offsetSeconds, qualityRef.current).flags, openedAt }, { ...title, backdropUrl: found.backdropUrl }, true);
  }, [bridge, change, close, commit, sendTimeline, startLoad]);

  const fetchSeries = useCallback((id: number) => getJson<SeriesReply>(`/api/library/series/${id}`, unauthenticatedRef.current), []);

  const playItem = useCallback((item: NextItem) => {
    const s = sessionRef.current;
    if (s?.reply != null && s.playback.phase !== 'failed') sendTimeline(s, 'stopped', { continuing: true });
    void startLoad(reloadAt(item.request, item.request.offsetSeconds, qualityRef.current), item.title, true);
  }, [sendTimeline, startLoad]);

  // What follows a finished title (player.pen 15, 16): Sonarr's next episode when Plex has it or it is on its way, else the
  // play queue's next item, else the top of Continue Watching.
  const chooseUpNext = useCallback(async (s: Session) => {
    const episodeItem = (show: SeriesReply, episode: EpisodeDetail): NextItem => {
      const playable = okWatch(show.watch)?.episodes[String(episode.id)];
      return {
        request: {
          ratingKey: playable?.ratingKey ?? '',
          mediaIndex: playable?.mediaIndex ?? 0,
          partIndex: 0,
          offsetSeconds: Math.floor((playable?.viewOffsetMs ?? 0) / 1000),
          flags: s.request.flags,
        },
        title: { ...s.title, name: show.title },
        view: {
          still: episode.imageUrl ?? undefined,
          show: show.title,
          episode: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`,
          facts: episode.runtime === null ? '' : minutesText(episode.runtime * 60_000),
          summary: episode.overview ?? undefined,
        },
      };
    };
    let next: NextItem | null = null;
    let waiting: { item: NextItem; episodeId: number; hasFile: boolean } | null = null;
    const show = s.title.seriesId === null ? null : await fetchSeries(s.title.seriesId).catch(() => null);
    const watch = show === null ? null : okWatch(show.watch);
    if (show !== null && watch !== null) {
      const current = show.episodes.find((episode) => watch.episodes[String(episode.id)]?.ratingKey === s.request.ratingKey);
      const following = current === undefined ? null : nextEpisode(show.episodes, current);
      if (following !== null) {
        const item = episodeItem(show, following);
        if (watch.episodes[String(following.id)] !== undefined) next = item;
        else if (following.hasFile || progressOf(downloadsRef.current, following.id) !== undefined) waiting = { item, episodeId: following.id, hasFile: following.hasFile };
      }
    }
    if (next === null && waiting === null && s.reply !== null) {
      const queued = queueNeighbours(s.reply.playQueue.items, s.request.ratingKey).next;
      if (queued?.ratingKey != null) {
        next = {
          request: { ratingKey: queued.ratingKey, mediaIndex: 0, partIndex: 0, offsetSeconds: 0, flags: s.request.flags },
          title: s.title,
          view: {
            show: queued.grandparentTitle ?? queued.title ?? s.title.name,
            episode: [episodeCode(queued.parentIndex, queued.index), queued.title].filter((part) => part !== null).join(' · '),
            facts: queued.duration === null ? '' : minutesText(queued.duration),
          },
        };
      }
    }
    let continuing: NextItem | null = null;
    if (next === null && waiting === null) continuing = await continueWatchingItem(s.title, unauthenticatedRef.current).catch(() => null);
    if (sessionRef.current?.load !== s.load) return;
    const choice = upNextChoice({ next, nextOnItsWay: waiting !== null, continueWatching: continuing, durationSeconds: s.playback.duration });
    if (choice.kind === 'none') close();
    else if (choice.kind === 'play') playItem(choice.item);
    else if (choice.kind === 'countdown') change((current) => ({ ...current, upNext: { kind: 'countdown', item: choice.item, endsAt: Date.now() + choice.seconds * 1000 } }));
    else if (waiting !== null) change((current) => ({ ...current, upNext: { kind: 'waiting', ...waiting } }));
  }, [change, close, fetchSeries, playItem]);

  // The title ended (or Skip credits was pressed): mark it played, then work out what follows.
  const endTitle = useCallback((s: Session) => {
    void post('/api/playback/played', { ratingKey: s.request.ratingKey, played: true, clientId: idsOf(s.reply).clientId }).catch(() => undefined);
    const ended = { ...s, playback: { ...s.playback, phase: 'ended' as const, buffering: false }, upNext: { kind: 'choosing' as const } };
    commit(ended);
    void chooseUpNext(ended);
  }, [chooseUpNext, commit, post]);

  // Bridge events.
  useEffect(() => {
    if (bridge === undefined) return undefined;
    const onEvent = (event: BridgeEvent) => {
      const s = sessionRef.current;
      if (s === null) return;
      if (event.type === 'position' && timelineState(s.playback) === 'playing') playedMs.current += playedBetween(s.playback.position, event.value) * 1000;
      const playback = applyEvent(s.playback, event);
      const started = event.type === 'started' ? event.value as unknown as StartReply : null;
      if (started !== null) takeSaved(started);
      const reply = started ?? s.reply;
      if (playback === s.playback && reply === s.reply) return;
      const next = { ...s, playback, reply };
      if (event.type === 'endOfFile' && s.playback.phase !== 'ended' && playback.phase === 'ended') {
        endTitle(s);
        return;
      }
      commit(next);
      if (reportNow(s.playback, playback)) sendTimeline(next, timelineState(playback)!);
    };
    const names = ['position', 'duration', 'paused', 'buffering', 'loadedAhead', 'endOfFile', 'error', 'started'] as const;
    const offs = names.map((name) => bridge.on(name, (value: unknown) => onEvent({ type: name, value } as BridgeEvent)));
    offs.push(
      bridge.on('volume', (value) => {
        if (Number.isFinite(value)) setSound({ ...soundRef.current, volume: value });
      }),
      bridge.on('muted', (value) => setSound({ ...soundRef.current, muted: value })),
    );
    return () => offs.forEach((off) => off());
  }, [bridge, commit, endTitle, sendTimeline, setSound, takeSaved]);

  // Every 10 s a report in every state that plays (network §6.2); every 30 s a ping while a paused transcode waits (§2.6).
  useEffect(() => {
    if (bridge === undefined) return undefined;
    setNextReportAt(Date.now() + TIMELINE_EVERY_MS);
    const timeline = window.setInterval(() => {
      setNextReportAt(Date.now() + TIMELINE_EVERY_MS);
      const s = sessionRef.current;
      if (s !== null && reportsPeriodically(s.playback)) sendTimeline(s, timelineState(s.playback)!);
    }, TIMELINE_EVERY_MS);
    const ping = window.setInterval(() => {
      const s = sessionRef.current;
      if (s?.reply == null || s.reply.decision.directPlay || !s.playback.paused || s.playback.phase !== 'playing') return;
      getJson<{ status: string }>(`/api/playback/ping?${new URLSearchParams({ session: s.reply.session, clientId: idsOf(s.reply).clientId })}`, unauthenticatedRef.current)
        .then(async ({ status }) => {
          // Plex dropped the paused transcode: start it again at the same second, still paused.
          if (status !== 'gone' || sessionRef.current?.load !== s.load) return;
          if (await startLoad(reloadAt(s.request, s.playback.position, qualityRef.current), s.title, false)) await bridge.pause();
        })
        .catch(() => undefined);
    }, 30_000);
    // Closing the window: the last report, sent so it survives the page going away.
    const onPageHide = () => {
      const s = sessionRef.current;
      if (s !== null) sendTimeline(s, 'stopped', { keepalive: true });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(timeline);
      window.clearInterval(ping);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [bridge, sendTimeline, startLoad]);

  // Signing out or the session expiring unmounts the player: mpv stops with it, so it never plays on with no controls.
  useEffect(() => () => {
    const s = sessionRef.current;
    if (s === null) return;
    loads.current += 1;
    // The session is over by now, so a 401 on this last report is that, not news for onUnauthenticated.
    unauthenticatedRef.current = () => undefined;
    if (s.reply !== null && s.playback.phase !== 'failed') sendTimeline(s, 'stopped', { keepalive: true });
    void bridge?.stop().catch(() => undefined);
  }, [bridge, sendTimeline]);

  // Up Next: the countdown plays the next item when it runs out; a waiting episode plays once Plex has it.
  const upNext = session?.upNext ?? null;
  useEffect(() => {
    if (upNext === null || upNext.kind === 'choosing') return undefined;
    if (upNext.kind === 'countdown') {
      const timeout = window.setTimeout(() => playItem(upNext.item), Math.max(0, upNext.endsAt - Date.now()));
      return () => window.clearTimeout(timeout);
    }
    const seriesId = sessionRef.current?.title.seriesId ?? null;
    if (seriesId === null) return undefined;
    const poll = window.setInterval(() => {
      fetchSeries(seriesId).then((show) => {
        const s = sessionRef.current;
        if (s?.upNext?.kind !== 'waiting') return;
        const playable = okWatch(show.watch)?.episodes[String(upNext.episodeId)];
        if (playable !== undefined) {
          playItem({ ...upNext.item, request: { ...upNext.item.request, ratingKey: playable.ratingKey, mediaIndex: playable.mediaIndex } });
          return;
        }
        const hasFile = show.episodes.find((episode) => episode.id === upNext.episodeId)?.hasFile ?? false;
        if (hasFile !== s.upNext.hasFile) commit({ ...s, upNext: { ...s.upNext, hasFile } });
      }, () => undefined);
    }, 10_000);
    return () => window.clearInterval(poll);
  }, [commit, fetchSeries, playItem, upNext]);

  // The show's episodes name the episode playing, and give Previous and Next their stills.
  const seriesId = session?.title.seriesId ?? null;
  useEffect(() => {
    if (seriesId === null) {
      setSeries(null);
      return undefined;
    }
    const controller = new AbortController();
    // The Play that opened the player may already hold the show, or be fetching it.
    const given = givenSeries.current?.id === seriesId ? givenSeries.current.promise : null;
    (given ?? getJson<SeriesReply>(`/api/library/series/${seriesId}`, unauthenticatedRef.current, controller.signal))
      .then((show) => { if (!controller.signal.aborted) setSeries(show); }, () => undefined);
    return () => controller.abort();
  }, [seriesId]);

  // Load ahead is the desktop app's value; Settings and the gear menu both read it fresh.
  const readLoadAhead = useCallback(() => {
    void bridge?.getLoadAhead().then(setLoadAheadBytes, () => undefined);
  }, [bridge]);
  useEffect(readLoadAhead, [readLoadAhead]);

  // An address left at /play with nothing playing (a reload, or forward after closing) goes to the library; replace(), not a
  // screen change, because this runs inside the screen change that brought the address (navigation.ts).
  const playing = session !== null;
  useEffect(() => {
    if (isPlayAddress(pathname) && !playing) replace('/');
  }, [pathname, playing]);

  useEffect(() => {
    if (bridge === undefined) return undefined;
    setPlayerHandler(open);
    return () => setPlayerHandler(null);
  }, [bridge, open]);

  const restartAt = useCallback((seconds: number) => {
    const s = sessionRef.current;
    if (s !== null) void startLoad(reloadAt(s.request, seconds, qualityRef.current), s.title, false);
  }, [startLoad]);

  const saveTrack = useCallback(async (kind: 'audio' | 'subtitle', streamId: number | null) => {
    const s = sessionRef.current;
    if (s?.reply?.partId == null || streamId === null) return false;
    const response = await post('/api/playback/track', { partId: s.reply.partId, kind, streamId, allParts: s.request.partIndex > 0, clientId: idsOf(s.reply).clientId }).catch(() => null);
    return response?.ok === true;
  }, [post]);

  const controller = useMemo<Controller>(() => {
    const selectTrack = <T extends AudioTrack>(tracks: T[], chosen: T | null) => tracks.map((track) => ({ ...track, selected: track === chosen }));
    return {
      close,
      playPause: () => {
        const s = sessionRef.current;
        if (s === null || bridge === undefined) return;
        void (s.playback.paused ? bridge.play() : bridge.pause()).catch(() => undefined);
      },
      seek: (seconds) => {
        const s = sessionRef.current;
        if (s === null || bridge === undefined) return;
        const target = clampSeek(seconds, s.playback.duration);
        change((current) => ({ ...current, playback: { ...current.playback, position: target } }));
        void bridge.seek(target).catch(() => undefined);
      },
      seekBy: (seconds) => {
        const s = sessionRef.current;
        if (s !== null) controller.seek(s.playback.position + seconds);
      },
      setFullscreen,
      // The Volume button's click and M mute; Up, Down, the wheel and the slider change the volume and unmute.
      toggleMute: () => {
        if (!hasSoundCommands(bridge)) return;
        const next = !soundRef.current.muted;
        setSound({ ...soundRef.current, muted: next });
        void bridge.setMuted(next).catch(() => undefined);
      },
      changeVolume: (by) => controller.setVolume(soundRef.current.volume + by),
      setVolume: (percent) => {
        if (!hasSoundCommands(bridge)) return;
        const next = clampVolume(percent);
        const wasMuted = soundRef.current.muted;
        setSound({ ...soundRef.current, volume: next });
        void bridge.setVolume(next).catch(() => undefined);
        if (wasMuted) controller.toggleMute();
      },
      // Original file: mpv switches at once and Plex saves it. Converted: Plex saves first, then the stream restarts (network §5.2).
      chooseAudio: async (track) => {
        const s = sessionRef.current;
        if (s?.reply == null || bridge === undefined) return;
        const reply = s.reply;
        change((current) => ({ ...current, reply: { ...reply, tracks: { ...reply.tracks, audio: selectTrack(reply.tracks.audio, track) } } }));
        if (reply.decision.directPlay) void bridge.setAudio(track.index).catch(() => undefined);
        const saved = await saveTrack('audio', track.id);
        change((current) => ({ ...current, saved: { ...current.saved, audio: saved } }));
        if (!reply.decision.directPlay) restartAt(sessionRef.current?.playback.position ?? s.playback.position);
      },
      chooseSubtitle: async (track) => {
        const s = sessionRef.current;
        if (s?.reply == null || bridge === undefined) return;
        const reply = s.reply;
        // The new track brings the offset Plex saved for it; Off goes back to 0.
        const delay = savedDelay(track);
        change((current) => ({
          ...current,
          reply: { ...reply, tracks: { ...reply.tracks, subtitle: selectTrack(reply.tracks.subtitle, track) } },
          subtitleDelay: delay,
          saved: { ...current.saved, delay: false },
        }));
        void bridge.setSubtitleDelay(delay).catch(() => undefined);
        if (reply.decision.directPlay) {
          void bridge.setSubtitle(track === null ? { index: -1, url: null, ffIndex: null } : { index: track.index, url: track.url ?? null, ffIndex: track.ffIndex }).catch(() => undefined);
        }
        const saved = await saveTrack('subtitle', track === null ? 0 : track.id);
        change((current) => ({ ...current, saved: { ...current.saved, subtitles: saved } }));
        if (!reply.decision.directPlay) restartAt(sessionRef.current?.playback.position ?? s.playback.position);
      },
      changeSubtitleDelay: (step) => {
        const s = sessionRef.current;
        const track = s?.reply?.tracks.subtitle.find((entry) => entry.selected);
        if (s === null || track === undefined || bridge === undefined) return;
        const delay = step === 'reset' ? 0 : Math.round((s.subtitleDelay + step) * 10) / 10;
        change((current) => ({ ...current, subtitleDelay: delay, saved: { ...current.saved, delay: false } }));
        void bridge.setSubtitleDelay(delay).catch(() => undefined);
        // One save once the presses stop, on that subtitle track (network §5.6).
        window.clearTimeout(delaySave.current);
        delaySave.current = window.setTimeout(() => {
          const key = streamKey(track);
          if (key === null) return;
          void post('/api/playback/subtitle-offset', { streamKey: key, offsetMs: Math.round(delay * 1000), clientId: idsOf(s.reply).clientId })
            .then((response) => { if (response.ok) change((current) => ({ ...current, saved: { ...current.saved, delay: true } })); }, () => undefined);
        }, 600);
      },
      // A desktop app setting, kept for every file and never saved to Plex.
      chooseSubtitleScale: (scale) => {
        if (!hasSubtitleScale(bridge)) return;
        const next = subtitleScaleOf(scale);
        setSubtitleScale(next);
        void bridge.setSubtitleScale(next).catch(() => undefined);
      },
      // A quality step lasts until the player closes; each change is a new load at the current second (network §3.4).
      chooseQuality: (kbps) => {
        qualityRef.current = kbps;
        setQualityKbps(kbps);
        const s = sessionRef.current;
        if (s !== null) restartAt(s.playback.position);
      },
      readLoadAhead,
      chooseLoadAhead: (value) => {
        const option = LOAD_AHEAD.find((candidate) => candidate.value === value);
        if (option === undefined || bridge === undefined) return;
        setLoadAheadBytes(option.bytes);
        void bridge.setLoadAhead(option.bytes).catch(readLoadAhead);
      },
      clearSaved: () => change((current) => ({ ...current, saved: { audio: false, subtitles: false, delay: false } })),
      // Skip intro jumps to the end of the intro; Skip credits leads to Up Next, as player.pen state 10 draws it.
      skipMarker: (kind, endSeconds) => {
        const s = sessionRef.current;
        if (s === null) return;
        if (kind === 'intro') {
          controller.seek(endSeconds);
          return;
        }
        void bridge?.pause().catch(() => undefined);
        endTitle(s);
      },
      playItem,
      playQueueItem: (item) => {
        const s = sessionRef.current;
        if (s === null || item.ratingKey === null) return;
        playItem({
          request: { ratingKey: item.ratingKey, mediaIndex: 0, partIndex: 0, offsetSeconds: 0, flags: s.request.flags },
          title: s.title,
          view: { show: s.title.name, episode: '', facts: '' },
        });
      },
      retry: () => {
        const s = sessionRef.current;
        if (s === null) return;
        // A Play that failed before it knew what it plays asks again; the stand-in request never goes to the desktop app.
        if (retryStep(s.request) === 'reopen') {
          if (lastOpen.current !== null) void open({ ...lastOpen.current, series: undefined });
          return;
        }
        void startLoad(retryRequest(s.request, s.reply !== null, s.playback.position, qualityRef.current), s.title, true);
      },
      reportNow: () => {
        const s = sessionRef.current;
        const state = s === null ? null : timelineState(s.playback);
        if (s !== null && state !== null) sendTimeline(s, state);
      },
    };
  }, [bridge, change, close, endTitle, open, playItem, post, readLoadAhead, restartAt, saveTrack, sendTimeline, setFullscreen, setSound, startLoad]);

  const soundShown = hasSoundCommands(bridge) ? sound : null;
  const scaleShown = hasSubtitleScale(bridge) ? subtitleScale : null;
  const value = useMemo<PlayerContextValue>(() => ({
    session, series, plexDownSince, nextReportAt, qualityKbps, loadAheadBytes, fullscreen, sound: soundShown, subtitleScale: scaleShown, downloads, returnFocus, controller,
  }), [session, series, plexDownSince, nextReportAt, qualityKbps, loadAheadBytes, fullscreen, soundShown, scaleShown, downloads, controller]);

  return <PlayerContext value={value}>{children}</PlayerContext>;
}

const progressOf = (downloads: DownloadsState, episodeId: number) => (
  downloads.kind === 'ready' ? subjectProgress(downloads.snapshot, buildRows(downloads.snapshot)).get(`episode:${episodeId}`) : undefined
);

/** The top of Continue Watching, other than the title just played, as an Up Next item. */
async function continueWatchingItem(current: PlayerTitle, onUnauthenticated: () => void): Promise<NextItem | null> {
  const { titles, watch } = await getJson<{ titles: LibraryTitle[]; watch: LibraryWatch }>('/api/library/titles', onUnauthenticated);
  if (watch.kind !== 'ok') return null;
  const isCurrent = (item: ContinueWatchingItem) => item.service === 'sonarr' && item.id === current.seriesId;
  const item = watch.continueWatching.find((entry) => !isCurrent(entry));
  const title = item === undefined ? undefined : titles.find((entry) => entry.service === item.service && entry.id === item.id);
  if (item === undefined || title === undefined) return null;
  const loaded = await loadRequestFor(title, item, 'resume', onUnauthenticated, new AbortController().signal);
  if (loaded === null) return null;
  const code = item.episode === null ? null : episodeCode(item.episode.seasonNumber, item.episode.episodeNumber);
  return {
    request: loaded.request,
    title: { name: title.title, year: title.year, seriesId: title.tv === null ? null : title.id, backdropUrl: loaded.backdropUrl },
    view: {
      still: title.posterUrl ?? undefined,
      show: title.title,
      episode: [code, item.episode?.title ?? null].filter((part) => part !== null).join(' · ') || String(title.year ?? ''),
      facts: continueMeta(item) ?? '',
    },
  };
}

const waitingSteps = (progress: ReturnType<typeof progressOf>, hasFile: boolean): UpNextStep[] => {
  // Downloading while the torrent has a percentage left, importing once it has none, then Plex. Plex's analysis cannot be
  // seen from here, so the last step never shows as running.
  const active = hasFile ? 2 : progress !== undefined && progress.percent !== null && progress.percent < 100 ? 0 : progress !== undefined ? 1 : 2;
  const steps: UpNextStep[] = [
    { label: 'Downloading', detail: progress?.percent == null ? 'Waiting to start' : `${Math.round(progress.percent)}% · ${formatSpeed(progress.downRate)}`, progress: progress?.percent ?? undefined },
    { label: 'Importing', detail: 'Moves the file into the library' },
    { label: 'Waiting for Plex', detail: "Plex hasn't found the file yet" },
    { label: 'Plex is analysing', detail: 'Reads the file so it can play' },
  ];
  return steps.map((step, index) => ({ ...step, active: index === active }));
};

/** Ticks while something on screen counts time. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

// Plex's own player hides its controls 2 s after the last move, click or key (AudioVideoFullPlayer, Plex.app 4.160).
const CONTROLS_HIDE_MS = 2_000;
// Most Plays show their first frame within 1.5-2.5 s (play-timings.log, 31 Oct), so the opening screen's line waits well past that.
const OPENING_SLOW_MS = 8_000;
const SKIP_FADE_MS = 10_000;

/** The player element; Home draws it beside the downloads bar. Nothing shows until a title plays. */
export function Player() {
  const context = use(PlayerContext);
  const { pathname } = useLocation({ includePlay: true });
  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<PlayerMenu | undefined>(undefined);
  const [controlsShown, setControlsShown] = useState(true);
  const [hoverAt, setHoverAt] = useState<number | undefined>(undefined);
  const [dragAt, setDragAtState] = useState<number | undefined>(undefined);
  const dragRef = useRef<number | undefined>(undefined);
  const setDragAt = (at: number | undefined) => {
    dragRef.current = at;
    setDragAtState(at);
  };
  const pointerDown = useRef(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const lastWheelStep = useRef(0);
  const lastMove = useRef(Date.now());
  const skipShownUntil = useRef(0);
  const markerKey = useRef<string | null>(null);

  const session = context?.session ?? null;
  const layout = session === null ? null : isPlayAddress(pathname) ? 'full' : 'mini';
  const playback = session?.playback;
  const screen = playback === undefined ? 'opening' : screenFor(playback, context?.plexDownSince != null);
  const marker = session?.reply == null || playback === undefined ? null : activeMarker(session.reply.markers, playback.position);
  const now = useNow(layout !== null && (screen === 'opening' || screen === 'unreachable' || screen === 'up-next' || (marker !== null && !controlsShown)));

  // The page drops its background while the player is open (player.css), and mpv places the picture to match the layout.
  useEffect(() => {
    if (layout === null) return undefined;
    document.documentElement.dataset.player = layout;
    return () => { delete document.documentElement.dataset.player; };
  }, [layout]);
  useEffect(() => {
    const bridge = desktopBridge();
    if (layout === null || bridge === undefined) return undefined;
    if (layout === 'full') {
      void bridge.setLayout('full').catch(() => undefined);
      return undefined;
    }
    // Mini: the picture goes where the mini player sits, and the hole in the app follows it as the app scrolls.
    const place = (resized: boolean) => {
      const box = rootRef.current?.getBoundingClientRect();
      const app = document.querySelector('[data-app]')?.getBoundingClientRect();
      if (box === undefined) return;
      if (app !== undefined) {
        document.documentElement.style.setProperty('--player-hole-x', `${box.left - app.left}px`);
        document.documentElement.style.setProperty('--player-hole-y', `${box.top - app.top}px`);
      }
      if (resized) void bridge.setLayout({ x: box.left, y: box.top, width: box.width, height: box.height }).catch(() => undefined);
    };
    place(true);
    const onScroll = () => place(false);
    const onResize = () => place(true);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [layout]);

  // Shrinking to the mini player gives keyboard focus back to the button that started playback (library-search.pen U06w40).
  const wasFull = useRef(false);
  useEffect(() => {
    if (layout === 'mini' && wasFull.current) {
      setOpenMenu(undefined);
      const focus = context?.returnFocus.current;
      if (focus?.isConnected === true) focus.focus();
    }
    wasFull.current = layout === 'full';
  }, [context?.returnFocus, layout]);

  // Controls hide 2 s after the last move, click or key, unless paused, a menu or the volume slider is open, the timeline is
  // in use or the pointer rests on a control bar (as Plex's do). Trap: the window-drag strip at the top (PlayerScreen) gets
  // no mouse events, so a pointer there counts as idle.
  const keepControls = screen !== 'playing' || playback?.paused === true || openMenu !== undefined || volumeOpen || hoverAt !== undefined || dragAt !== undefined;
  const overBar = useRef(false);
  useEffect(() => {
    if (keepControls) {
      setControlsShown(true);
      lastMove.current = Date.now();
      return undefined;
    }
    // Moves only stamp the time; the timer looks again when it fires, so the pointer moving keeps the controls.
    let timer: number | undefined;
    const check = () => {
      const left = overBar.current ? CONTROLS_HIDE_MS : lastMove.current + CONTROLS_HIDE_MS - Date.now();
      if (left <= 0) setControlsShown(false);
      else timer = window.setTimeout(check, left);
    };
    check();
    return () => window.clearTimeout(timer);
  }, [keepControls, controlsShown]);
  useEffect(() => {
    if (layout !== 'full') return undefined;
    const onActivity = (event: Event) => {
      // A key leaves the pointer where it was; the focused element is not under it.
      if (event instanceof PointerEvent) overBar.current = event.target instanceof Element && event.target.closest('[data-player-bar]') !== null;
      lastMove.current = Date.now();
      skipShownUntil.current = Date.now() + SKIP_FADE_MS;
      setControlsShown(true);
    };
    // Out of the window (or into the drag strip): the pointer no longer rests on a bar.
    const onOut = (event: MouseEvent) => { if (event.relatedTarget === null) overBar.current = false; };
    const names = ['pointermove', 'pointerdown', 'keyup'] as const;
    for (const name of names) window.addEventListener(name, onActivity);
    document.addEventListener('mouseout', onOut);
    return () => {
      for (const name of names) window.removeEventListener(name, onActivity);
      document.removeEventListener('mouseout', onOut);
    };
  }, [layout]);

  // A marker the position has just entered shows Skip for 10 s even with the controls hidden (network §10.2).
  if ((marker?.key ?? null) !== markerKey.current) {
    markerKey.current = marker?.key ?? null;
    if (marker !== null) skipShownUntil.current = Date.now() + SKIP_FADE_MS;
  }
  const skipVisible = marker !== null && (controlsShown || now < skipShownUntil.current);

  // Dragging the timeline previews and seeks once on release, like Plex's own player; keys on the timeline seek at once.
  const controller = context?.controller;
  useEffect(() => {
    if (controller === undefined) return undefined;
    // Capture, so this runs before the timeline's own handler reports the first value.
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) pointerDown.current = true;
    };
    const onUp = () => {
      pointerDown.current = false;
      const at = dragRef.current;
      if (at === undefined) return;
      dragRef.current = undefined;
      setDragAtState(undefined);
      controller.seek(at);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [controller]);

  // Keys while full size: Space, Left and Right seek, Up and Down volume, M mute, S, F, Esc (leaves fullscreen, else mini).
  useEffect(() => {
    if (layout !== 'full' || controller === undefined || session === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || openMenu !== undefined) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const onTimeline = target?.getAttribute('role') === 'slider';
      const soundKey = onTimeline ? null : volumeKey(event.key);
      if (event.key === 'Escape') {
        event.preventDefault();
        if (screen === 'up-next') controller.close('/');
        else if (screen === 'opening') controller.close();
        else if (context?.fullscreen === true) controller.setFullscreen(false);
        else window.history.back();
      } else if (screen === 'up-next' || screen === 'opening') {
        // Up Next: Enter belongs to Play now, which holds focus. Opening: nothing plays yet to pause, seek or turn up.
      } else if (soundKey !== null) {
        event.preventDefault();
        if (soundKey.kind === 'mute') controller.toggleMute();
        else controller.changeVolume(soundKey.by);
      } else if (event.key === ' ') {
        event.preventDefault();
        controller.playPause();
      } else if (event.key === 'ArrowLeft' && !onTimeline) {
        event.preventDefault();
        controller.seekBy(-BACK_SECONDS);
      } else if (event.key === 'ArrowRight' && !onTimeline) {
        event.preventDefault();
        controller.seekBy(FORWARD_SECONDS);
      } else if ((event.key === 's' || event.key === 'S') && marker !== null) {
        event.preventDefault();
        controller.skipMarker(marker.kind, marker.endSeconds);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        controller.setFullscreen(context?.fullscreen !== true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [context?.fullscreen, controller, layout, marker, openMenu, screen, session]);

  if (context === null || session === null || playback === undefined || layout === null || controller === undefined) return null;
  const { reply, request, title } = session;
  const { series } = context;

  const watch = series === null ? null : okWatch(series.watch);
  const episodeFor = (ratingKey: string | null) => (watch === null ? undefined : series?.episodes.find((episode) => watch.episodes[String(episode.id)]?.ratingKey === ratingKey));
  const current = episodeFor(request.ratingKey);
  const queueItem = reply?.playQueue.items.find((item) => item.ratingKey === request.ratingKey);
  const where = current !== undefined
    ? `S${current.seasonNumber} E${current.episodeNumber} · ${current.title}`
    : queueItem !== undefined && queueItem.type === 'episode'
      ? [episodeCode(queueItem.parentIndex, queueItem.index), queueItem.title].filter((part) => part !== null).join(' · ')
      : title.year === null ? undefined : String(title.year);
  const duration = playback.duration > 0 ? playback.duration : (reply?.durationMs ?? 0) / 1000;
  const subtitle = screen === 'opening' && request.offsetSeconds > 0 ? [where, `from ${clockText(request.offsetSeconds * 1000)}`].filter(Boolean).join(' · ') : where;

  const neighbours = reply === null ? { previous: null, next: null } : queueNeighbours(reply.playQueue.items, request.ratingKey);
  const queueButton = (item: QueueItem | null, word: string): PlayerQueueItem | undefined => {
    if (item === null || item.ratingKey === null) return undefined;
    const code = episodeCode(item.parentIndex, item.index);
    return {
      still: episodeFor(item.ratingKey)?.imageUrl ?? undefined,
      label: code === null ? word : `${word} · ${code}`,
      title: item.title ?? '',
      onSelect: () => controller.playQueueItem(item),
    };
  };

  const scrubAt = dragAt ?? hoverAt;
  const upNext = session.upNext;
  let upNextView: UpNextView | undefined;
  if (upNext?.kind === 'countdown') {
    const item = upNext.item;
    upNextView = { ...item.view, countdown: Math.max(0, Math.ceil((upNext.endsAt - now) / 1000)), onPlayNow: () => controller.playItem(item) };
  } else if (upNext?.kind === 'waiting') {
    upNextView = { ...upNext.item.view, steps: waitingSteps(progressOf(context.downloads, upNext.episodeId), upNext.hasFile) };
  }

  return createPortal(
    <PlayerScreen
      layout={layout}
      screen={screen}
      rootRef={rootRef}
      name={title.name}
      subtitle={subtitle}
      format={reply === null ? undefined : formatLine(reply.file)}
      backdropUrl={title.backdropUrl ?? undefined}
      position={dragAt ?? playback.position}
      duration={duration}
      loadedAhead={playback.loadedAhead}
      playing={!playback.paused}
      controls={controlsShown ? 'all' : 'none'}
      opening={{ text: request.flags.directPlay ? 'Starting the original file from Plex' : 'Starting from Plex', slow: now - session.openedAt >= OPENING_SLOW_MS }}
      loadAhead={loadAheadChoice(context.loadAheadBytes).value}
      chapters={reply?.chapters.flatMap((chapter) => (chapter.startTimeOffset === null ? [] : [{ start: chapter.startTimeOffset / 1000, title: chapter.title ?? `Chapter ${chapter.index ?? ''}` }]))}
      markers={reply?.markers.flatMap((entry) => ((entry.type === 'intro' || entry.type === 'credits') && entry.startTimeOffset !== null && entry.endTimeOffset !== null
        ? [{ start: entry.startTimeOffset / 1000, end: entry.endTimeOffset / 1000 }] : []))}
      scrubAt={scrubAt}
      scrubImage={scrubAt === undefined || reply?.partId == null ? undefined
        : `/api/playback/preview?${new URLSearchParams({ partId: String(reply.partId), ms: String(Math.round(scrubAt) * 1000), width: '512', height: '288', clientId: idsOf(reply).clientId })}`}
      previous={queueButton(neighbours.previous, 'Previous')}
      next={queueButton(neighbours.next, 'Next')}
      audio={{ tracks: reply?.tracks.audio ?? [], saved: session.saved.audio }}
      subtitles={{
        tracks: reply?.tracks.subtitle ?? [], saved: session.saved.subtitles, delay: session.subtitleDelay, delaySaved: session.saved.delay,
        size: context.subtitleScale ?? undefined,
      }}
      volume={context.sound?.volume ?? 100}
      muted={context.sound?.muted ?? false}
      quality={{
        steps: reply?.qualitySteps ?? [], kbps: context.qualityKbps, label: reply === null ? 'Original' : qualityLabel(reply.decision, reply.qualitySteps),
        original: reply === null ? undefined : originalLabel(reply.file),
      }}
      skip={marker === null ? undefined : { kind: marker.kind, visible: skipVisible, raised: controlsShown }}
      failure={playback.failure === undefined ? undefined : {
        body: playback.failure.tried.length > 0 ? `Plex stopped sending ${title.name} and every way of playing it failed. Your place is saved.` : playback.failure.message,
        detail: playback.failure.tried.length > 0 ? triedText(playback.failure.tried) : undefined,
      }}
      unreachable={context.plexDownSince === null ? undefined : {
        downFor: (now - context.plexDownSince) / 1000,
        nextTryIn: Math.max(0, (context.nextReportAt - now) / 1000),
      }}
      upNext={upNextView}
      openMenu={openMenu}
      onOpenMenuChange={(menu) => {
        if (menu === 'settings') controller.readLoadAhead();
        if (menu === undefined) controller.clearSaved();
        setOpenMenu(menu);
      }}
      onBack={() => controller.close()}
      onPlayPause={controller.playPause}
      onBack10={() => controller.seekBy(-BACK_SECONDS)}
      onForward30={() => controller.seekBy(FORWARD_SECONDS)}
      onVolume={controller.toggleMute}
      onVolumeChange={controller.setVolume}
      onVolumeWheel={(deltaY) => {
        const by = wheelStep(deltaY, Date.now(), lastWheelStep.current);
        if (by === 0) return;
        lastWheelStep.current = Date.now();
        controller.changeVolume(by);
      }}
      onVolumeOpenChange={setVolumeOpen}
      onMini={() => window.history.back()}
      onExpand={() => navigate(`/play/${request.ratingKey}`)}
      onFullscreen={() => controller.setFullscreen(!context.fullscreen)}
      onSeek={(seconds) => (pointerDown.current ? setDragAt(seconds) : controller.seek(seconds))}
      onScrub={setHoverAt}
      onAudio={controller.chooseAudio}
      onSubtitle={controller.chooseSubtitle}
      onSubtitleDelay={controller.changeSubtitleDelay}
      onSubtitleSize={controller.chooseSubtitleScale}
      onQuality={controller.chooseQuality}
      onLoadAhead={controller.chooseLoadAhead}
      onSkip={() => { if (marker !== null) controller.skipMarker(marker.kind, marker.endSeconds); }}
      onRetry={controller.retry}
      onTryAgain={controller.reportNow}
      onClose={() => controller.close()}
      onUpNextOut={() => controller.close('/')}
    />,
    document.body,
  );
}
