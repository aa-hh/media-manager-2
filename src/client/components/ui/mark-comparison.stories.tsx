import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkComparison } from '@/components/ui/mark-comparison';

const meta = {
  title: 'UI/MarkComparison',
  component: MarkComparison,
  tags: ['autodocs'],
  args: { children: 'better' },
} satisfies Meta<typeof MarkComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
