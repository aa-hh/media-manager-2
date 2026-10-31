import type { Meta, StoryObj } from '@storybook/react-vite';
import { FieldLabelledOptional } from '@/components/ui/field-labelled-optional';
import { InputSearch } from '@/components/ui/input-search';

const meta = {
  title: 'Actions & inputs/FieldLabelledOptional',
  component: FieldLabelledOptional,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-1940' } },
  // The field fills its container; this is one column of the tracker editor's ratio grid.
  decorators: [(Story) => <div className="w-80"><Story /></div>],
  args: {
    label: 'Ratio that also clears it',
    help: 'This torrent\'s upload divided by its download.',
    children: <InputSearch variant="field" inputMode="decimal" autoComplete="off" className="font-data" defaultValue="1.0" />,
  },
} satisfies Meta<typeof FieldLabelledOptional>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    label: 'Region',
    help: 'Default auto, which suits Cloudflare R2; most other services need their real region, such as us-west-004.',
    children: <InputSearch variant="field" autoComplete="off" spellCheck={false} placeholder="auto" />,
  },
};

export const WithError: Story = {
  args: {
    error: 'Enter a number, such as 0.9 or 72.',
    children: <InputSearch variant="field" inputMode="decimal" autoComplete="off" className="font-data" defaultValue="one" aria-invalid />,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Global ratio minimum',
    help: 'Read from the site\'s own required ratio.',
    disabled: true,
    children: <InputSearch variant="field" inputMode="decimal" autoComplete="off" className="font-data" defaultValue="0.60" />,
  },
};
