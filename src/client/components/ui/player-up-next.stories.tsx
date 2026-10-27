import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PlayerUpNext } from '@/components/ui/player-up-next';

const still = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="704" height="396"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1f3329"/><stop offset="1" stop-color="#4b5a3c"/></linearGradient></defs><rect width="704" height="396" fill="url(#g)"/></svg>',
)}`;

const meta = {
  title: 'Overlays & bars/PlayerUpNext',
  component: PlayerUpNext,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="bg-black p-12"><Story /></div>],
  args: {
    heading: 'Next episode',
    still,
    show: 'Shōgun',
    episode: 'S1 E5 · Broken to the Fist',
    facts: '56 min',
    summary: 'Placeholder summary of the episode. Two lines at most, so the block keeps the same height from one episode to the next.',
    wayOut: 'Back to library',
    onWayOut: fn(),
  },
} satisfies Meta<typeof PlayerUpNext>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen state 15: counts down from 10 s; Play now has focus.
export const Countdown: Story = { args: { countdown: { seconds: 8, fraction: 0.8 }, onPlayNow: fn() } };

// State 16: the next episode is still downloading.
export const Downloading: Story = {
  args: {
    waiting: "Starts when it's ready",
    steps: [
      { label: 'Downloading', detail: '64% · 12 MB/s · about 3 min left', active: true, progress: 64 },
      { label: 'Importing', detail: 'Moves the file into the library' },
      { label: 'Waiting for Plex', detail: "Plex hasn't found the file yet" },
      { label: 'Plex is analysing', detail: 'Reads the file so it can play' },
    ],
    note: 'Stop waiting goes back to the library. The download carries on and nothing is deleted.',
    wayOut: 'Stop waiting',
  },
};
