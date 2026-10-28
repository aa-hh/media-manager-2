// Figma: PlayerStage — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=114-725
import { Slider } from '@base-ui/react/slider';
import {
  AudioLines, Captions, ChevronLeft, Gauge, Maximize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Settings, SkipBack, SkipForward,
} from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlayerScrubPreview } from '@/components/ui/player-scrub-preview';
import { Spinner } from '@/components/ui/spinner';
import { TooltipNext } from '@/components/ui/tooltip-next';
import { VolumeButton } from '@/components/ui/volume-popover';
import { cn } from '@/lib/utils';

type PlayerMenu = 'subtitles' | 'audio' | 'quality' | 'settings';

type PlayerQueueItem = {
  still?: string;
  /** "Next · S1 E5". */
  label: ReactNode;
  title: ReactNode;
  onSelect: () => void;
};

type PlayerStageProps = {
  /** The picture; in the desktop app the video shows through from mpv's window below, so leave it out. */
  picture?: ReactNode;
  /** Black over the picture: 0.55 while opening, 0.35 while buffering, 0.7 on an error. */
  dim?: number;
  /** all: scrims, top bar and controls. top: the top bar only (opening, Up Next). none: only the picture (controls hidden). */
  controls?: 'all' | 'top' | 'none';
  title: ReactNode;
  /** "2016 · 1 h 56 min" or "S1 E4 · The Eightfold Fence". */
  subtitle?: ReactNode;
  /** Only for HDR and Dolby Vision files: "HDR10, colours adjusted for this screen". */
  format?: ReactNode;
  /** The spinner line in the middle: opening and buffering. */
  centre?: { text: ReactNode; detail?: ReactNode };
  /** Seconds. */
  position: number;
  duration: number;
  /** Seconds loaded past the position: the grey part of the line after the dot. */
  loadedAhead?: number;
  /** Chapter starts in seconds: a gap in the line at each one, and the name in the scrubbing preview. */
  chapters?: { start: number; title: string }[];
  /** Intro and credits markers in seconds: short light lines above the timeline. */
  markers?: { start: number; end: number }[];
  /** Second under the pointer while hovering or dragging the timeline: the hover line and the preview. */
  scrubAt?: number;
  /** Plex's preview picture for scrubAt. */
  scrubImage?: string;
  playing: boolean;
  /** Previous and Next through the Plex play queue; both hidden on a movie with nothing queued. */
  previous?: PlayerQueueItem;
  next?: PlayerQueueItem;
  /** The current choice on each labelled button: "English", "Japanese 5.1", "Original". */
  subtitlesLabel: string;
  audioLabel: string;
  qualityLabel: string;
  /** A DropdownMenuContent with onDark for each button that opens a menu. */
  menus?: Partial<Record<PlayerMenu, ReactNode>>;
  /** The open menu. Without onOpenMenuChange it is only the menu open at first. */
  openMenu?: PlayerMenu;
  onOpenMenuChange?: (menu: PlayerMenu | undefined) => void;
  onBack: () => void;
  onPlayPause: () => void;
  onBack10: () => void;
  onForward30: () => void;
  /** 0 to 100, and whether mpv is muted: the slider, its readout and the speaker (crossed out while muted). */
  volume: number;
  muted: boolean;
  /** The Volume button's click: mutes and unmutes. */
  onVolume: () => void;
  onVolumeChange: (percent: number) => void;
  /** The mouse wheel over the Volume button or its slider, as the event's deltaY. */
  onVolumeWheel?: (deltaY: number) => void;
  /** Whether the volume slider shows, so the controls stay up meanwhile. */
  onVolumeOpenChange?: (open: boolean) => void;
  /** Open the volume slider at first (stories). */
  volumeOpen?: boolean;
  onMini: () => void;
  onFullscreen: () => void;
  onSeek: (seconds: number) => void;
  onScrub?: (seconds: number | undefined) => void;
  /** Overlays drawn over the stage and placed by the caller: Skip intro, the error block, Up Next. */
  children?: ReactNode;
  className?: string;
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** 47:12 under an hour, 1:08:40 from an hour. */
function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${minutes}:${pad(total % 60)}`;
}

/**
 * The player, filling its parent (1280 by 720 in the design): the picture, the top and bottom scrims, the top bar with Back,
 * title and format, the timeline with what has loaded ahead, chapter gaps and intro and credits markers, and the buttons row.
 */
function PlayerStage({
  picture, dim, controls = 'all', title, subtitle, format, centre, position, duration, loadedAhead = 0, chapters, markers, scrubAt, scrubImage,
  playing, previous, next, subtitlesLabel, audioLabel, qualityLabel, menus, openMenu, onOpenMenuChange,
  onBack, onPlayPause, onBack10, onForward30, volume, muted, onVolume, onVolumeChange, onVolumeWheel, onVolumeOpenChange, volumeOpen,
  onMini, onFullscreen, onSeek, onScrub, children, className,
}: PlayerStageProps) {
  const span = Math.max(1, duration);
  const at = (seconds: number) => `${(Math.min(span, Math.max(0, seconds)) / span) * 100}%`;
  const scrubChapter = scrubAt === undefined ? undefined : chapters?.filter((chapter) => chapter.start <= scrubAt).at(-1)?.title;

  const withMenu = (menu: PlayerMenu, button: ReactElement) => {
    const content = menus?.[menu];
    if (content === undefined) return button;
    const open = onOpenMenuChange === undefined
      ? { defaultOpen: openMenu === menu }
      : { open: openMenu === menu, onOpenChange: (isOpen: boolean) => onOpenMenuChange(isOpen ? menu : undefined) };
    return (
      <DropdownMenu {...open}>
        <DropdownMenuTrigger render={button} />
        {content}
      </DropdownMenu>
    );
  };

  const queueButton = (item: PlayerQueueItem, icon: ReactNode, name: string) => (
    <TooltipNext still={item.still} label={item.label} title={item.title}>
      <Button variant="on-dark" iconOnly icon={icon} aria-label={name} onClick={item.onSelect} />
    </TooltipNext>
  );

  return (
    <div className={cn('relative size-full overflow-hidden bg-black', className)}>
      {picture !== undefined && <div className="absolute inset-0 [&>img]:size-full [&>img]:object-cover">{picture}</div>}
      {dim !== undefined && <div aria-hidden="true" style={{ opacity: dim }} className="absolute inset-0 bg-black" />}
      {controls !== 'none' && (
        <>
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-[#000000a6] to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-70 bg-linear-to-b from-transparent to-[#000000d9]" />
          <div className="absolute inset-x-6 top-5 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Button variant="on-dark" iconOnly icon={<ChevronLeft />} aria-label="Back" onClick={onBack} className="w-9" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-ui text-base font-bold text-foreground-on-dark">{title}</span>
                {subtitle !== undefined && <span className="truncate font-ui text-[13px] text-muted-foreground-on-dark">{subtitle}</span>}
              </div>
            </div>
            {format !== undefined && <span className="shrink-0 font-ui text-xs font-medium text-muted-foreground-on-dark">{format}</span>}
          </div>
        </>
      )}
      {controls === 'all' && (
        <div className="absolute inset-x-6 bottom-12.25 flex flex-col gap-1.5">
          <div className="flex items-center gap-3 px-2.5">
            <span className="font-data text-sm font-medium text-foreground-on-dark">{formatTime(position)}</span>
            <Slider.Root value={position} min={0} max={span} step={1} onValueChange={(value) => onSeek(value)} className="flex-1">
              <Slider.Control
                onPointerMove={onScrub === undefined ? undefined : (event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  onScrub(Math.round((Math.min(box.width, Math.max(0, event.clientX - box.left)) / box.width) * span));
                }}
                onPointerLeave={onScrub === undefined ? undefined : () => onScrub(undefined)}
                className="relative flex h-3.5 w-full cursor-pointer touch-none items-center"
              >
                <Slider.Track className="relative h-1 w-full rounded-[2px] bg-input-on-dark">
                  <span aria-hidden="true" style={{ left: at(position), width: at(loadedAhead) }} className="absolute inset-y-0 bg-white/45" />
                  <Slider.Indicator className="rounded-l-[2px] bg-foreground-on-dark" />
                  {chapters?.filter((chapter) => chapter.start > 0).map((chapter) => (
                    <span key={chapter.start} aria-hidden="true" style={{ left: at(chapter.start) }} className="absolute -top-px h-1.5 w-0.75 -translate-x-1/2 bg-black" />
                  ))}
                  {markers?.map((marker) => (
                    <span
                      key={marker.start}
                      aria-hidden="true"
                      style={{ left: at(marker.start), width: at(marker.end - marker.start) }}
                      className="absolute -top-1.75 h-0.5 rounded-[1px] bg-mark-on-video"
                    />
                  ))}
                  {scrubAt !== undefined && <span aria-hidden="true" style={{ left: at(scrubAt) }} className="absolute -top-1 h-3 w-0.5 -translate-x-1/2 bg-white" />}
                  <Slider.Thumb
                    getAriaLabel={() => 'Position'}
                    getAriaValueText={(_, value) => formatTime(value)}
                    className="size-3.5 rounded-full bg-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-on-dark"
                  />
                </Slider.Track>
                {scrubAt !== undefined && (
                  // Centred on the second under the pointer, 20 px above the line.
                  <span style={{ left: at(scrubAt) }} className="absolute bottom-full mb-5 -translate-x-1/2">
                    <PlayerScrubPreview image={scrubImage} time={formatTime(scrubAt)} chapter={scrubChapter} />
                  </span>
                )}
              </Slider.Control>
            </Slider.Root>
            <span className="font-data text-sm font-medium text-muted-foreground-on-dark">-{formatTime(duration - position)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-0.5">
              {previous !== undefined && queueButton(previous, <SkipBack />, 'Previous')}
              <Button variant="on-dark" iconOnly icon={playing ? <Pause /> : <Play />} aria-label={playing ? 'Pause' : 'Play'} onClick={onPlayPause} className="w-11 [&>svg]:size-6" />
              {next !== undefined && queueButton(next, <SkipForward />, 'Next')}
              <Button variant="on-dark" iconOnly icon={<RotateCcw />} aria-label="Back 10 seconds" onClick={onBack10} />
              <Button variant="on-dark" iconOnly icon={<RotateCw />} aria-label="Forward 30 seconds" onClick={onForward30} />
              <VolumeButton
                volume={volume}
                muted={muted}
                onMute={onVolume}
                onVolumeChange={onVolumeChange}
                onWheel={onVolumeWheel}
                onOpenChange={onVolumeOpenChange}
                defaultOpen={volumeOpen}
              />
            </div>
            <div className="flex items-center gap-0.5">
              {withMenu('subtitles', <Button variant="on-dark" icon={<Captions />} aria-label={`Subtitles: ${subtitlesLabel}`}>{subtitlesLabel}</Button>)}
              {withMenu('audio', <Button variant="on-dark" icon={<AudioLines />} aria-label={`Audio: ${audioLabel}`}>{audioLabel}</Button>)}
              {withMenu('quality', <Button variant="on-dark" icon={<Gauge />} aria-label={`Quality: ${qualityLabel}`}>{qualityLabel}</Button>)}
              {withMenu('settings', <Button variant="on-dark" iconOnly icon={<Settings />} aria-label="Settings" />)}
              <Button variant="on-dark" iconOnly icon={<PictureInPicture2 />} aria-label="Mini player" onClick={onMini} />
              <Button variant="on-dark" iconOnly icon={<Maximize />} aria-label="Full screen" onClick={onFullscreen} />
            </div>
          </div>
        </div>
      )}
      {centre !== undefined && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Spinner className="size-10 text-foreground-on-dark" />
          <span className="font-ui text-[15px] font-semibold text-foreground-on-dark">{centre.text}</span>
          {centre.detail !== undefined && <span className="font-data text-sm text-muted-foreground-on-dark">{centre.detail}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export { formatTime, PlayerStage };
export type { PlayerMenu, PlayerQueueItem };
