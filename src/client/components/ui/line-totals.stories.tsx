import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { formatBytes } from '@/downloads/model';
import { LineTotals } from '@/components/ui/line-totals';

const totals = [
  { value: (214).toLocaleString(), word: 'shows' },
  { value: (1386).toLocaleString(), word: 'movies' },
  { value: (9412).toLocaleString(), word: 'episodes' },
  { value: (10871).toLocaleString(), word: 'files' },
  { value: formatBytes(48_300_000_000_000) },
];

const meta = {
  title: 'Badges, marks & status/LineTotals',
  component: LineTotals,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2311' } },
  args: { totals, link: { label: '7 titles missing files', href: '/flagged', onClick: fn() } },
} satisfies Meta<typeof LineTotals>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithLink: Story = {};

export const WithoutLink: Story = { args: { link: undefined } };

export const OneMissing: Story = { args: { link: { label: '1 title missing files', href: '/flagged', onClick: fn() } } };
