import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleX, Info, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { RowHealthProblem } from '@/components/ui/row-health-problem';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableHead, TableHeader } from '@/components/ui/table';

const docs = (
  <Button variant="outline" size="row" nativeButton={false} render={<a href="https://wiki.servarr.com/sonarr/system#indexers-are-unavailable-due-to-failures" target="_blank" rel="noreferrer" />}>
    Docs
  </Button>
);

const meta = {
  title: 'UI/RowHealthProblem',
  component: RowHealthProblem,
  tags: ['autodocs'],
  // The Health screen's Problems table and its header, whose columns the row's cells are sized to.
  decorators: [
    (Story) => (
      <Table aria-label="Problems">
        <TableHeader>
          <TableHead className="w-7" />
          <TableHead fill>Problem</TableHead>
          <TableHead className="w-30" />
          <TableHead className="w-70">Level</TableHead>
          <TableHead className="w-30" />
        </TableHeader>
        <Story />
      </Table>
    ),
  ],
  args: {
    logo: <Logo name="sonarr" alt="" />,
    problem: 'Indexers unavailable due to failures for more than 6 hours: Blutopia',
    detail: 'Sonarr',
    fixIcon: <TriangleAlert className="text-warning" />,
    fix: <span className="text-warning">Warning</span>,
    marker: 'warning',
    actions: docs,
  },
} satisfies Meta<typeof RowHealthProblem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {};

export const Risk: Story = {
  args: {
    logo: <Logo name="radarr" alt="" />,
    problem: 'Unable to communicate with rTorrent. Connection refused (localhost:8080)',
    detail: 'Radarr',
    fixIcon: <CircleX className="text-destructive" />,
    fix: <span className="text-destructive">Risk</span>,
    marker: 'risk',
  },
};

export const Notice: Story = {
  args: {
    problem: 'New update is available: 4.0.15.2941',
    fixIcon: <Info className="text-muted-foreground" />,
    fix: <span className="text-muted-foreground">Notice</span>,
    marker: undefined,
    actions: undefined,
  },
};

export const FixRunning: Story = {
  args: {
    since: '2 h ago',
    fixIcon: <Spinner />,
    fix: 'Retrying the tracker every 15 minutes',
  },
};

export const GaveUp: Story = {
  args: {
    marker: 'risk',
    since: 'Yesterday',
    fixIcon: <CircleX className="text-destructive" />,
    fix: <span className="text-destructive">Gave up after 3 tries</span>,
  },
};

export const WithoutDetail: Story = { args: { detail: undefined } };
