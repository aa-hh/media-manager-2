import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleAlert, HardDriveDownload, RefreshCw, RotateCcw, ServerOff, Settings, SkipForward, Timer, Type } from 'lucide-react';
import { fn } from 'storybook/test';
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
} from '@/components/ui/dropdown-menu';
import { LineSavedToPlex } from '@/components/ui/line-saved-to-plex';
import { PlayerError } from '@/components/ui/player-error';
import { PlayerStage } from '@/components/ui/player-stage';
import { PlayerUpNext } from '@/components/ui/player-up-next';
import { StepperSubtitleTiming } from '@/components/ui/stepper-subtitle-timing';

// Sample pictures built in place, so the stories need no image server.
const picture = (top: string, bottom: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/></svg>`,
)}`;
const arrival = picture('#41556b', '#a9b4bf');
const shogun = picture('#1f3329', '#4b5a3c');

// Shōgun S1 E4 at 18:40 of 58:12, the episode the menu states use.
const episode = {
  picture: <img src={shogun} alt="" />,
  title: 'Shōgun',
  subtitle: 'S1 E4 · The Eightfold Fence',
  position: 1120,
  duration: 3492,
  loadedAhead: 108,
  subtitlesLabel: 'English',
  audioLabel: 'Japanese 5.1',
  previous: { still: shogun, label: 'Previous · S1 E3', title: 'Tomorrow Is Tomorrow', onSelect: fn() },
  next: { still: shogun, label: 'Next · S1 E5', title: 'Broken to the Fist', onSelect: fn() },
};

const menu = { onDark: true, side: 'top', align: 'end', sideOffset: 8 } as const;

const subtitleTracks = (
  <DropdownMenuGroup>
    <DropdownMenuGroupLabel>Subtitles</DropdownMenuGroupLabel>
    <DropdownMenuRadioGroup defaultValue="en">
      <DropdownMenuRadioItem value="off" kbd="C">Off</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="en">English · SRT</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="en-forced">English, forced · SRT</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="en-sdh">English, hearing impaired · PGS</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="es">Spanish · SRT</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="fr">French · PGS</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuGroup>
);

// The Timing row opens the timing submenu (state 7); the Text size submenu is not drawn, so it stays empty and closed.
const timing = (open: boolean) => (
  <DropdownMenuSubmenu defaultOpen={open}>
    <DropdownMenuSubmenuTrigger icon={<Timer />}>Timing · +0.5 s</DropdownMenuSubmenuTrigger>
    <DropdownMenuContent onDark side="left" align="end" sideOffset={8} className="w-70">
      <DropdownMenuGroup>
        <DropdownMenuGroupLabel>Subtitle timing</DropdownMenuGroupLabel>
        <StepperSubtitleTiming offset={0.5} onEarlier={fn()} onLater={fn()} />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={<RotateCcw />}>Reset to 0.0 s</DropdownMenuItem>
      <DropdownMenuSeparator />
      <LineSavedToPlex>Saved to Plex on this subtitle track.</LineSavedToPlex>
    </DropdownMenuContent>
  </DropdownMenuSubmenu>
);
const textSize = (
  <DropdownMenuSubmenu>
    <DropdownMenuSubmenuTrigger icon={<Type />}>Text size · Medium</DropdownMenuSubmenuTrigger>
    <DropdownMenuContent onDark side="left" />
  </DropdownMenuSubmenu>
);

const meta = {
  title: 'Overlays & bars/PlayerStage',
  component: PlayerStage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="h-180 w-320"><Story /></div>],
  args: {
    picture: <img src={arrival} alt="" />,
    title: 'Arrival',
    subtitle: '2016 · 1 h 56 min',
    format: 'HDR10, colours adjusted for this screen',
    position: 2832,
    duration: 6952,
    loadedAhead: 590,
    playing: true,
    subtitlesLabel: 'English',
    audioLabel: 'English 7.1',
    qualityLabel: 'Original',
    onBack: fn(),
    onPlayPause: fn(),
    onBack10: fn(),
    onForward30: fn(),
    onVolume: fn(),
    onMini: fn(),
    onFullscreen: fn(),
    onSeek: fn(),
  },
} satisfies Meta<typeof PlayerStage>;

export default meta;
type Story = StoryObj<typeof meta>;

// 1 · Playing: controls shown, the grey part of the line past the dot is what has loaded ahead.
export const Playing: Story = {};

// 2 · Controls hidden: only the picture.
export const ControlsHidden: Story = { args: { controls: 'none' } };

// 3 · Opening, before the first frame: dimmed backdrop, one line, and a second after 3 s; no timeline.
export const Opening: Story = {
  args: {
    controls: 'top',
    dim: 0.55,
    subtitle: '2016 · from 47:12',
    centre: { text: 'Starting the original file from Plex', detail: <span className="font-ui">Plex is slow to answer. Still trying.</span> },
  },
};

// 4 · Buffering mid-play: the spinner over the last frame, the timeline stays.
export const Buffering: Story = { args: { dim: 0.35, playing: false, loadedAhead: 2, centre: { text: 'Loading from Plex', detail: '2 s ready of 2 min' } } };

// 5 · Audio menu, saved to Plex.
export const AudioMenu: Story = {
  args: {
    ...episode,
    format: undefined,
    openMenu: 'audio',
    menus: {
      audio: (
        <DropdownMenuContent {...menu} className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Audio</DropdownMenuGroupLabel>
            <DropdownMenuRadioGroup defaultValue="ja">
              <DropdownMenuRadioItem value="ja">Japanese · Dolby Digital 5.1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="en">English · Dolby Digital 5.1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="ja-ad">Japanese · Audio description, stereo</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <LineSavedToPlex>Saved to Plex for this episode, so your other Plex apps play it the same way.</LineSavedToPlex>
        </DropdownMenuContent>
      ),
    },
  },
};

// 6 · Subtitles menu, saved to Plex.
export const SubtitlesMenu: Story = {
  args: {
    ...episode,
    format: undefined,
    openMenu: 'subtitles',
    menus: {
      subtitles: (
        <DropdownMenuContent {...menu} className="w-75">
          {subtitleTracks}
          <DropdownMenuSeparator />
          {timing(false)}
          {textSize}
          <DropdownMenuSeparator />
          <LineSavedToPlex>Saved to Plex for this episode, so your other Plex apps show the same subtitles.</LineSavedToPlex>
        </DropdownMenuContent>
      ),
    },
  },
};

// 7 · Subtitle timing: the Timing submenu open beside the Subtitles menu.
export const SubtitleTiming: Story = {
  args: {
    ...episode,
    format: undefined,
    openMenu: 'subtitles',
    menus: {
      subtitles: (
        <DropdownMenuContent {...menu} className="w-75">
          {subtitleTracks}
          <DropdownMenuSeparator />
          {timing(true)}
          {textSize}
        </DropdownMenuContent>
      ),
    },
  },
};

// 8 · Quality menu on a 4K HEVC file: Original ticked, the conversion steps under it.
export const QualityMenu: Story = {
  args: {
    picture: <img src={picture('#2a1a10', '#8a4b22')} alt="" />,
    title: 'Oppenheimer',
    subtitle: '2023 · 2160p HEVC',
    format: 'Dolby Vision, colours adjusted for this screen',
    position: 3734,
    duration: 10820,
    openMenu: 'quality',
    menus: {
      quality: (
        <DropdownMenuContent {...menu} className="w-85">
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Quality</DropdownMenuGroupLabel>
            <DropdownMenuRadioGroup defaultValue="original">
              {['Original · 2160p HEVC, 58 Mbps', '1080p · 20 Mbps', '1080p · 12 Mbps', '1080p · 10 Mbps', '1080p · 8 Mbps', '720p · 4 Mbps', '720p · 3 Mbps', '720p · 2 Mbps', '480p · 1.5 Mbps', '320p · 720 kbps'].map((step, index) => (
                <DropdownMenuRadioItem key={step} value={index === 0 ? 'original' : step}>{step}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <p className="p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground">Original plays the file as it is. A lower step asks Plex to convert it, starting again at the same second.</p>
        </DropdownMenuContent>
      ),
    },
  },
};

// 9 · Load ahead in the gear menu, its submenu open.
export const LoadAhead: Story = {
  args: {
    loadedAhead: 108,
    openMenu: 'settings',
    menus: {
      settings: (
        <DropdownMenuContent {...menu} className="w-65">
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Player</DropdownMenuGroupLabel>
            <DropdownMenuSubmenu defaultOpen>
              <DropdownMenuSubmenuTrigger icon={<HardDriveDownload />}>Load ahead · 2 min</DropdownMenuSubmenuTrigger>
              <DropdownMenuContent onDark side="left" align="end" sideOffset={8} className="w-75">
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>Load ahead</DropdownMenuGroupLabel>
                  <DropdownMenuRadioGroup defaultValue="2 min">
                    {['30 s', '1 min', '2 min', '5 min', '10 min'].map((value) => <DropdownMenuRadioItem key={value} value={value}>{value}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <p className="p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground">1 min 48 s loaded now. More rides out a slow connection to the server; the player uses more memory to hold it.</p>
                <p className="flex gap-2 p-2 font-ui text-xs leading-[1.45] text-bar-muted-foreground"><Settings aria-hidden="true" className="size-4 shrink-0" />Also in Settings, Playback.</p>
              </DropdownMenuContent>
            </DropdownMenuSubmenu>
            {textSize}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      ),
    },
  },
};

// 10 · Skip intro with the controls hidden: bottom right; S presses it.
export const SkipIntro: Story = {
  args: {
    ...episode,
    controls: 'none',
    children: <Button variant="on-video" size="large" icon={<SkipForward />} kbd="S" onClick={fn()} className="absolute right-6 bottom-6">Skip intro</Button>,
  },
};

// 11 · Scrubbing: the preview picture, the time and the chapter; gaps for chapters, short lines for the intro and the credits.
export const Scrubbing: Story = {
  args: {
    ...episode,
    format: undefined,
    scrubAt: 2445,
    scrubImage: shogun,
    onScrub: fn(),
    chapters: [0, 300, 620, 970, 1350, 1755, 1990, 2370, 2690].map((start, index) => ({ start, title: index === 5 ? 'Chapter 6 · The council' : `Chapter ${index + 1}` })),
    markers: [{ start: 50, end: 140 }, { start: 3330, end: 3480 }],
  },
};

// 12 · Play queue: Previous and Next show on an episode; the stories hover Next to show the item it plays.
export const PlayQueue: Story = {
  args: { ...episode, format: undefined },
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button', { name: 'Next' }));
  },
};

// 13 · Error after the player stepped down through every way of playing.
export const PlaybackError: Story = {
  args: {
    dim: 0.7,
    position: 3734,
    duration: 6960,
    loadedAhead: 0,
    playing: false,
    qualityLabel: 'Converted',
    children: (
      <div className="absolute inset-0 flex items-center justify-center pb-20">
        <PlayerError
          icon={<CircleAlert />}
          title="Playback stopped at 1:02:14"
          body="Plex stopped sending Arrival and every way of playing it failed. Your place is saved."
          detail="Tried: original file → repackaged by Plex → converted → converted with audio"
          actions={(
            <>
              <Button icon={<RefreshCw />} onClick={fn()}>Retry</Button>
              <Button variant="outline-on-dark" onClick={fn()}>Close player</Button>
            </>
          )}
        />
      </div>
    ),
  },
};

// 14 · Can't reach Plex: the picture freezes and dims; Try again also runs by itself every 10 s.
export const CantReachPlex: Story = {
  args: {
    dim: 0.7,
    format: undefined,
    loadedAhead: 0,
    playing: false,
    children: (
      <div className="absolute inset-0 flex items-center justify-center pb-20">
        <PlayerError
          icon={<ServerOff />}
          title="Can't reach Plex"
          body="Playback stopped at 47:12. Your place is saved and reaches Plex when it answers."
          detail="No answer from Plex for 40 s · next try in 8 s"
          actions={(
            <>
              <Button icon={<RefreshCw />} onClick={fn()}>Try again</Button>
              <Button variant="outline-on-dark" onClick={fn()}>Close player</Button>
            </>
          )}
          className="w-125"
        />
      </div>
    ),
  },
};

// 15 · Up Next countdown on black: Play now has focus, Esc goes back to the library.
export const UpNextCountdown: Story = {
  args: {
    ...episode,
    picture: undefined,
    controls: 'top',
    children: (
      <PlayerUpNext
        heading="Next episode"
        countdown={{ seconds: 8, fraction: 0.8 }}
        still={shogun}
        show="Shōgun"
        episode="S1 E5 · Broken to the Fist"
        facts="56 min"
        summary="Placeholder summary of the episode. Two lines at most, so the block keeps the same height from one episode to the next."
        onPlayNow={fn()}
        wayOut="Back to library"
        onWayOut={fn()}
        className="absolute top-46.5 left-60"
      />
    ),
  },
};

// 16 · Up Next while the next episode is still downloading: the steps, no countdown, Stop waiting.
export const UpNextDownloading: Story = {
  args: {
    ...episode,
    picture: undefined,
    controls: 'top',
    children: (
      <PlayerUpNext
        heading="Next episode"
        waiting="Starts when it's ready"
        still={shogun}
        show="Shōgun"
        episode="S1 E5 · Broken to the Fist"
        facts="56 min"
        summary="Placeholder summary of the episode. Two lines at most, so the block keeps the same height from one episode to the next."
        steps={[
          { label: 'Downloading', detail: '64% · 12 MB/s · about 3 min left', active: true, progress: 64 },
          { label: 'Importing', detail: 'Moves the file into the library' },
          { label: 'Waiting for Plex', detail: "Plex hasn't found the file yet" },
          { label: 'Plex is analysing', detail: 'Reads the file so it can play' },
        ]}
        note="Stop waiting goes back to the library. The download carries on and nothing is deleted."
        wayOut="Stop waiting"
        onWayOut={fn()}
        className="absolute top-22.5 left-60"
      />
    ),
  },
};
