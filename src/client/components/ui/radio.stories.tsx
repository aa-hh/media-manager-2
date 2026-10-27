import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Radio, RadioGroup } from '@/components/ui/radio';

const meta = {
  title: 'UI/Radio',
  component: Radio,
  tags: ['autodocs'],
  // A radio only works inside a RadioGroup; this is the Backup editor's choice of destination, chosen "folder".
  decorators: [
    (Story) => (
      <RadioGroup aria-label="Where backups go" defaultValue="folder" onValueChange={fn()} className="flex gap-2">
        <Story />
      </RadioGroup>
    ),
  ],
  args: { value: 's3', 'aria-label': 'An S3-compatible bucket' },
} satisfies Meta<typeof Radio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {};

export const Checked: Story = { args: { value: 'folder', 'aria-label': 'A folder' } };

export const Disabled: Story = { args: { disabled: true } };

export const DisabledChecked: Story = { args: { value: 'folder', 'aria-label': 'A folder', disabled: true } };
