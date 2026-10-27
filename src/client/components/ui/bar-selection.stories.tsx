import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bookmark, BookmarkX, Search } from 'lucide-react';
import { fn } from 'storybook/test';
import { BarSelection, BarSelectionAction } from '@/components/ui/bar-selection';

const actions = (
  <>
    <BarSelectionAction icon={<Bookmark />} onClick={fn()}>Monitor</BarSelectionAction>
    <BarSelectionAction icon={<BookmarkX />} onClick={fn()}>Unmonitor</BarSelectionAction>
    <BarSelectionAction icon={<Search />} onClick={fn()}>Search automatically</BarSelectionAction>
  </>
);

const meta = {
  title: 'UI/BarSelection',
  component: BarSelection,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8764' } },
  // The bar is fixed to the bottom of the window; the full-height wrapper gives the canvas room to show it.
  decorators: [(Story) => <div className="min-h-[calc(100vh-2rem)]"><Story /></div>],
  args: {
    open: true,
    count: 'Episodes 3 to 6 selected · 2 monitored',
    hint: 'Unmonitoring keeps files',
    clearKbd: 'Esc',
    onClear: fn(),
    children: actions,
  },
} satisfies Meta<typeof BarSelection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const AcrossSeasons: Story = { args: { count: '14 episodes selected' } };

export const WithoutHint: Story = { args: { hint: undefined, clearKbd: undefined } };

export const ActionDisabled: Story = {
  args: {
    children: (
      <>
        <BarSelectionAction icon={<Bookmark />} onClick={fn()}>Monitor</BarSelectionAction>
        <BarSelectionAction icon={<BookmarkX />} onClick={fn()}>Unmonitor</BarSelectionAction>
        <BarSelectionAction icon={<Search />} disabled>Search automatically</BarSelectionAction>
      </>
    ),
  },
};
