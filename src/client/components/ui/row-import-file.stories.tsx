import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SelectContent, SelectItem } from '@/components/ui/dropdown-menu';
import { RowImportFile, RowImportFileHeader } from '@/components/ui/row-import-file';
import { Select, SelectTrigger } from '@/components/ui/select-trigger';
import { Table } from '@/components/ui/table';

const file = 'Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX.mkv';

// The three pickers the Import by hand panel puts in each file row.
const episodes = (
  <Select multiple value={[101]} onValueChange={fn()}>
    <SelectTrigger size="row" aria-label={`Episodes for ${file}`} className="w-full">S02E01</SelectTrigger>
    <SelectContent>
      <SelectItem value={101}>S02E01 Hello, Ms. Cobel</SelectItem>
      <SelectItem value={102}>S02E02 Goodbye, Mrs. Selvig</SelectItem>
    </SelectContent>
  </Select>
);
const qualities = [{ id: 3, name: 'WEBDL-1080p' }, { id: 7, name: 'Bluray-1080p' }, { id: 21, name: 'Remux-2160p' }];
const quality = (id: number, name: string) => (
  <Select value={id} onValueChange={fn()}>
    <SelectTrigger size="row" aria-label={`Quality for ${name}`} className="w-full">{qualities.find((each) => each.id === id)?.name}</SelectTrigger>
    <SelectContent>
      {qualities.map((each) => <SelectItem key={each.id} value={each.id}>{each.name}</SelectItem>)}
    </SelectContent>
  </Select>
);
const movieFile = 'Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.HEVC.TrueHD.Atmos.7.1-FGT.mkv';
const language = (
  <Select value={1} onValueChange={fn()}>
    <SelectTrigger size="row" aria-label={`Language for ${file}`} className="w-full">English</SelectTrigger>
    <SelectContent>
      <SelectItem value={1}>English</SelectItem>
      <SelectItem value={2}>French</SelectItem>
    </SelectContent>
  </Select>
);

const meta = {
  title: 'UI/RowImportFile',
  component: RowImportFile,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-11301' } },
  // The row is a set of table cells sized to the header's columns; the Import by hand panel renders it inside this table.
  decorators: [
    (Story) => (
      <Table>
        <RowImportFileHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    checked: true,
    onCheckedChange: fn(),
    checkLabel: file,
    file,
    mapsTo: episodes,
    quality: quality(3, file),
    size: '3.4 GB',
    languages: language,
  },
} satisfies Meta<typeof RowImportFile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Checked: Story = {};

export const Unchecked: Story = { args: { checked: false } };

// A movie maps to its title as plain words, with no episode picker.
export const Movie: Story = {
  args: {
    checkLabel: movieFile,
    file: movieFile,
    mapsTo: 'Dune: Part Two',
    quality: quality(21, movieFile),
    size: '71.2 GB',
  },
};

export const Problem: Story = {
  args: {
    checkLabel: movieFile,
    file: `${movieFile} · Not an upgrade for existing movie file.`,
    mapsTo: 'Dune: Part Two',
    quality: quality(21, movieFile),
    size: '71.2 GB',
    problem: true,
  },
};
