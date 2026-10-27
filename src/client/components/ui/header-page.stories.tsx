import type { Meta, StoryObj } from '@storybook/react-vite';
import { RefreshCw } from 'lucide-react';
import { fn } from 'storybook/test';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { HeaderPage } from '@/components/ui/header-page';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const meta = {
  title: 'UI/HeaderPage',
  component: HeaderPage,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-9197' } },
  args: { title: 'Settings' },
} satisfies Meta<typeof HeaderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TitleOnly: Story = {};

export const WithSummary: Story = { args: { title: 'Discover', summary: 'United States' } };

export const WithAction: Story = {
  args: {
    title: 'Health',
    summary: <>3 problems, <span className="text-destructive">1 of them a risk</span> · checked 4m ago</>,
    action: <Button variant="outline" icon={<RefreshCw />} onClick={fn()}>Run all checks</Button>,
  },
};

export const ActionLoading: Story = {
  args: {
    title: 'Health',
    summary: 'checking now…',
    action: <Button variant="outline" icon={<RefreshCw />} loading>Checking…</Button>,
  },
};

export const WithBreadcrumb: Story = {
  args: {
    breadcrumb: <Breadcrumb links={[{ label: 'Discover', href: '/discover', onClick: fn() }]} current="Trending" />,
    title: 'Trending',
    summary: 'This week · Movies and TV · United States',
    action: (
      <ToggleGroup aria-label="Type" value="movies" onValueChange={fn()}>
        <ToggleGroupItem value="movies">Movies</ToggleGroupItem>
        <ToggleGroupItem value="tv">TV</ToggleGroupItem>
      </ToggleGroup>
    ),
  },
};

export const WithNote: Story = {
  args: {
    note: 'Nothing is connected yet. Add each service’s address and key, then Connect tests and saves it.',
  },
};
