import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { CollapsibleContent } from '@/components/ui/collapsible-content';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';
import { FieldNumber } from '@/components/ui/field-number';

const meta = {
  title: 'UI/CollapsibleContent',
  component: CollapsibleContent,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8945' } },
  // The tracker editor's More group: the content sits under its trigger inside one Collapsible.
  decorators: [
    (Story, { parameters }) => (
      <div className="w-160">
        <Collapsible defaultOpen={parameters.open !== false}>
          <CollapsibleTrigger>More</CollapsibleTrigger>
          <Story />
        </Collapsible>
      </div>
    ),
  ],
  args: {
    children: (
      <>
        <div className="flex flex-col gap-1">
          <h4 className="font-ui text-[13px] font-semibold text-foreground">Partly downloaded torrents</h4>
          <p className="font-ui text-xs leading-[1.45] text-subtle-foreground">For a torrent that never finished downloading. The seed time above doesn't apply to it.</p>
        </div>
        <FieldNumber before="Not a hit and run below" after="% downloaded" value="10" onValueChange={fn()} />
        <FieldNumber before="Cleared at ratio" after="of the data downloaded" value="1" onValueChange={fn()} />
        <FieldNumber before="Or after" after="days of seeding" value="14" onValueChange={fn()} />
      </>
    ),
  },
} satisfies Meta<typeof CollapsibleContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Closed: Story = { parameters: { open: false } };
