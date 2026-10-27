import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Plus } from 'lucide-react';
import { fn } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { RowSearchResult } from '@/components/ui/row-search-result';

// Sample poster, inline so the story needs no network.
const poster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3b53"/><stop offset="1" stop-color="#0b1621"/></linearGradient></defs><rect width="40" height="60" fill="url(#g)"/></svg>')}`;

// The Search screen draws Add as a look-alike of the row-size outline button; the whole row is the link.
const add = (
  <span
    aria-hidden="true"
    className="inline-flex h-(--control-h-row) shrink-0 items-center justify-center gap-1.5 rounded-(--control-radius-row) border border-input bg-card px-(--control-px-row) font-ui text-(length:--control-text-row) font-semibold whitespace-nowrap text-foreground [&>svg]:size-(--control-icon-row)"
  >
    <Plus />
    Add
  </span>
);

const meta = {
  title: 'UI/RowSearchResult',
  component: RowSearchResult,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-7956' } },
  args: {
    role: 'link',
    tabIndex: 0,
    onClick: fn(),
    poster,
    title: 'Severance',
    year: 2022,
    meta: 'TV · Apple TV+ · Continuing · ★ 8.7',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
    status: <Badge variant="plain" icon={<Check aria-hidden="true" />}>In library</Badge>,
    files: '19 files',
  },
} satisfies Meta<typeof RowSearchResult>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InLibrary: Story = {};

export const InLibraryNoFileYet: Story = { args: { files: 'No file yet' } };

export const NotInLibrary: Story = {
  args: {
    title: 'Dune: Part Two',
    year: 2024,
    meta: 'Movie · Released · ★ 8.2',
    overview: 'Paul Atreides unites with Chani and the Fremen while on a path of revenge against the conspirators who destroyed his family.',
    status: undefined,
    files: undefined,
    action: add,
  },
};

export const Highlighted: Story = { args: { highlighted: true } };

export const NoPoster: Story = { args: { poster: undefined } };
