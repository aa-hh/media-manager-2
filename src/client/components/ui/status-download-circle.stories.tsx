import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusDownloadCircle } from '@/components/ui/status-download-circle';

const meta = {
  title: 'UI/StatusDownloadCircle',
  component: StatusDownloadCircle,
  tags: ['autodocs'],
  args: { state: 'downloading', percent: 42 },
} satisfies Meta<typeof StatusDownloadCircle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Downloading: Story = {};

export const Grabbed: Story = { args: { state: 'grabbed', percent: 0 } };

export const Importing: Story = { args: { state: 'importing', percent: 100 } };

export const Stalled: Story = { args: { state: 'stalled', percent: 63 } };

export const ImportBlocked: Story = { args: { state: 'import-blocked', percent: 100 } };

export const Empty: Story = { args: { percent: 0 } };
