import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChipFilter } from '@/components/ui/chip-filter';

const meta = {
  title: 'UI/Chip Filter',
  component: ChipFilter,
  tags: ['autodocs'],
  args: { children: 'Rating 7 and above', removeLabel: 'Remove Rating 7 and above', onRemove: fn() },
} satisfies Meta<typeof ChipFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
