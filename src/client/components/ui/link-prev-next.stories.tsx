import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { LinkPrevNext } from '@/components/ui/link-prev-next';

const meta = {
  title: 'Actions & inputs/LinkPrevNext',
  component: LinkPrevNext,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-5109' } },
  args: {
    previous: { label: 'S02E06', onClick: fn() },
    next: { label: 'S02E08', onClick: fn() },
  },
} satisfies Meta<typeof LinkPrevNext>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Both: Story = {};

export const FirstEpisode: Story = { args: { previous: undefined, next: { label: 'S01E02', onClick: fn() } } };

export const LastEpisode: Story = { args: { previous: { label: 'S02E09', onClick: fn() }, next: undefined } };
