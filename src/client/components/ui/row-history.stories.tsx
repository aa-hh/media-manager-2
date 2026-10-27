import type { Meta, StoryObj } from '@storybook/react-vite';
import { CircleX, Download, FolderInput, Trash2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { formatWhen } from '@/history/when';
import { RowHistory, RowHistoryHeader } from '@/components/ui/row-history';
import { Table } from '@/components/ui/table';

const today = Date.parse('2026-10-27T14:32:00');

const meta = {
  title: 'UI/RowHistory',
  component: RowHistory,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1511' } },
  // The row is a set of table cells sized to the header's columns; the History screen renders it inside this table.
  decorators: [
    (Story) => (
      <Table aria-label="Today">
        <RowHistoryHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    when: formatWhen(today, today),
    icon: <Download />,
    event: 'Severance S02E01 · Grabbed',
    by: 'Sonarr',
    detail: 'Blutopia · RSS',
    tabIndex: 0,
    onClick: fn(),
  },
} satisfies Meta<typeof RowHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Grabbed: Story = {};

export const PickedByYou: Story = { args: { by: 'You', detail: 'Blutopia · picked by hand · picked by you' } };

export const Imported: Story = {
  args: {
    icon: <FolderInput />,
    event: 'Severance S02E01 · Imported',
    detail: 'Severance - S02E01 - Hello, Ms. Cobel WEBDL-1080p.mkv',
  },
};

export const ProblemTone: Story = {
  args: {
    icon: <CircleX />,
    event: 'Dune: Part Two · Download failed',
    by: 'Radarr',
    detail: 'Sonarr or Radarr never reported this grab.',
    tone: 'problem',
  },
};

export const WarningTone: Story = {
  args: {
    icon: <Trash2 />,
    event: 'The Bear S03E01 · File deleted',
    detail: 'MissingFromDisk',
    tone: 'warning',
  },
};

export const OlderDay: Story = { args: { when: formatWhen(Date.parse('2026-10-24T21:05:00'), today) } };

// Accessibility check off: rows that open set aria-expanded, which ARIA allows on a row only in a treegrid; the fix is a design call.
export const Selected: Story = { parameters: { a11y: { test: 'todo' } }, args: { selected: true, 'aria-expanded': true } };

// A title's own history leaves By empty and puts the quality and release in the event.
export const OnTitlePage: Story = {
  args: {
    when: '24 Oct, 21:05',
    event: 'Grabbed WEBDL-1080p · Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX',
    by: '',
    tabIndex: undefined,
    onClick: undefined,
  },
};
