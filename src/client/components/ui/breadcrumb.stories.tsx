import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Breadcrumb } from '@/components/ui/breadcrumb';

const meta = {
  title: 'Headers & navigation/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8596' } },
  args: {
    links: [{ label: 'Library', href: '/', onClick: fn() }],
    current: 'Severance',
  },
} satisfies Meta<typeof Breadcrumb>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FromLibrary: Story = {};

export const FromSearch: Story = { args: { links: [{ label: 'Search', href: '/search', onClick: fn() }], current: 'Dune: Part Two' } };

export const FromDiscover: Story = { args: { links: [{ label: 'Discover', href: '/discover', onClick: fn() }], current: 'Trending' } };

export const TwoLevels: Story = {
  args: {
    links: [
      { label: 'Library', href: '/', onClick: fn() },
      { label: 'Severance', href: '/tv/1', onClick: fn() },
    ],
    current: 'Season 2',
  },
};

export const LongTitle: Story = {
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  args: { current: 'Everything Everywhere All at Once' },
};
