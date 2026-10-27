import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkHistory } from '@/components/ui/mark-history';

const meta = {
  title: 'UI/MarkHistory',
  component: MarkHistory,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-862' } },
  args: { kind: 'failed', tooltip: 'Failed before on 14 Oct' },
} satisfies Meta<typeof MarkHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Failed: Story = {};

export const Blocklisted: Story = { args: { kind: 'blocklisted', tooltip: 'Blocklisted on 9 Oct' } };

export const Grabbed: Story = { args: { kind: 'grabbed', tooltip: 'Grabbed before on 21 Sept' } };
