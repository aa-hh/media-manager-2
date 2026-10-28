import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PlayerScreen } from '@/player/PlayerScreen';

// In the desktop app mpv's picture shows through the see-through stage; a gradient stands in for it here.
const picture = `linear-gradient(#1f3329, #4b5a3c)`;

const audio = [
  { id: 1, index: 0, ffIndex: 1, codec: 'ac3', language: 'Japanese', title: null, selected: true },
  { id: 2, index: 1, ffIndex: 2, codec: 'ac3', language: 'English', title: null, selected: false },
];
const subtitles = [
  { id: 3, index: 0, ffIndex: 3, codec: 'srt', language: 'English', title: null, selected: true, external: false, key: null, url: null },
  { id: 4, index: 0, ffIndex: null, codec: 'pgs', language: 'English', title: 'SDH', selected: false, external: true, key: '/library/streams/4', url: '/library/streams/4' },
];

const meta = {
  title: 'Screens/Player',
  component: PlayerScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div style={{ background: picture }} className="h-180 w-320"><Story /></div>],
  args: {
    layout: 'full',
    screen: 'playing',
    name: 'Shōgun',
    subtitle: 'S1 E4 · The Eightfold Fence',
    position: 1120,
    duration: 3492,
    loadedAhead: 108,
    playing: true,
    controls: 'all',
    opening: { text: 'Starting the original file from Plex', slow: false },
    loadAhead: '120',
    chapters: [{ start: 0, title: 'Chapter 1' }, { start: 970, title: 'Chapter 2' }, { start: 2370, title: 'Chapter 3' }],
    markers: [{ start: 50, end: 140 }, { start: 3330, end: 3480 }],
    previous: { label: 'Previous · S1 E3', title: 'Tomorrow Is Tomorrow', onSelect: fn() },
    next: { label: 'Next · S1 E5', title: 'Broken to the Fist', onSelect: fn() },
    audio: { tracks: audio, saved: false },
    subtitles: { tracks: subtitles, saved: false, delay: 0, delaySaved: false },
    quality: { steps: [{ index: 6, kbps: 4000, height: 720 }, { index: 10, kbps: 20000, height: 1080 }], label: 'Original' },
    onOpenMenuChange: fn(),
    onBack: fn(),
    onPlayPause: fn(),
    onBack10: fn(),
    onForward30: fn(),
    onVolume: fn(),
    onMini: fn(),
    onExpand: fn(),
    onFullscreen: fn(),
    onSeek: fn(),
    onScrub: fn(),
    onAudio: fn(),
    onSubtitle: fn(),
    onSubtitleDelay: fn(),
    onQuality: fn(),
    onLoadAhead: fn(),
    onSkip: fn(),
    onRetry: fn(),
    onTryAgain: fn(),
    onClose: fn(),
    onUpNextOut: fn(),
  },
} satisfies Meta<typeof PlayerScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

// 1 · Playing an episode from the play queue: Previous and Next show.
export const Playing: Story = {};

// 3 · Opening, 3 s in without an answer: black until the first frame, the second line shows.
export const Opening: Story = { args: { screen: 'opening', subtitle: 'S1 E4 · from 18:40', opening: { text: 'Starting the original file from Plex', slow: true } } };

// 4 · Buffering over the last frame.
export const Buffering: Story = { args: { screen: 'buffering', playing: false, loadedAhead: 2 } };

// 6 · Subtitles menu after a change was saved to Plex.
export const SubtitlesSaved: Story = { args: { openMenu: 'subtitles', subtitles: { tracks: subtitles, saved: true, delay: 0.5, delaySaved: false } } };

// 10 · Skip intro with the controls hidden.
export const SkipIntro: Story = { args: { controls: 'none', position: 90, skip: { kind: 'intro', visible: true, raised: false } } };

// 13 · Every way of playing failed.
export const PlaybackError: Story = {
  args: {
    screen: 'error',
    playing: false,
    failure: { body: 'Plex stopped sending Shōgun and every way of playing it failed. Your place is saved.', detail: 'Tried: original file → repackaged by Plex → converted → converted with audio' },
  },
};

// 14 · Plex stopped answering timeline reports while the player waits for video.
export const CantReachPlex: Story = { args: { screen: 'unreachable', playing: false, unreachable: { downFor: 40, nextTryIn: 8 } } };

// 15 · Up Next counting down to the next episode.
export const UpNextCountdown: Story = {
  args: {
    screen: 'up-next',
    upNext: { countdown: 8, show: 'Shōgun', episode: 'S1 E5 · Broken to the Fist', facts: '56 min', onPlayNow: fn() },
  },
};

// 16 · Up Next while the next episode is still downloading.
export const UpNextDownloading: Story = {
  args: {
    screen: 'up-next',
    upNext: {
      show: 'Shōgun',
      episode: 'S1 E5 · Broken to the Fist',
      facts: '56 min',
      steps: [
        { label: 'Downloading', detail: '64% · 12 MB/s', active: true, progress: 64 },
        { label: 'Importing', detail: 'Moves the file into the library' },
        { label: 'Waiting for Plex', detail: "Plex hasn't found the file yet" },
        { label: 'Plex is analysing', detail: 'Reads the file so it can play' },
      ],
    },
  },
};

// 17 · The mini player, bottom right above the downloads bar.
export const Mini: Story = { args: { layout: 'mini' } };
