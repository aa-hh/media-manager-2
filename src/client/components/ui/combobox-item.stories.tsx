import type { Meta, StoryObj } from '@storybook/react-vite';
import { Clapperboard, Tv } from 'lucide-react';
import { ComboboxItem } from '@/components/ui/combobox-item';

const meta = {
  title: 'Actions & inputs/ComboboxItem',
  component: ComboboxItem,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-3548' } },
  // An item sits in the floating list surface the dropdown menu and select lists share.
  decorators: [
    (Story) => (
      <div role="listbox" aria-label="Titles" className="flex w-62 flex-col rounded-lg border border-border bg-popover p-1 text-foreground shadow-float">
        <Story />
      </div>
    ),
  ],
  args: { role: 'option', 'aria-selected': false, icon: <Tv aria-hidden="true" />, detail: '2022', children: 'Severance' },
} satisfies Meta<typeof ComboboxItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true, 'aria-selected': true } };

// base-ui sets data-highlighted on the item under the pointer or keyboard; set by hand here.
export const Highlighted: Story = { render: (args) => <ComboboxItem {...args} data-highlighted="" /> };

export const Disabled: Story = { render: (args) => <ComboboxItem {...args} aria-disabled data-disabled="" /> };

export const Movie: Story = { args: { icon: <Clapperboard aria-hidden="true" />, detail: '2024', children: 'Dune: Part Two' } };

export const WithoutIconOrDetail: Story = { args: { icon: undefined, detail: undefined, children: 'Date added, newest first' } };
