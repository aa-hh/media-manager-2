import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { CardChoice } from '@/components/ui/card-choice';
import { RadioGroup } from '@/components/ui/radio';
import { SheetPhone } from '@/components/ui/sheet-phone';

const meta = {
  title: 'UI/SheetPhone',
  component: SheetPhone,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7991' } },
  // A phone-width screen with the sheet pinned to its bottom edge.
  decorators: [
    (Story) => (
      <div className="flex h-[700px] w-[390px] flex-col justify-end bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'This is already in your library',
    subtitle: 'S02E04 · 720p · 1.4 GB',
    children: (
      <RadioGroup defaultValue="replace" aria-label="Replace or keep as a second version" className="flex flex-col gap-2">
        <CardChoice value="replace" title="Replace tracked version" description="The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades." />
        <CardChoice value="second" title="Keep as second version" description="Keeps both files side by side in Plex." />
      </RadioGroup>
    ),
    primary: <Button size="large" onClick={fn()}>Grab and replace the current file</Button>,
    secondary: <Button variant="outline" size="large" onClick={fn()}>Cancel</Button>,
  },
} satisfies Meta<typeof SheetPhone>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoSubtitle: Story = { args: { subtitle: undefined } };

export const PrimaryOnly: Story = { args: { secondary: undefined } };
