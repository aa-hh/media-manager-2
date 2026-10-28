import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { VolumeButton, VolumePopover } from '@/components/ui/volume-popover';

const meta = {
  title: 'Overlays & bars/VolumePopover',
  component: VolumePopover,
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y/media-manager-2----player?node-id=7-643' } },
  tags: ['autodocs'],
  decorators: [(Story) => <div className="bg-black p-6"><Story /></div>],
  args: { value: 62, onValueChange: fn() },
} satisfies Meta<typeof VolumePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

// The level as a percent over the upright slider.
export const Default: Story = {};

// Muted: "Muted" in place of the percent, the slider greyed at the level it returns to.
export const Muted: Story = { args: { muted: true } };

// On the Volume button, the pointer over it: the panel 10 px above the speaker (player file 7:717).
export const OnTheButton: Story = {
  decorators: [(Story) => <div className="flex h-60 items-end bg-black p-6"><Story /></div>],
  render: (args) => <VolumeButton volume={args.value} muted={args.muted ?? false} onMute={fn()} onVolumeChange={args.onValueChange} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button', { name: 'Mute' }));
  },
};
