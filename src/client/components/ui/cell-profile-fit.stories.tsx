import type { Meta, StoryObj } from '@storybook/react-vite';
import { CellProfileFit } from '@/components/ui/cell-profile-fit';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const meta = {
  title: 'UI/CellProfileFit',
  component: CellProfileFit,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-778' } },
  // A table cell's content; shown in a release row of the app's Table so it sits at row height.
  decorators: [
    (Story) => (
      <Table aria-label="Releases">
        <TableHeader>
          <TableHead fill>Release</TableHead>
          <TableHead align="end" className="w-20">Fit</TableHead>
        </TableHeader>
        <TableRow>
          <TableCell fill><span className="truncate">Dune.Part.Two.2024.1080p.BluRay.DDP5.1.x264-FGT</span></TableCell>
          <TableCell align="end" className="w-20"><Story /></TableCell>
        </TableRow>
      </Table>
    ),
  ],
  args: { children: '+1600' },
} satisfies Meta<typeof CellProfileFit>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
