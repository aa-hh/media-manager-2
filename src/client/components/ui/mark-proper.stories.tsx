import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkProper } from '@/components/ui/mark-proper';

const meta = {
  title: 'Badges, marks & status/MarkProper',
  component: MarkProper,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-902' } },
  args: { tooltip: 'Proper' },
} satisfies Meta<typeof MarkProper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Proper: Story = {};

export const Repack: Story = { args: { tooltip: 'Repack' } };
