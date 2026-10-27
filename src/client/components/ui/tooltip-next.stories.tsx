import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkipForward } from 'lucide-react';
import { fn, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { TooltipNext } from '@/components/ui/tooltip-next';

const still = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="108"><defs><linearGradient id="g" x2="0" y2="1"><stop offset="0" stop-color="#1f3329"/><stop offset="1" stop-color="#4b5a3c"/></linearGradient></defs><rect width="192" height="108" fill="url(#g)"/></svg>',
)}`;

const meta = {
  title: 'Overlays & bars/TooltipNext',
  component: TooltipNext,
  tags: ['autodocs'],
  // Room above the button for the tooltip, on the black player.
  decorators: [(Story) => <div className="flex h-48 items-end bg-black p-6"><Story /></div>],
  args: {
    still,
    label: 'Next · S1 E5',
    title: 'Broken to the Fist',
    children: <Button variant="on-dark" iconOnly icon={<SkipForward />} aria-label="Next" onClick={fn()} />,
  },
  // Hover the button and wait out the tooltip delay so the story shows it.
  play: async ({ canvas, userEvent }) => {
    await userEvent.hover(canvas.getByRole('button'));
    await within(document.body).findByText('Broken to the Fist');
  },
} satisfies Meta<typeof TooltipNext>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen state 12.
export const Next: Story = {};
