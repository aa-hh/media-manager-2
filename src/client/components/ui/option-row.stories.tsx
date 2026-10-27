import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/ui/logo';
import { OptionRow, OptionRowService } from '@/components/ui/option-row';
import { Radio, RadioGroup } from '@/components/ui/radio';

const meta = {
  title: 'UI/OptionRow',
  component: OptionRow,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4303' } },
  // Radio controls only work inside a RadioGroup; this is the Backup editor's destination choice, with "A folder" chosen.
  decorators: [
    (Story) => (
      <RadioGroup aria-label="Where backups go" defaultValue="folder" onValueChange={fn()} className="grid w-160 grid-cols-2 gap-2">
        <Story />
      </RadioGroup>
    ),
  ],
  args: {
    control: <Radio value="folder" />,
    title: 'A folder',
    description: 'On this server, or a drive or share mounted on it.',
  },
} satisfies Meta<typeof OptionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checked: Story = {};

export const Unchecked: Story = {
  args: {
    control: <Radio value="s3" />,
    title: 'An S3-compatible bucket',
    description: 'Cloudflare R2, Backblaze B2, Amazon S3, Wasabi, MinIO or any other S3 API.',
  },
};

export const Bordered: Story = { args: { bordered: true } };

export const BorderedUnchecked: Story = {
  args: {
    bordered: true,
    control: <Radio value="s3" />,
    title: 'An S3-compatible bucket',
    description: 'Cloudflare R2, Backblaze B2, Amazon S3, Wasabi, MinIO or any other S3 API.',
  },
};

export const Disabled: Story = {
  args: {
    bordered: true,
    control: <Radio value="paste" disabled />,
    title: 'Paste a token',
    description: 'The X-Plex-Token of your Plex server.',
  },
};

export const WithoutDescription: Story = { args: { description: undefined } };

export const WithKbd: Story = { args: { kbd: '1' } };

export const WithCheckbox: Story = {
  args: {
    bordered: true,
    control: <Checkbox defaultChecked onCheckedChange={fn()} />,
    title: 'Trackers',
    description: 'Add each private tracker and its hit and run rule, so deleting a version never breaks one.',
  },
};

export const WithCheckboxUnchecked: Story = {
  args: {
    bordered: true,
    control: <Checkbox onCheckedChange={fn()} />,
    title: 'Backup',
    description: 'Copy the database every few minutes to a folder or an S3-compatible bucket.',
  },
};

// The service picker on the dark first-run page; it opens the next step and records no choice.
export const Service: Story = {
  render: () => (
    <div className="col-span-2 flex flex-col gap-2 bg-[#07080b] p-6">
      <OptionRowService logo={<Logo name="plex" alt="" className="size-8" />} title="Plex" description="Log in with your Plex account, through plex.tv." onClick={fn()} />
      <OptionRowService logo={<Logo name="jellyfin" alt="" className="size-8" />} title="Jellyfin" description="Log in with an administrator account on your own Jellyfin server." onClick={fn()} />
    </div>
  ),
};
