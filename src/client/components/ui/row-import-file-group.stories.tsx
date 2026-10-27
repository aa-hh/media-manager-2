import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Button } from '@/components/ui/button';
import { RowImportFileHeader } from '@/components/ui/row-import-file';
import { RowImportFileGroup } from '@/components/ui/row-import-file-group';
import { Table } from '@/components/ui/table';

const folder = 'Severance.S02.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX';

const meta = {
  title: 'UI/RowImportFileGroup',
  component: RowImportFileGroup,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-13564' } },
  // The Import by hand panel puts the group row under the file table's header, above its file rows.
  decorators: [
    (Story) => (
      <Table>
        <RowImportFileHeader />
        <Story />
      </Table>
    ),
  ],
  args: {
    open: true,
    checked: 'mixed',
    onCheckedChange: fn(),
    checkLabel: `All files in ${folder}`,
    folder,
    count: '9 of 10 files',
  },
} satisfies Meta<typeof RowImportFileGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SomeChecked: Story = {};

export const AllChecked: Story = { args: { checked: true, count: '10 of 10 files' } };

export const NoneChecked: Story = { args: { checked: false, count: '0 of 10 files' } };

export const Closed: Story = { args: { open: false } };

export const WithSizeAndImport: Story = {
  args: { size: '34.6 GB', actions: <Button size="row" onClick={fn()}>Import</Button> },
};
