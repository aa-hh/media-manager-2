import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';

const sortLabels: Array<[string, string]> = [['popular', 'Popularity'], ['rating', 'Rating'], ['newest', 'Newest'], ['upcoming', 'Upcoming']];

const meta = {
  title: 'UI/SelectTrigger',
  component: SelectTrigger,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1453' } },
  // The trigger only works inside a Select; this is Discover's Sort select with its open list.
  // parameters.open opens the list on load; parameters.empty starts with nothing chosen so the placeholder shows.
  decorators: [
    (Story, { parameters }) => (
      <Select
        items={sortLabels.map(([value, label]) => ({ value, label }))}
        defaultValue={parameters.empty === true ? null : 'popular'}
        defaultOpen={parameters.open === true}
      >
        <Story />
        <SelectContent>
          {sortLabels.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
    ),
  ],
  args: { lead: 'Sort', children: 'Popularity' },
} satisfies Meta<typeof SelectTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SizeRow: Story = { args: { size: 'row' } };

export const SizeSm: Story = { args: { size: 'sm' } };

export const SizeLarge: Story = { args: { size: 'large' } };

export const WithoutLead: Story = { args: { lead: undefined, 'aria-label': 'Series type: Standard', children: 'Standard' } };

export const Placeholder: Story = { parameters: { empty: true }, args: { lead: 'Rating', children: undefined, placeholder: 'Any' } };

export const Open: Story = { parameters: { open: true } };

export const Invalid: Story = { args: { 'aria-invalid': true } };

export const Disabled: Story = { args: { disabled: true } };

export const Inline: Story = { args: { variant: 'inline', lead: undefined, 'aria-label': 'all episodes', children: 'all episodes' } };

export const InlineSm: Story = { args: { variant: 'inline', size: 'sm', lead: undefined, 'aria-label': 'Episode', children: 'E05 Trojan’s Horse' } };

export const InlineEmpty: Story = { args: { variant: 'inline', empty: true, lead: undefined, 'aria-label': 'Choose seasons', children: 'Choose seasons' } };

export const InlineDisabled: Story = { args: { variant: 'inline', lead: undefined, disabled: true, 'aria-label': 'all episodes', children: 'all episodes' } };
