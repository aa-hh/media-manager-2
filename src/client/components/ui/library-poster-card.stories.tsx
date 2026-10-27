import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookmarkX, CalendarClock, Check, Star } from 'lucide-react';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { LibraryPosterCard } from '@/components/ui/library-poster-card';
import { formatBytes } from '@/downloads/model';
import { progressText } from '@/library/grid';

// Sample poster built in place, so the story needs no image server.
const poster = (top: string, bottom: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="420" height="630" fill="url(#g)"/></svg>`,
)}`;

const meta = {
  title: 'Cards & posters/LibraryPosterCard',
  component: LibraryPosterCard,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-2830' } },
  args: {
    href: '/movie/412',
    poster: poster('#c8873a', '#3b2312'),
    title: 'Dune: Part Two',
    meta: ['2024', formatBytes(14_200_000_000), 'HD-1080p'].join(' · '),
    onClick: fn(),
  },
} satisfies Meta<typeof LibraryPosterCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPoster: Story = { args: { poster: undefined } };

export const Downloading: Story = {
  args: {
    href: '/series/87',
    poster: poster('#7fa3b8', '#1d2a33'),
    title: 'Severance',
    meta: ['2022', progressText(17, 2, 19), formatBytes(38_100_000_000)].join(' · '),
    status: <Badge variant="live">2 downloading</Badge>,
    progress: 42,
  },
};

export const Imported: Story = { args: { imported: true } };

export const Missing: Story = {
  args: {
    href: '/series/87',
    poster: poster('#7fa3b8', '#1d2a33'),
    title: 'Severance',
    meta: ['2022', progressText(16, 0, 19), formatBytes(35_400_000_000)].join(' · '),
    status: <Badge variant="warning">Missing 3 episodes</Badge>,
  },
};

export const NotMonitored: Story = { args: { status: <Badge icon={<BookmarkX aria-hidden="true" />}>Not monitored</Badge> } };

export const Selected: Story = { args: { selected: true } };

export const DiscoverMovie: Story = {
  args: {
    href: '/movie/412',
    meta: undefined,
    kind: 'movie',
    year: 2024,
    genres: 'Science Fiction, Adventure',
    overview: 'Paul Atreides unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    badges: (
      <>
        <Badge icon={<Star aria-hidden="true" />} className="font-data text-[13px] text-foreground">8.2</Badge>
        <Badge variant="strong" icon={<Check aria-hidden="true" />}>In library</Badge>
      </>
    ),
  },
};

export const DiscoverTv: Story = {
  args: {
    href: '/title/tmdb-tv/136315',
    poster: poster('#d9b26a', '#4a2a17'),
    title: 'The Bear',
    meta: undefined,
    kind: 'tv',
    year: 2022,
    genres: 'Drama, Comedy',
    badges: <Badge icon={<Star aria-hidden="true" />} className="font-data text-[13px] text-foreground">8.1</Badge>,
  },
};

export const Ranked: Story = { args: { ...DiscoverTv.args, rank: 1 } };

export const Upcoming: Story = {
  args: {
    href: '/title/tmdb/1084242',
    poster: poster('#9a6bb0', '#22152b'),
    title: 'Zootopia 2',
    meta: undefined,
    kind: 'movie',
    year: 2025,
    genres: 'Animation, Family, Comedy',
    dateTab: { month: 'NOV', day: '26' },
    badges: <Badge icon={<CalendarClock aria-hidden="true" />} className="text-foreground">In 4 weeks</Badge>,
  },
};
