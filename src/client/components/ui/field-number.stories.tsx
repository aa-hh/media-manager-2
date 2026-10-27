import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FieldNumber } from '@/components/ui/field-number';

const meta = {
  title: 'UI/FieldNumber',
  component: FieldNumber,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-2001' } },
  args: { before: 'Up to', after: 'GB:', defaultValue: '20', onValueChange: fn() },
} satisfies Meta<typeof FieldNumber>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AfterOnly: Story = { args: { before: undefined, after: 'hours +', defaultValue: '72' } };

export const BeforeOnly: Story = { args: { before: 'From', after: undefined, inputMode: 'numeric', defaultValue: '1990' } };

export const Empty: Story = { args: { before: 'To', after: undefined, inputMode: 'numeric', defaultValue: '' } };

export const Invalid: Story = { args: { before: undefined, after: 'per GB', defaultValue: 'two', 'aria-invalid': true } };

export const Disabled: Story = { args: { disabled: true } };

export const WideBox: Story = { args: { before: 'From', after: undefined, inputMode: 'numeric', defaultValue: '1990', boxClassName: 'w-24' } };
