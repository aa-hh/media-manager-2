// Play on the movie and show pages: the header's Play line (title.pen NIjoo, p6VuR) and the episode still (wnNt9, L91tSr),
// each opening the resume menu when Plex has a saved position (OkR0H, wnNt9).
import { ExternalLink, Play } from 'lucide-react';
import { useEffect, useState, type ComponentProps, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { HeaderPlayLine } from '@/components/ui/header-title';
import { MenuResume } from '@/components/ui/menu-resume';
import { StillEpisode } from '@/components/ui/still-episode';
import type { LibraryTitle, MovieWatch, SeriesWatch } from '../library/api';
import { playInDesktop } from '../library/play';
import { clockText, type PlayMode, type StartFrom } from '../library/watch';
import { titleWatch, type HeaderPlay } from './playLine';
import type { Subject } from './TitleHeader';

export type OnPlay = (from: StartFrom, signal: AbortSignal) => Promise<unknown>;

/** The page's title in the library's shape, which playInDesktop takes. */
const asLibraryTitle = (subject: Subject, watch: SeriesWatch | MovieWatch): LibraryTitle => {
  const { detail } = subject;
  return {
    type: subject.type,
    service: subject.type === 'tv' ? 'sonarr' : 'radarr',
    id: detail.id,
    title: detail.title,
    year: detail.year,
    added: detail.added,
    monitored: detail.monitored,
    status: detail.status,
    posterUrl: detail.posterUrl,
    qualityProfile: detail.qualityProfile?.name ?? null,
    sizeOnDisk: subject.type === 'tv' ? subject.detail.statistics.sizeOnDisk : subject.detail.sizeOnDisk,
    tv: subject.type === 'tv' ? { ...subject.detail.statistics } : null,
    movie: subject.type === 'movie' ? { hasFile: subject.detail.hasFile, isAvailable: subject.detail.isAvailable } : null,
    watch: titleWatch(watch),
  };
};

/**
 * Starts the movie, or the given episode, in the desktop app's player from Plex's saved position or the start.
 * Always Plex's default (highest-quality) version: see the version note in ResumeMenu.
 */
export const startOnPage = (
  subject: Subject,
  watch: SeriesWatch | MovieWatch,
  episode: { seasonNumber: number; episodeNumber: number } | null,
  onUnauthenticated: () => void,
): OnPlay => (from, signal) => playInDesktop(
  asLibraryTitle(subject, watch),
  episode === null ? undefined : {
    service: 'sonarr', id: subject.detail.id, viewOffsetMs: null, durationMs: null, lastViewedAt: null,
    episode: { seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber, title: null },
  },
  from,
  onUnauthenticated,
  signal,
  // The page's detail gives the player its backdrop and episode names before anything is fetched.
  {
    reply: subject.type === 'tv'
      ? { title: subject.detail.title, episodes: subject.detail.episodes, watch: watch as SeriesWatch, backdropUrl: subject.detail.backdropUrl }
      : { watch: watch as MovieWatch, backdropUrl: subject.detail.backdropUrl },
  },
);

/** One Play at a time per button: true while it loads. Esc or leaving the page cancels it only until the player opens; then the player's own Esc does. */
const useStart = (onPlay: OnPlay) => {
  const [running, setRunning] = useState<AbortController | null>(null);
  useEffect(() => {
    if (running === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      running.abort();
      setRunning(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);
  useEffect(() => () => running?.abort(), [running]);
  const start = (from: StartFrom) => {
    const controller = new AbortController();
    setRunning(controller);
    onPlay(from, controller.signal)
      .catch(() => undefined)
      .finally(() => setRunning((current) => (current === controller ? null : current)));
  };
  return { running: running !== null, start };
};

/**
 * The resume menu's Start group.
 * Version choice (MenuResume's versions, version and onVersionChange, and "Play 720p version" in the ••• menu) waits for
 * playInDesktop's `options.mediaIndex`, which the player track is adding; until then every Play starts Plex's default version.
 */
function ResumeMenu({ resumeAtMs, start }: { resumeAtMs: number; start: (from: StartFrom) => void }) {
  return <MenuResume resumeAt={clockText(resumeAtMs)} onResume={() => start('resume')} onRestart={() => start('start')} />;
}

/** The header's Play line: Play in Plex in a plain browser; in the desktop app Play, or Resume opening the resume menu. */
export function TitlePlayLine({ mode, play, name, plexUrl, onPlay }: {
  mode: Exclude<PlayMode, 'none'>;
  play: HeaderPlay;
  /** The title's name, so the button's name says what it plays. */
  name: string;
  plexUrl: string;
  onPlay: OnPlay;
}) {
  const { running, start } = useStart(onPlay);
  let action;
  if (mode === 'plex-web') {
    action = (
      <Button size="large" nativeButton={false} render={<a href={plexUrl} target="_blank" rel="noreferrer" />} icon={<ExternalLink aria-hidden="true" />} aria-label={`Play in Plex: ${name}`}>
        Play in Plex
      </Button>
    );
  } else {
    const button = (props: object) => (
      <Button size="large" icon={<Play aria-hidden="true" />} loading={running} aria-label={`${play.label}: ${name}`} {...props}>{play.label}</Button>
    );
    action = play.resumeAtMs === null ? button({ onClick: () => start('start') }) : (
      <DropdownMenu>
        <DropdownMenuTrigger render={button({})} />
        <ResumeMenu resumeAtMs={play.resumeAtMs} start={start} />
      </DropdownMenu>
    );
  }
  return <HeaderPlayLine action={action} line1={play.line1} line2={play.line2} />;
}

type StillProps = Omit<ComponentProps<typeof StillEpisode>, 'playable' | 'onClick' | 'aria-label'>;

/**
 * The episode still as its Play button. It plays at once, or opens the resume menu under it when Plex has a saved position;
 * in a plain browser it opens the episode on app.plex.tv. A click never reaches the row, so it does not select it.
 */
export function PlayStill({ mode, code, resumeAtMs, plexUrl, onStart, ...still }: StillProps & {
  mode: PlayMode;
  /** "E05", for the still's name. */
  code: string;
  resumeAtMs: number | null;
  plexUrl: string;
  /** Starts it in the desktop app; named apart from the button's own media onPlay. */
  onStart: OnPlay;
}) {
  const { running, start } = useStart(onStart);
  if (mode === 'none') return <StillEpisode {...still} />;
  const stop = (event: MouseEvent) => event.stopPropagation();
  if (mode === 'plex-web') {
    return (
      <StillEpisode
        {...still}
        playable
        aria-label={`Play ${code} in Plex`}
        onClick={(event) => {
          stop(event);
          window.open(plexUrl, '_blank', 'noopener,noreferrer');
        }}
      />
    );
  }
  const label = `${resumeAtMs === null ? 'Play' : 'Resume'} ${code}`;
  if (resumeAtMs === null) {
    return <StillEpisode {...still} playable aria-label={label} aria-busy={running || undefined} onClick={(event) => { stop(event); start('start'); }} />;
  }
  // The menu renders in a portal, but React still passes its clicks up to the row, which would select it.
  return (
    <span className="contents" onClick={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<StillEpisode {...still} playable aria-label={label} aria-busy={running || undefined} onClick={stop} />} />
        <ResumeMenu resumeAtMs={resumeAtMs} start={start} />
      </DropdownMenu>
    </span>
  );
}
