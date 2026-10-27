import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { ItemEpisodeList } from '@/components/ui/item-episode-list';

const meta = {
  title: 'UI/ItemEpisodeList',
  component: ItemEpisodeList,
  tags: ['autodocs'],
  // The item is an option in a compact episode listbox, outside a table.
  decorators: [
    (Story) => (
      <div role="listbox" aria-label="Season 2 episodes" className="flex w-105 flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    role: 'option',
    number: '1',
    title: 'Hello, Ms. Cobel',
    detail: '17 Jan 2025 · WEBDL-1080p',
    onClick: fn(),
  },
} satisfies Meta<typeof ItemEpisodeList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

export const Missing: Story = {
  args: { number: '3', title: 'Who Is Alive?', detail: '31 Jan 2025', state: <Badge variant="warning">Missing</Badge> },
};

export const Downloading: Story = {
  args: { number: '4', title: 'Woe’s Hollow', detail: '7 Feb 2025', state: <Badge variant="live" percent={42}>Downloading</Badge> },
};

export const WithoutDetail: Story = { args: { number: '10', title: 'Cold Harbor', detail: undefined } };
