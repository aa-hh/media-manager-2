import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { PlayerMini } from '@/components/ui/player-mini';

const arrival = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#41556b"/><stop offset="1" stop-color="#a9b4bf"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/></svg>',
)}`;

const meta = {
  title: 'Overlays & bars/PlayerMini',
  component: PlayerMini,
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=112-396' } },
  tags: ['autodocs'],
  decorators: [(Story) => <div className="p-12"><Story /></div>],
  args: {
    picture: <img src={arrival} alt="" />,
    title: 'Arrival',
    time: '47:12 / 1:56:00',
    progress: 41,
    playing: true,
    onPlayPause: fn(),
    onExpand: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof PlayerMini>;

export default meta;
type Story = StoryObj<typeof meta>;

// At rest: only the picture.
export const Default: Story = {};

// player.pen state 17, the pointer over it: play or pause in the middle, back to full size and close at the top.
export const Hovered: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button', { name: 'Pause' }));
  },
};
