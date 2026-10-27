import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StepperSubtitleTiming } from '@/components/ui/stepper-subtitle-timing';

const meta = {
  title: 'Overlays & bars/StepperSubtitleTiming',
  component: StepperSubtitleTiming,
  tags: ['autodocs'],
  // Inside the 280 px dark Subtitle timing menu.
  decorators: [
    (Story) => (
      <div className="flex h-40 items-end bg-black p-4">
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="on-dark">Timing</Button>} />
          <DropdownMenuContent onDark side="top" sideOffset={8} className="w-70"><Story /></DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  ],
  args: { offset: 0.5, onEarlier: fn(), onLater: fn() },
} satisfies Meta<typeof StepperSubtitleTiming>;

export default meta;
type Story = StoryObj<typeof meta>;

// player.pen state 7: +0.5 s, later than the voice.
export const Later: Story = {};
