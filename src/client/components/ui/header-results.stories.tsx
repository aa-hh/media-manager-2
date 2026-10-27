import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { fn } from 'storybook/test';
import { HeaderResults } from '@/components/ui/header-results';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const filter = (tv: ReactNode, movie: ReactNode, all: number) => (
  <ToggleGroup aria-label="Show" value="all" onValueChange={fn()}>
    <ToggleGroupItem value="all" count={all}>All</ToggleGroupItem>
    <ToggleGroupItem value="tv" count={tv}>TV</ToggleGroupItem>
    <ToggleGroupItem value="movie" count={movie}>Movies</ToggleGroupItem>
  </ToggleGroup>
);

const meta = {
  title: 'UI/HeaderResults',
  component: HeaderResults,
  tags: ['autodocs'],
  args: { count: '6 results for', query: '“dune”', filter: filter(2, 4, 6) },
} satisfies Meta<typeof HeaderResults>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Searching: Story = {
  args: {
    count: <span className="flex items-center gap-2"><Spinner className="size-4.5" />Searching Sonarr and Radarr…</span>,
    filter: filter(<Spinner className="size-3" />, <Spinner className="size-3" />, 0),
  },
};

export const OneResult: Story = { args: { count: '1 result for', query: '“severance”', filter: filter(1, 0, 1) } };

export const WithoutFilter: Story = { args: { count: 'Results for', filter: undefined } };
