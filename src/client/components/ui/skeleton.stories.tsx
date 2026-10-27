import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton, SkeletonCalendarEntry, SkeletonPosterCard, SkeletonRow, SkeletonRowTwoLine, SkeletonSearchResult } from '@/components/ui/skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-381' } },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Row: Story = {
  render: () => (
    <div className="flex flex-col">
      {[0, 1, 2].map((index) => <SkeletonRow key={index} />)}
    </div>
  ),
};

// Health shows five of these while it reads.
export const RowTwoLine: Story = {
  render: () => (
    <div className="flex flex-col">
      {[0, 1, 2, 3, 4].map((index) => <SkeletonRowTwoLine key={index} />)}
    </div>
  ),
};

export const PosterCard: Story = { render: () => <SkeletonPosterCard /> };

export const SearchResult: Story = { render: () => <SkeletonSearchResult /> };

export const CalendarEntry: Story = { render: () => <div className="w-40"><SkeletonCalendarEntry /></div> };
