import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusRulePill } from '@/components/ui/status-rule-pill';

const meta = {
  title: 'UI/StatusRulePill',
  component: StatusRulePill,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-1248' } },
  args: { children: 'Configured' },
} satisfies Meta<typeof StatusRulePill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfiguredEnvFile: Story = { args: { children: 'Configured (env file)' } };

export const Warning: Story = { args: { tone: 'warning', children: 'No rule' } };

export const NoAccountStats: Story = { args: { tone: 'warning', children: 'No account stats' } };
