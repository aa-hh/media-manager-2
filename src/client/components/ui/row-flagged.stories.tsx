import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { RowFlagged } from '@/components/ui/row-flagged';
import { Table, TableHead, TableHeader } from '@/components/ui/table';

// A stand-in poster drawn inline, so the story loads nothing from the network.
const poster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"><rect width="32" height="48" fill="#2f4858"/><rect y="30" width="32" height="18" fill="#86bbd8"/></svg>')}`;

// How the Needs you list writes the next steps: the action names joined, right-aligned.
const nextSteps = (words: string) => <span className="w-full truncate text-right font-ui text-muted-foreground">{words}</span>;

const meta = {
  title: 'UI/RowFlagged',
  component: RowFlagged,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-4392' } },
  // The Flagged screen's Needs you table and its header, whose columns the row's cells are sized to.
  decorators: [
    (Story) => (
      <Table aria-label="Needs you">
        <TableHeader>
          <TableHead className="w-8" />
          <TableHead fill>Item</TableHead>
          <TableHead className="w-30" />
          <TableHead className="w-16" />
          <TableHead align="end" className="w-60">Next step</TableHead>
        </TableHeader>
        <Story />
      </Table>
    ),
  ],
  args: {
    title: 'Severance S02E01',
    reason: "STALLED · The tracker can't serve this torrent. (Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX)",
    actions: nextSteps('Pick a release · Search automatically'),
    onClick: fn(),
  },
} satisfies Meta<typeof RowFlagged>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ImportFailed: Story = {
  args: {
    title: 'Dune: Part Two',
    reason: 'IMPORT FIX FAILED · Dune: Part Two: Not an upgrade for existing movie file.',
    actions: nextSteps('Manual import · Pick a release · Search automatically'),
  },
};

export const Risk: Story = { args: { marker: 'risk' } };

export const Warning: Story = { args: { marker: 'warning' } };

export const Selected: Story = { args: { selected: true, 'aria-selected': true } };

export const WithoutReason: Story = { args: { reason: undefined } };

export const WithPosterAndCounts: Story = {
  args: {
    poster,
    gaveUp: '2 days ago',
    tries: 3,
    actions: (
      <>
        <Button size="row" onClick={fn()}>Search again</Button>
        <Button size="row" variant="outline" onClick={fn()}>Pick a release</Button>
      </>
    ),
  },
};
