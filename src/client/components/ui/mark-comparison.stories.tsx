import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkComparison } from '@/components/ui/mark-comparison';

const meta = {
  title: 'Badges, marks & status/MarkComparison',
  component: MarkComparison,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-841' } },
  args: { children: 'better' },
} satisfies Meta<typeof MarkComparison>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
