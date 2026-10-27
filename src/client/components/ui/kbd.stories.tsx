import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';

const meta = {
  title: 'UI/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  args: { children: 'Esc' },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Slash: Story = { args: { children: '/' } };

export const WithIcon: Story = { args: { icon: <CornerDownLeft aria-hidden="true" />, 'aria-label': 'Enter', children: undefined } };

// The search footer's keyboard hints.
export const SearchHints: Story = {
  render: () => (
    <div className="flex items-center gap-4 font-ui text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <Kbd icon={<ArrowUp aria-hidden="true" />} aria-label="Up arrow" />
        <Kbd icon={<ArrowDown aria-hidden="true" />} aria-label="Down arrow" />
        Move
      </span>
      <span className="flex items-center gap-1">
        <Kbd icon={<CornerDownLeft aria-hidden="true" />} aria-label="Enter" />
        Open
      </span>
    </div>
  ),
};

// onFill takes the text colour of what it sits in; the tooltip's dark label is its usual home.
export const OnFill: Story = {
  args: { onFill: true },
  decorators: [
    (Story) => (
      <span className="inline-flex items-center gap-1.5 rounded-sm bg-bar px-2 py-1.5 font-ui text-[13px] font-medium text-bar-foreground">
        Collapse
        <Story />
      </span>
    ),
  ],
};
