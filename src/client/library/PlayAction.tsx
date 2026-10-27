import { ExternalLink, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { clockText, type StartFrom } from './watch';

type PlayActionProps = {
  /** Inside the desktop app the button starts the in-app player; in a plain browser it opens the item on app.plex.tv. */
  mode: 'desktop' | 'plex-web';
  /** "Resume", "Play S3 E5" or "Play". */
  label: string;
  /** The title's name, so the button's name says what it plays. */
  name: string;
  /** Plex's saved position; with one, the desktop button opens the resume menu first. */
  resumeAtMs: number | null;
  plexUrl: string;
  /** Starts playback; the spinner shows until it settles. The signal aborts on Esc. */
  onPlay: (from: StartFrom, signal: AbortSignal) => Promise<unknown>;
};

/** The poster card's main button (library-search.pen R6YK4t, SHz4g, VJ6EH); it goes in the card's `action` slot. */
export function PlayAction({ mode, label, name, resumeAtMs, plexUrl, onPlay }: PlayActionProps) {
  const [running, setRunning] = useState<AbortController | null>(null);

  // Esc cancels the wait; leaving the page cancels it too.
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

  if (mode === 'plex-web') {
    return (
      <Button
        nativeButton={false}
        render={<a href={plexUrl} target="_blank" rel="noreferrer" />}
        icon={<ExternalLink aria-hidden="true" />}
        aria-label={`Play in Plex: ${name}`}
      >
        Play in Plex
      </Button>
    );
  }

  const start = (from: StartFrom) => {
    const controller = new AbortController();
    setRunning(controller);
    onPlay(from, controller.signal)
      .catch(() => undefined)
      .finally(() => setRunning((current) => (current === controller ? null : current)));
  };
  const button = (props: object) => (
    <Button icon={<Play aria-hidden="true" />} loading={running !== null} aria-label={`${label}: ${name}`} {...props}>{label}</Button>
  );

  if (resumeAtMs === null) return button({ onClick: () => start('start') });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={button({})} />
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Start</DropdownMenuGroupLabel>
          <DropdownMenuItem onClick={() => start('resume')}>Resume from {clockText(resumeAtMs)}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => start('start')}>Play from the start</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
