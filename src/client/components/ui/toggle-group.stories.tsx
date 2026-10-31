import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clapperboard, LayoutGrid, Tv } from 'lucide-react';
import { fn } from 'storybook/test';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const views = (
  <>
    <ToggleGroupItem value="week">Week</ToggleGroupItem>
    <ToggleGroupItem value="month">Month</ToggleGroupItem>
    <ToggleGroupItem value="forecast">Forecast</ToggleGroupItem>
  </>
);

const meta = {
  title: 'Actions & inputs/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-414' } },
  args: { 'aria-label': 'Calendar view', value: 'week', onValueChange: fn(), children: views },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SizeRow: Story = { args: { size: 'row' } };

export const SizeInset: Story = {
  args: {
    size: 'inset',
    'aria-label': 'Quality',
    value: 'all',
    children: (
      <>
        <ToggleGroupItem value="all" count={38}>All</ToggleGroupItem>
        <ToggleGroupItem value="WEBDL-2160p" count={6}>WEBDL-2160p</ToggleGroupItem>
        <ToggleGroupItem value="WEBDL-1080p" count={21}>WEBDL-1080p</ToggleGroupItem>
        <ToggleGroupItem value="HDTV-720p" count={11}>HDTV-720p</ToggleGroupItem>
      </>
    ),
  },
};

export const SizeLarge: Story = { args: { size: 'large' } };

export const WithCounts: Story = {
  args: {
    'aria-label': 'Show',
    value: 'tv',
    children: (
      <>
        <ToggleGroupItem value="all" count={14}>All</ToggleGroupItem>
        <ToggleGroupItem value="tv" count={9}>TV</ToggleGroupItem>
        <ToggleGroupItem value="movie" count={5}>Movies</ToggleGroupItem>
      </>
    ),
  },
};

export const WithIcons: Story = {
  args: {
    'aria-label': 'Media type',
    value: 'all',
    children: (
      <>
        <ToggleGroupItem value="all" icon={<LayoutGrid aria-hidden="true" />} className="px-4 text-sm">All</ToggleGroupItem>
        <ToggleGroupItem value="movie" icon={<Clapperboard aria-hidden="true" />} className="px-4 text-sm">Movies</ToggleGroupItem>
        <ToggleGroupItem value="tv" icon={<Tv aria-hidden="true" />} className="px-4 text-sm">TV</ToggleGroupItem>
      </>
    ),
  },
};

const download = (
  <>
    <ToggleGroupItem value="leave">Leave</ToggleGroupItem>
    <ToggleGroupItem value="remove">Remove</ToggleGroupItem>
    <ToggleGroupItem value="removeWithTorrent" risk>Remove with torrent</ToggleGroupItem>
  </>
);

// The risk item only turns red once it is the chosen one.
export const RiskNotChosen: Story = { args: { 'aria-label': 'Download', value: 'leave', children: download } };

export const RiskChosen: Story = { args: { 'aria-label': 'Download', value: 'removeWithTorrent', children: download } };

export const Disabled: Story = {
  args: {
    'aria-label': 'Torrent',
    value: 'keep',
    disabled: true,
    children: (
      <>
        <ToggleGroupItem value="keep">Keep seeding</ToggleGroupItem>
        <ToggleGroupItem value="remove">Remove torrent</ToggleGroupItem>
      </>
    ),
  },
};

export const ItemDisabled: Story = {
  args: {
    'aria-label': 'Torrent',
    value: 'keep',
    children: (
      <>
        <ToggleGroupItem value="keep">Keep seeding</ToggleGroupItem>
        <ToggleGroupItem value="remove" disabled>Remove torrent</ToggleGroupItem>
      </>
    ),
  },
};
