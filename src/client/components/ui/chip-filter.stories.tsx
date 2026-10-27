import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { ChipFilter } from '@/components/ui/chip-filter';

const meta = {
  title: 'UI/ChipFilter',
  component: ChipFilter,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3500' } },
  args: { children: 'Rating 7 and above', removeLabel: 'Remove Rating 7 and above', onRemove: fn() },
} satisfies Meta<typeof ChipFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
