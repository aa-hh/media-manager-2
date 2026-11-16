import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StepperSubtitleTiming } from '@/components/ui/stepper-subtitle-timing';

const meta = {
  title: 'Overlays & bars/StepperSubtitleTiming',
  component: StepperSubtitleTiming,
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=111-284' } },
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

// Turns red if 0.0 s keeps an empty line under the number again, which lifts the number above the minus and plus buttons.
export const Zero: Story = {
  args: { offset: 0 },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const value = (await page.findByText('0.0 s')).getBoundingClientRect();
    const button = page.getByRole('menuitem', { name: 'Earlier' }).getBoundingClientRect();
    await expect(Math.abs((value.top + value.bottom) / 2 - (button.top + button.bottom) / 2)).toBeLessThanOrEqual(1);
  },
};
