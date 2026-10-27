import type { Meta, StoryObj } from '@storybook/react-vite';
import { Star } from 'lucide-react';
import { CardLibrary } from '@/components/ui/card-library';

const meta = {
  title: 'Cards & posters/CardLibrary',
  component: CardLibrary,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-420' } },
  args: {
    ratings: [
      { source: 'IMDb', value: '8.5', votes: '612,408 votes' },
      { source: 'TMDB', value: '82%', votes: '6,214 votes' },
      { source: 'RT', value: '92' },
    ],
    rows: [
      { label: 'Monitoring', value: 'Monitored' },
      { label: 'Available when', value: 'Released' },
      { label: 'Quality profile', value: 'HD-1080p' },
      { label: 'File', value: 'Bluray-1080p · FGT' },
      { label: 'On disk', value: '14.2 GB · 1 file' },
      { label: 'Added', value: '12 Mar 2024' },
      { label: 'Folder', value: <span className="[overflow-wrap:anywhere]">/data/media/movies/Dune Part Two (2024)</span> },
    ],
    tags: ['4k-wanted', 'family'],
  },
} satisfies Meta<typeof CardLibrary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InLibrary: Story = {};

export const Series: Story = {
  args: {
    ratings: [{ source: 'Rating', icon: <Star />, value: '8.7', votes: '1,203 votes' }],
    rows: [
      { label: 'Monitoring', value: 'All episodes' },
      { label: 'New seasons', value: 'Monitored' },
      { label: 'Quality profile', value: 'WEB-1080p' },
      { label: 'Episodes', value: '19 of 19 on disk' },
      { label: 'On disk', value: '41.6 GB · 19 files' },
      { label: 'Added', value: '18 Feb 2022' },
      { label: 'Folder', value: <span className="[overflow-wrap:anywhere]">/data/media/tv/Severance</span> },
    ],
    tags: [],
  },
};

export const NotInLibrary: Story = {
  args: {
    title: 'Not in your library',
    rows: [
      { label: 'Monitoring', value: 'Not monitored' },
      { label: 'Available when', value: 'Chosen when adding' },
      { label: 'Quality profile', value: 'Chosen when adding' },
    ],
    tags: [],
  },
};

export const NoRatings: Story = { args: { ratings: [] } };

export const NoTags: Story = { args: { tags: [] } };
