import type { Meta, StoryObj } from '@storybook/react-vite';
import { CardChoice } from '@/components/ui/card-choice';
import { RadioGroup } from '@/components/ui/radio';

const meta = {
  title: 'UI/CardChoice',
  component: CardChoice,
  tags: ['autodocs'],
  // A card is a radio; Pick a release renders it inside this RadioGroup, where "replace" is the picked value.
  decorators: [
    (Story) => (
      <RadioGroup defaultValue="replace" aria-label="Replace or keep as a second version" className="flex w-120 flex-col gap-2">
        <Story />
      </RadioGroup>
    ),
  ],
  args: {
    value: 'second',
    kbd: '2',
    title: 'Keep as second version',
    description: 'Keeps both files side by side in Plex.',
  },
} satisfies Meta<typeof CardChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = {
  args: {
    value: 'replace',
    kbd: '1',
    title: 'Replace tracked version',
    description: 'The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    kbd: undefined,
    description: 'Keeps both files side by side in Plex. Not available while this release is overridden.',
  },
};

export const WithoutKbd: Story = {
  args: { value: 'keep', kbd: undefined, title: 'Keep seeding the torrent', description: 'Keeping it is the safe choice.' },
};

export const TitleOnly: Story = { args: { kbd: undefined, description: undefined } };
