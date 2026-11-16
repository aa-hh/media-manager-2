import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Clapperboard, LayoutGrid } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-trigger';

const largeUrl = 'https://www.figma.com/design/dFQMjELOx6ObLS0qOG3NCF/media-manager-2----screens?node-id=35-3978';

const meta = {
  title: 'Actions & inputs/TabsTrigger',
  component: TabsTrigger,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3545' } },
  // A trigger only works inside Tabs and TabsList; this is the Flagged screen's tab row, with "Needs you" chosen,
  // or with parameters.large the Library media type row, with "All" chosen.
  decorators: [
    (Story, { parameters }) => (
      <Tabs defaultValue={parameters.large ? 'all' : 'needs_you'}>
        <TabsList aria-label={parameters.large ? 'Type' : 'Flagged lists'} size={parameters.large ? 'large' : 'default'} className="gap-5 border-b border-border">
          <Story />
        </TabsList>
      </Tabs>
    ),
  ],
  args: { value: 'needs_you', count: 3, children: 'Needs you' },
} satisfies Meta<typeof TabsTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

// Puts the chosen "Needs you" trigger before this one, so the story's trigger shows unchosen.
const chosenSibling: Decorator[] = [
  (Story) => (
    <>
      <TabsTrigger value="needs_you" count={3}>Needs you</TabsTrigger>
      <Story />
    </>
  ),
];

export const Active: Story = {};

export const Inactive: Story = { decorators: chosenSibling, args: { value: 'missing', count: 41, children: 'Missing' } };

export const WithoutCount: Story = { args: { count: undefined } };

export const Disabled: Story = { decorators: chosenSibling, args: { value: 'cutoff', count: 12, children: 'Below cutoff', disabled: true } };

// The Library's media type row: icon, 18 px label, count in a badge, lime underline in dark mode.
export const LargeActive: Story = {
  parameters: { large: true, design: { type: 'figma', url: largeUrl } },
  args: { value: 'all', size: 'large', count: 172, children: 'All', icon: <LayoutGrid aria-hidden="true" /> },
};

export const LargeInactive: Story = {
  parameters: { large: true, design: { type: 'figma', url: largeUrl } },
  decorators: [
    (Story) => (
      <>
        <TabsTrigger value="all" size="large" count={172} icon={<LayoutGrid aria-hidden="true" />}>All</TabsTrigger>
        <Story />
      </>
    ),
  ],
  args: { value: 'movie', size: 'large', count: 85, children: 'Movies', icon: <Clapperboard aria-hidden="true" /> },
};
