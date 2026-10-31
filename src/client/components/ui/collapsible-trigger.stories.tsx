import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { CollapsibleContent } from '@/components/ui/collapsible-content';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible-trigger';

const meta = {
  title: 'Headers & navigation/CollapsibleTrigger',
  component: CollapsibleTrigger,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8759' } },
  // The trigger reads open and disabled from its Collapsible; stories set them through parameters.
  decorators: [
    (Story, { parameters }) => (
      <div className="w-160">
        <Collapsible defaultOpen={parameters.open === true} disabled={parameters.disabled === true} onOpenChange={fn()}>
          <Story />
        </Collapsible>
      </div>
    ),
  ],
  args: {
    children: 'More',
    summary: 'Partly downloaded torrents: below 10 %, ratio 1, 14 days · Removal advice margin: 10 % seed time, at least 2 h, ratio 0.1',
  },
} satisfies Meta<typeof CollapsibleTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  args: { summary: undefined },
  parameters: { open: true },
  render: (args) => <><CollapsibleTrigger {...args} /><CollapsibleContent>Partly downloaded torrents: below 10 %, ratio 1, 14 days</CollapsibleContent></>,
};

export const WithBadge: Story = { args: { badge: <Badge variant="risk">1 problem</Badge> } };

export const Disabled: Story = { parameters: { disabled: true } };
