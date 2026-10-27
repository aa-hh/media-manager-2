import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkFreeleech } from '@/components/ui/mark-freeleech';

const meta = {
  title: 'UI/MarkFreeleech',
  component: MarkFreeleech,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-895' } },
  args: { tooltip: 'Freeleech' },
} satisfies Meta<typeof MarkFreeleech>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Partial: Story = { args: { tooltip: 'Freeleech 75%' } };
