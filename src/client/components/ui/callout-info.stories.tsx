import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileText } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { CalloutInfo } from '@/components/ui/callout-info';

const meta = {
  title: 'UI/CalloutInfo',
  component: CalloutInfo,
  tags: ['autodocs'],
  args: {
    title: 'No account connection for this software',
    children: 'Only the hit and run rule is used.',
  },
} satisfies Meta<typeof CalloutInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIcon: Story = {
  args: {
    icon: <FileText />,
    title: 'This rule comes from the env file on the server',
    children: 'Change a field and save, and media-manager-2 keeps a copy in Settings that takes over from the env file. The env file itself is not changed.',
  },
};

export const WithAction: Story = {
  args: {
    icon: <FileText />,
    title: "This rule is a Settings copy. It takes over from the env file's rule.",
    children: "The env file on the server also has a rule for Blutopia. Use env file rule deletes this copy, and the env file's rule applies again.",
    action: <Button variant="outline" icon={<FileText />} onClick={fn()}>Use env file rule</Button>,
  },
};

export const TitleOnly: Story = { args: { children: undefined } };
