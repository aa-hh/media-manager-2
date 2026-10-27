import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { Lock } from 'lucide-react';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { FieldLabelled } from '@/components/ui/field-labelled';
import { InputSearch } from '@/components/ui/input-search';

const meta = {
  title: 'UI/FieldLabelled',
  component: FieldLabelled,
  tags: ['autodocs'],
  // The field fills its container; this is one column of the two-column grid on the Settings service editors.
  decorators: [(Story) => <div className="w-100"><Story /></div>],
  args: {
    label: 'Endpoint',
    help: 'The service\'s S3 endpoint, such as https://s3.us-west-004.backblazeb2.com.',
    children: <InputSearch variant="field" type="url" autoComplete="off" spellCheck={false} defaultValue="https://s3.us-west-004.backblazeb2.com" />,
  },
} satisfies Meta<typeof FieldLabelled>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    label: 'Address',
    help: 'Where media-manager-2 reaches Sonarr on the seedbox, with the port.',
    children: <InputSearch variant="field" type="url" autoComplete="off" spellCheck={false} placeholder="e.g. http://localhost:8989" />,
  },
};

export const WithError: Story = {
  args: {
    label: 'Address',
    error: 'Nothing answered at this address within 10 seconds. Check the port.',
    children: <InputSearch variant="field" type="url" autoComplete="off" spellCheck={false} defaultValue="http://localhost:8988" aria-invalid />,
  },
};

export const WithAction: Story = {
  args: {
    label: 'API key',
    help: 'Saved. In Sonarr: Settings > General > API Key.',
    action: <Button variant="outline" onClick={fn()}>Replace</Button>,
    children: <InputSearch variant="field" readOnly value="" icon={<Lock aria-hidden="true" />} placeholder="••••••••••••••••••••" wrapperClassName="bg-muted" />,
  },
};

export const WithoutHelp: Story = {
  args: { label: 'Username', help: undefined, children: <InputSearch variant="field" autoComplete="username" defaultValue="alec" /> },
};

export const Disabled: Story = {
  args: {
    label: 'Global ratio minimum',
    help: 'Read from the site\'s own required ratio.',
    disabled: true,
    children: <InputSearch variant="field" inputMode="decimal" className="font-data" defaultValue="0.60" />,
  },
};

// The on-dark look belongs to the sign-in page's near-black ground.
const darkGround: Decorator = (Story) => <div className="bg-[#07080b] p-6"><Story /></div>;

export const OnDark: Story = {
  decorators: [darkGround],
  args: {
    onDark: true,
    label: 'Jellyfin server address',
    help: 'The address media-manager-2 uses to reach Jellyfin, with the port.',
    children: <InputSearch variant="field-on-dark" type="url" placeholder="http://192.168.1.20:8096" />,
  },
};

export const OnDarkError: Story = {
  decorators: [darkGround],
  args: {
    onDark: true,
    label: 'Password',
    error: 'Jellyfin refused that username and password.',
    children: <InputSearch variant="field-on-dark" type="password" autoComplete="current-password" defaultValue="hunter22" aria-invalid />,
  },
};
