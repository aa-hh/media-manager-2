import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleAlert, RefreshCw, ServerOff } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { PlayerError } from '@/components/ui/player-error';

const meta = {
  title: 'Overlays & bars/PlayerError',
  component: PlayerError,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="flex justify-center bg-black p-12"><Story /></div>],
  args: {
    icon: <CircleAlert />,
    title: 'Playback stopped at 1:02:14',
    body: 'Plex stopped sending Arrival and every way of playing it failed. Your place is saved.',
    detail: 'Tried: original file → repackaged by Plex → converted → converted with audio',
    actions: (
      <>
        <Button icon={<RefreshCw />} onClick={fn()}>Retry</Button>
        <Button variant="outline-on-dark" onClick={fn()}>Close player</Button>
      </>
    ),
  },
} satisfies Meta<typeof PlayerError>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen state 13: every way of playing failed.
export const SteppedDown: Story = {};

// State 14: Plex doesn't answer.
export const CantReachPlex: Story = {
  args: {
    icon: <ServerOff />,
    title: "Can't reach Plex",
    body: 'Playback stopped at 47:12. Your place is saved and reaches Plex when it answers.',
    detail: 'No answer from Plex for 40 s · next try in 8 s',
    actions: (
      <>
        <Button icon={<RefreshCw />} onClick={fn()}>Try again</Button>
        <Button variant="outline-on-dark" onClick={fn()}>Close player</Button>
      </>
    ),
    className: 'w-125',
  },
};
