import type { Meta, StoryObj } from '@storybook/react-vite';
import { Ellipsis, List, Search } from 'lucide-react';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Fact } from '@/components/ui/fact';
import { HeaderTitle } from '@/components/ui/header-title';
import { StatusInline } from '@/components/ui/status-inline';

// Sample artwork as inline SVG; the app gets poster and backdrop URLs from Sonarr or Radarr.
const svg = (width: number, height: number, from: string, to: string) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
)}`;
const posterUrl = svg(420, 630, '#1d4e5f', '#c9d8c5');
const backdropUrl = svg(1280, 720, '#7fa7b5', '#e8efe9');

const meta = {
  title: 'UI/HeaderTitle',
  component: HeaderTitle,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    title: 'Severance',
    posterUrl,
    backdropUrl,
    breadcrumb: <Breadcrumb links={[{ label: 'Library', href: '/', onClick: fn() }]} current="Severance" />,
    bookmark: { state: 'all', onToggle: fn() },
    meta: 'TV · Apple TV+ · 2022 · Continuing · TV-MA · ★ 8.7 · 2 seasons · 19 episodes',
    badges: (
      <>
        <Badge variant="strong">In library</Badge>
        <Badge variant="warning">Missing 3 episodes</Badge>
      </>
    ),
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
    primary: <Button size="large" icon={<Search />} onClick={fn()}>Search automatically</Button>,
    secondary: <Button variant="outline" size="large" icon={<List />} onClick={fn()}>Pick a release</Button>,
    more: <Button variant="outline" size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />,
    facts: (
      <>
        <Fact label="Next episode">Fri 24 Jan</Fact>
        <Fact label="Size on disk">142.6 GB</Fact>
        <Fact label="Quality profile">HD-1080p</Fact>
        <Fact label="Seasons">2 · 19 episodes</Fact>
      </>
    ),
  },
} satisfies Meta<typeof HeaderTitle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The title page layout the app uses: backdrop fills the header, actions at the right, no overview or facts.
export const ActionsRight: Story = {
  // The tall backdrop sits at -z-10; the app's main is isolated so it stays visible, and this wrapper does the same.
  decorators: [(Story) => <main className="isolate"><Story /></main>],
  args: { actionsRight: true },
};

export const Compact: Story = {
  args: {
    compact: true,
    more: <Button variant="ghost" size="large" iconOnly icon={<Ellipsis />} aria-label="More actions" />,
  },
};

export const NotMonitored: Story = { args: { bookmark: { state: 'none', onToggle: fn() } } };

export const PartlyMonitored: Story = { args: { bookmark: { state: 'mixed', onToggle: fn() } } };

export const MonitorRefused: Story = {
  args: { status: <StatusInline status="failed">Sonarr didn't answer.</StatusInline> },
};

export const NotAdded: Story = {
  args: {
    title: 'Dune: Part Two',
    breadcrumb: <Breadcrumb links={[{ label: 'Search', href: '/search', onClick: fn() }]} current="Dune: Part Two" />,
    bookmark: { state: 'none' },
    meta: 'Movie · Legendary Pictures · 2024 · Released · PG-13 · ★ 8.2',
    badges: <Badge>Not in library</Badge>,
    overview: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    primary: <Button size="large" onClick={fn()}>Add to Radarr</Button>,
    secondary: undefined,
    more: undefined,
    facts: undefined,
  },
};

export const WithoutArtwork: Story = { args: { posterUrl: undefined, backdropUrl: undefined } };
