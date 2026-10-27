import type { Meta, StoryObj } from '@storybook/react-vite';
import { LogOut, Settings } from 'lucide-react';
import { fn } from 'storybook/test';
import { AppBarDesktop, AppBarNavItem } from '@/components/ui/app-bar';
import { Button } from '@/components/ui/button';
import { InputSearch } from '@/components/ui/input-search';
import { StatusInline } from '@/components/ui/status-inline';

const navItems = [
  { label: 'Library', path: '/', count: undefined, risk: false },
  { label: 'Discover', path: '/discover', count: undefined, risk: false },
  { label: 'Calendar', path: '/calendar', count: undefined, risk: false },
  { label: 'Downloads', path: '/downloads', count: 3, risk: false },
  { label: 'Flagged', path: '/flagged', count: 2, risk: true },
  { label: 'History', path: '/history', count: undefined, risk: false },
  { label: 'Health', path: '/health', count: 1, risk: false },
];

const nav = (current: string, disabled = false) => navItems.map((item) => (
  <AppBarNavItem
    key={item.path}
    href={item.path}
    current={item.path === current}
    count={item.count}
    countRisk={item.risk}
    aria-disabled={disabled || undefined}
    onClick={(event) => event.preventDefault()}
  >
    {item.label}
  </AppBarNavItem>
));

const search = (
  <form role="search" className="flex min-w-0" onSubmit={(event) => event.preventDefault()}>
    <InputSearch
      type="search"
      aria-label="Search library, Sonarr and Radarr"
      placeholder="Search movies and TV shows"
      defaultValue=""
      onClear={fn()}
      kbd="/"
      wrapperClassName="w-160 min-w-0"
    />
  </form>
);

const actions = (signOut = 'Sign out', problem?: string) => (
  <>
    <Button variant="ghost" iconOnly icon={<Settings />} aria-label="Settings" className="text-muted-foreground [&>svg]:size-4.5" />
    {problem !== undefined && <StatusInline status="failed" role="alert">{problem}</StatusInline>}
    <Button variant="ghost" disabled={signOut === 'Signing out…'}>{signOut}</Button>
  </>
);

const meta = {
  title: 'UI/AppBar',
  component: AppBarDesktop,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    productName: <h1>media-manager-2</h1>,
    search,
    nav: nav('/'),
    actions: actions(),
  },
} satisfies Meta<typeof AppBarDesktop>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DownloadsCurrent: Story = { args: { nav: nav('/downloads') } };

export const NavDisabled: Story = { args: { nav: nav('/', true) } };

export const SigningOut: Story = { args: { actions: actions('Signing out…') } };

export const SignOutFailed: Story = { args: { actions: actions('Try sign out again', 'Sign-out failed. Your session may still be active.') } };

// The setup wizard's bar: no search or navigation, a ghost Sign out with the log-out icon.
export const Setup: Story = {
  args: {
    search: undefined,
    nav: undefined,
    actions: <Button variant="ghost" icon={<LogOut />}>Sign out</Button>,
  },
};

export const SignedOut: Story = { args: { signedOut: true } };
