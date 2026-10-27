import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SignInBlock } from '@/components/ui/sign-in-block';

const meta = {
  title: 'UI/SignInBlock',
  component: SignInBlock,
  tags: ['autodocs'],
  // The heading and line colours are for the dark sign-in page; this is that page's ground and column width.
  // The bottom padding leaves room for the line, which sits outside the block's flow.
  decorators: [
    (Story) => (
      <div className="bg-[#07080b] px-12 pt-12 pb-20">
        <div className="w-100">
          <Story />
        </div>
      </div>
    ),
  ],
  args: { busy: false, onSignIn: fn() },
} satisfies Meta<typeof SignInBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Plex: Story = {};

export const Jellyfin: Story = { args: { service: 'jellyfin' } };

export const Busy: Story = { args: { busy: true } };

export const JellyfinBusy: Story = { args: { service: 'jellyfin', busy: true } };

export const SessionExpired: Story = { args: { line: 'Your session expired. Sign in again.' } };

export const NotConfigured: Story = { args: { line: 'Sign-in isn’t configured.' } };

export const Failed: Story = { args: { line: 'Couldn\'t log you in. Try again.' } };
