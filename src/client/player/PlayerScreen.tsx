// The player's look in each state, built from the player components; Player.tsx owns the state and the bridge.
import { CircleAlert, HardDriveDownload, RefreshCw, RotateCcw, ServerOff, Settings, SkipForward, Timer } from 'lucide-react';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSubmenu,
  DropdownMenuSubmenuTrigger,
  DropdownMenuToggleGroup,
  DropdownMenuToggleGroupItem,
} from '@/components/ui/dropdown-menu';
import { LineSavedToPlex } from '@/components/ui/line-saved-to-plex';
import { PlayerError } from '@/components/ui/player-error';
import { PlayerMini } from '@/components/ui/player-mini';
import { formatTime, PlayerStage, type PlayerMenu, type PlayerQueueItem } from '@/components/ui/player-stage';
import { PlayerUpNext, type UpNextStep } from '@/components/ui/player-up-next';
import { StepperSubtitleTiming } from '@/components/ui/stepper-subtitle-timing';
import { cn } from '@/lib/utils';
import {
  LOAD_AHEAD, SUBTITLE_SIZES, durationWords, stepLabel, subtitleSizeState, trackButtonLabel, trackRowLabel,
  type AudioTrack, type QualityStep, type Screen, type SubtitleTrack,
} from './model';

export type UpNextView = {
  /** Seconds left of the countdown; left out while the next episode is still on its way. */
  countdown?: number;
  still?: string;
  show: string;
  episode: string;
  facts: string;
  summary?: string;
  steps?: UpNextStep[];
  onPlayNow?: () => void;
};

export type PlayerScreenProps = {
  layout: 'full' | 'mini';
  screen: Screen;
  rootRef?: Ref<HTMLDivElement>;
  name: string;
  subtitle?: string;
  position: number;
  duration: number;
  loadedAhead: number;
  playing: boolean;
  /** all, top (opening and Up Next) or none (hidden after 3 s still). */
  controls: 'all' | 'top' | 'none';
  /** The opening line, and whether 3 s have passed without the first frame. */
  opening: { text: string; slow: boolean };
  /** The Load ahead choice's value from LOAD_AHEAD. */
  loadAhead: string;
  chapters?: { start: number; title: string }[];
  markers?: { start: number; end: number }[];
  scrubAt?: number;
  scrubImage?: string;
  previous?: PlayerQueueItem;
  next?: PlayerQueueItem;
  audio: { tracks: AudioTrack[]; saved: boolean };
  /** `size`: the subtitle text size as mpv's sub-scale; left out when the desktop app cannot set it, which hides the Text size row. */
  subtitles: { tracks: SubtitleTrack[]; saved: boolean; delay: number; delaySaved: boolean; size?: number };
  /** 0 to 100, and whether mpv is muted. */
  volume: number;
  muted: boolean;
  quality: { steps: QualityStep[]; kbps?: number; label: string };
  skip?: { kind: 'intro' | 'credits'; visible: boolean; raised: boolean };
  /** State 13: the sentence, and what was tried when the desktop app stepped down. */
  failure?: { body: string; detail?: string };
  /** State 14, in seconds. */
  unreachable?: { downFor: number; nextTryIn: number };
  upNext?: UpNextView;
  openMenu?: PlayerMenu;
  onOpenMenuChange: (menu: PlayerMenu | undefined) => void;
  onBack: () => void;
  onPlayPause: () => void;
  onBack10: () => void;
  onForward30: () => void;
  /** The Volume button's click, and M: mutes and unmutes. */
  onVolume: () => void;
  onVolumeChange: (percent: number) => void;
  onVolumeWheel: (deltaY: number) => void;
  onVolumeOpenChange: (open: boolean) => void;
  onMini: () => void;
  onExpand: () => void;
  onFullscreen: () => void;
  onSeek: (seconds: number) => void;
  onScrub: (seconds: number | undefined) => void;
  onAudio: (track: AudioTrack) => void;
  /** null is Off. */
  onSubtitle: (track: SubtitleTrack | null) => void;
  /** 0.1 s steps; 'reset' goes back to 0. */
  onSubtitleDelay: (change: number | 'reset') => void;
  /** One of SUBTITLE_SIZES' scales. */
  onSubtitleSize: (scale: number) => void;
  /** undefined is Original. */
  onQuality: (kbps: number | undefined) => void;
  onLoadAhead: (value: string) => void;
  onSkip: () => void;
  onRetry: () => void;
  onTryAgain: () => void;
  onClose: () => void;
  /** Up Next's way out: Back to library, or Stop waiting. */
  onUpNextOut: () => void;
  className?: string;
};

const menu = { onDark: true, side: 'top', align: 'end', sideOffset: 8 } as const;
const ORIGINAL = 'original';
const OFF = 'off';

const centred = 'absolute inset-0 flex items-center justify-center';

/** Full size fills the window; mini sits bottom right above the downloads bar. One element either way, so it never remounts. */
export function PlayerScreen(props: PlayerScreenProps) {
  const {
    layout, screen, rootRef, name, subtitle, position, duration, loadedAhead, playing, controls, opening, loadAhead, chapters, markers,
    scrubAt, scrubImage, previous, next, audio, subtitles, quality, skip, failure, unreachable, upNext, openMenu, onOpenMenuChange,
  } = props;
  // The picture comes from mpv's window below, so the stage stays see-through except before the first frame and on Up Next.
  const seeThrough = screen !== 'opening' && screen !== 'up-next';
  const selectedAudio = audio.tracks.find((track) => track.selected);
  const selectedSubtitle = subtitles.tracks.find((track) => track.selected);
  const loadAheadLabel = LOAD_AHEAD.find((option) => option.value === loadAhead)?.label ?? '';
  const sizeState = subtitleSizeState(selectedSubtitle);

  if (layout === 'mini') {
    return (
      <div ref={rootRef} data-player-root className={cn('fixed right-(--page-margin) bottom-[calc(var(--livebar)+16px)] z-30', props.className)}>
        <PlayerMini
          title={name}
          time={`${formatTime(position)} / ${formatTime(duration)}`}
          progress={duration > 0 ? (position / duration) * 100 : 0}
          playing={playing}
          muted={props.muted}
          onMute={props.onVolume}
          onPlayPause={props.onPlayPause}
          onExpand={props.onExpand}
          onClose={props.onClose}
          className={seeThrough ? 'bg-transparent' : undefined}
        />
      </div>
    );
  }

  const menus = {
    audio: (
      <DropdownMenuContent {...menu} className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Audio</DropdownMenuGroupLabel>
          <DropdownMenuRadioGroup
            value={selectedAudio?.index ?? null}
            onValueChange={(value) => {
              const track = audio.tracks.find((candidate) => candidate.index === value);
              if (track !== undefined) props.onAudio(track);
            }}
          >
            {audio.tracks.map((track) => <DropdownMenuRadioItem key={track.index} value={track.index}>{trackRowLabel(track)}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        {audio.saved && (
          <>
            <DropdownMenuSeparator />
            <LineSavedToPlex>Saved to Plex for this title, so your other Plex apps play it the same way.</LineSavedToPlex>
          </>
        )}
      </DropdownMenuContent>
    ),
    subtitles: (
      <DropdownMenuContent {...menu} className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Subtitles</DropdownMenuGroupLabel>
          <DropdownMenuRadioGroup
            value={selectedSubtitle === undefined ? OFF : String(selectedSubtitle.id)}
            onValueChange={(value) => props.onSubtitle(subtitles.tracks.find((track) => String(track.id) === value) ?? null)}
          >
            <DropdownMenuRadioItem value={OFF}>Off</DropdownMenuRadioItem>
            {subtitles.tracks.map((track) => <DropdownMenuRadioItem key={String(track.id)} value={String(track.id)}>{trackRowLabel(track)}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSubmenu>
          <DropdownMenuSubmenuTrigger icon={<Timer />} disabled={selectedSubtitle === undefined}>
            Timing · {subtitles.delay > 0 ? '+' : ''}{subtitles.delay.toFixed(1)} s
          </DropdownMenuSubmenuTrigger>
          <DropdownMenuContent onDark side="left" align="end" sideOffset={8} className="w-70">
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>Subtitle timing</DropdownMenuGroupLabel>
              <StepperSubtitleTiming offset={subtitles.delay} onEarlier={() => props.onSubtitleDelay(-0.1)} onLater={() => props.onSubtitleDelay(0.1)} />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem icon={<RotateCcw />} closeOnClick={false} onClick={() => props.onSubtitleDelay('reset')}>Reset to 0.0 s</DropdownMenuItem>
            {subtitles.delaySaved && (
              <>
                <DropdownMenuSeparator />
                <LineSavedToPlex>Saved to Plex on this subtitle track.</LineSavedToPlex>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenuSubmenu>
        {subtitles.size !== undefined && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>Text size</DropdownMenuGroupLabel>
              {/* Picture subtitles (PGS, VobSub) ignore mpv's sub-scale, so the row stays at the saved size but greyed. */}
              <div className="px-2 pt-0.5 pb-1.5">
                <DropdownMenuToggleGroup value={subtitles.size} onValueChange={(value) => props.onSubtitleSize(Number(value))} disabled={sizeState !== 'text'}>
                  {SUBTITLE_SIZES.map((size) => <DropdownMenuToggleGroupItem key={size.scale} value={size.scale}>{size.label}</DropdownMenuToggleGroupItem>)}
                </DropdownMenuToggleGroup>
              </div>
              {sizeState === 'picture' && <p className="p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground">Picture subtitles have a fixed size.</p>}
            </DropdownMenuGroup>
          </>
        )}
        {subtitles.saved && (
          <>
            <DropdownMenuSeparator />
            <LineSavedToPlex>Saved to Plex for this title, so your other Plex apps show the same subtitles.</LineSavedToPlex>
          </>
        )}
      </DropdownMenuContent>
    ),
    quality: (
      <DropdownMenuContent {...menu} className="w-85">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Quality</DropdownMenuGroupLabel>
          <DropdownMenuRadioGroup
            value={quality.kbps === undefined ? ORIGINAL : String(quality.kbps)}
            onValueChange={(value) => props.onQuality(value === ORIGINAL ? undefined : Number(value))}
          >
            <DropdownMenuRadioItem value={ORIGINAL}>Original</DropdownMenuRadioItem>
            {[...quality.steps].reverse().map((step) => <DropdownMenuRadioItem key={step.kbps} value={String(step.kbps)}>{stepLabel(step)}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <p className="p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground">Original plays the file as it is. A lower step asks Plex to convert it, starting again at the same second.</p>
      </DropdownMenuContent>
    ),
    settings: (
      <DropdownMenuContent {...menu} className="w-65">
        <DropdownMenuGroup>
          <DropdownMenuGroupLabel>Player</DropdownMenuGroupLabel>
          <DropdownMenuSubmenu>
            <DropdownMenuSubmenuTrigger icon={<HardDriveDownload />}>Load ahead · {loadAheadLabel}</DropdownMenuSubmenuTrigger>
            <DropdownMenuContent onDark side="left" align="end" sideOffset={8} className="w-75">
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel>Load ahead</DropdownMenuGroupLabel>
                <DropdownMenuRadioGroup value={loadAhead} onValueChange={(value) => props.onLoadAhead(String(value))}>
                  {LOAD_AHEAD.map((option) => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <p className="p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground">{durationWords(loadedAhead)} loaded now. More rides out a slow connection to the server; the player uses more memory to hold it.</p>
              <p className="flex gap-2 p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground"><Settings aria-hidden="true" className="size-4 shrink-0" />Also in Settings, Playback.</p>
            </DropdownMenuContent>
          </DropdownMenuSubmenu>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    ),
  };

  const closeButton = <Button variant="outline-on-dark" onClick={props.onClose}>Close player</Button>;

  return (
    <div ref={rootRef} data-player-root className={cn('fixed inset-0 z-40', controls === 'none' && 'cursor-none', props.className)}>
      <PlayerStage
        className={seeThrough ? 'bg-transparent' : undefined}
        dim={screen === 'opening' ? 0.55 : screen === 'buffering' ? 0.35 : screen === 'error' || screen === 'unreachable' ? 0.7 : undefined}
        controls={screen === 'opening' || screen === 'up-next' ? 'top' : controls}
        title={name}
        subtitle={subtitle}
        centre={screen === 'opening'
          ? { text: opening.text, detail: opening.slow ? <span className="font-ui">Plex is slow to answer. Still trying.</span> : undefined }
          : screen === 'buffering'
            ? { text: 'Loading from Plex', detail: `${durationWords(loadedAhead)} ready of ${loadAheadLabel}` }
            : undefined}
        position={position}
        duration={duration}
        loadedAhead={loadedAhead}
        chapters={chapters}
        markers={markers}
        scrubAt={scrubAt}
        scrubImage={scrubImage}
        playing={playing}
        previous={previous}
        next={next}
        subtitlesLabel={trackButtonLabel(selectedSubtitle, 'Off')}
        audioLabel={trackButtonLabel(selectedAudio, 'Audio')}
        qualityLabel={quality.label}
        menus={menus}
        openMenu={openMenu}
        onOpenMenuChange={onOpenMenuChange}
        onBack={props.onBack}
        onPlayPause={props.onPlayPause}
        onBack10={props.onBack10}
        onForward30={props.onForward30}
        volume={props.volume}
        muted={props.muted}
        onVolume={props.onVolume}
        onVolumeChange={props.onVolumeChange}
        onVolumeWheel={props.onVolumeWheel}
        onVolumeOpenChange={props.onVolumeOpenChange}
        onMini={props.onMini}
        onFullscreen={props.onFullscreen}
        onSeek={props.onSeek}
        onScrub={props.onScrub}
      >
        {skip !== undefined && screen === 'playing' && (
          <Button
            variant="on-video"
            size="large"
            icon={<SkipForward />}
            kbd="S"
            onClick={props.onSkip}
            className={cn(
              'absolute right-6 transition-opacity duration-(--duration-base) ease-out',
              skip.raised ? 'bottom-32' : 'bottom-6',
              !skip.visible && 'pointer-events-none opacity-0',
            )}
          >
            {skip.kind === 'intro' ? 'Skip intro' : 'Skip credits'}
          </Button>
        )}
        {screen === 'error' && failure !== undefined && (
          <div className={cn(centred, 'pb-20')}>
            <PlayerError
              icon={<CircleAlert />}
              title={`Playback stopped at ${formatTime(position)}`}
              body={failure.body}
              detail={failure.detail}
              actions={<><Button icon={<RefreshCw />} onClick={props.onRetry}>Retry</Button>{closeButton}</>}
            />
          </div>
        )}
        {screen === 'unreachable' && unreachable !== undefined && (
          <div className={cn(centred, 'pb-20')}>
            <PlayerError
              icon={<ServerOff />}
              title="Can't reach Plex"
              body={`Playback stopped at ${formatTime(position)}. Your place is saved and reaches Plex when it answers.`}
              detail={`No answer from Plex for ${durationWords(unreachable.downFor)} · next try in ${durationWords(unreachable.nextTryIn)}`}
              actions={<><Button icon={<RefreshCw />} onClick={props.onTryAgain}>Try again</Button>{closeButton}</>}
              className="w-125"
            />
          </div>
        )}
        {screen === 'up-next' && upNext !== undefined && (
          <div className={centred}>
            <PlayerUpNext
              heading="Next episode"
              countdown={upNext.countdown === undefined ? undefined : { seconds: upNext.countdown, fraction: upNext.countdown / 10 }}
              waiting="Starts when it's ready"
              still={upNext.still}
              show={upNext.show}
              episode={upNext.episode}
              facts={upNext.facts}
              summary={upNext.summary}
              steps={upNext.steps}
              note={upNext.steps === undefined ? undefined : 'Stop waiting goes back to the library. The download carries on and nothing is deleted.'}
              onPlayNow={upNext.onPlayNow}
              wayOut={upNext.onPlayNow === undefined ? 'Stop waiting' : 'Back to library'}
              onWayOut={props.onUpNextOut}
            />
          </div>
        )}
      </PlayerStage>
      {/* Over the stage for the window's drag area only; clicks fall through to the buttons under it (player.css). */}
      <div aria-hidden="true" className="player-drag pointer-events-none absolute inset-x-0 top-0 h-18" />
    </div>
  );
}
