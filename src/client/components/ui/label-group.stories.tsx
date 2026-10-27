import type { Meta, StoryObj } from '@storybook/react-vite';
import { LabelGroup } from '@/components/ui/label-group';

const meta = {
  title: 'UI/LabelGroup',
  component: LabelGroup,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-2308' } },
  args: { count: 2, children: 'Downloading' },
} satisfies Meta<typeof LabelGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CountOfTotal: Story = { args: { count: '2 of 3', children: 'Services' } };

export const CountRisk: Story = { args: { count: 3, countRisk: true, children: 'Needs you' } };

export const WithoutCount: Story = { args: { count: undefined, children: 'History' } };
