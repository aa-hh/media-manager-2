import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs-trigger';

const meta = {
  title: 'UI/TabsTrigger',
  component: TabsTrigger,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3545' } },
  // A trigger only works inside Tabs and TabsList; this is the Flagged screen's tab row, with "Needs you" chosen.
  decorators: [
    (Story) => (
      <Tabs defaultValue="needs_you">
        <TabsList aria-label="Flagged lists" className="gap-5 border-b border-border">
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
