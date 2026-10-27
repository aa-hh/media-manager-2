import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { StillEpisode } from '@/components/ui/still-episode';

const still = (top: string, bottom: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="80"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="144" height="80" fill="url(#g)"/></svg>`,
)}`;

const meta = {
  title: 'Rows — titles & releases/StillEpisode',
  component: StillEpisode,
  tags: ['autodocs'],
  decorators: [(Story) => <div className="p-6"><Story /></div>],
  args: { image: still('#41556b', '#a9b4bf') },
} satisfies Meta<typeof StillEpisode>;

export default meta;
type Story = StoryObj<typeof meta>;

// title.pen NIjoo E05: a file to play, the play circle on hover and focus.
export const Playable: Story = { args: { playable: true, 'aria-label': 'Play E05', onClick: fn() } };

// E04: the next episode to watch, stopped partway: glow-blue play at rest and the watch bar.
export const NextStoppedPartway: Story = { args: { image: still('#1f3329', '#4b5a3c'), playable: true, next: true, watched: 46, 'aria-label': 'Resume E04', onClick: fn() } };

// E03: watched.
export const Played: Story = { args: { image: still('#8a4b22', '#e0a060'), playable: true, played: true, 'aria-label': 'Play E03', onClick: fn() } };

// Keyboard focus: the 2 px inner ring with the play circle.
export const Focused: Story = {
  args: { playable: true, 'aria-label': 'Play E05', onClick: fn() },
  play: async ({ userEvent }) => {
    await userEvent.tab();
  },
};

// E07: downloading, the lime strip along the foot; not a button.
export const Downloading: Story = { args: { downloading: 64 } };

// E08 and E10: no file, grey and faded; not a button.
export const NoFile: Story = { args: { image: still('#8a4b22', '#e0a060'), noFile: true } };

// E09: no image yet.
export const Placeholder: Story = { args: { image: undefined } };
