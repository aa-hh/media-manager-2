import type { Meta, StoryObj } from '@storybook/react-vite';
import { TagFormat } from '@/components/ui/tag-format';

const meta = {
  title: 'UI/TagFormat',
  component: TagFormat,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-774' } },
  args: { children: 'DDP 5.1' },
} satisfies Meta<typeof TagFormat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Audio: Story = {};

export const Picture: Story = { args: { children: 'HDR10' } };

export const AudioAndPicture: Story = {
  render: () => (
    <span className="flex gap-1">
      <TagFormat>TrueHD Atmos 7.1</TagFormat>
      <TagFormat>DV</TagFormat>
      <TagFormat>HDR10</TagFormat>
    </span>
  ),
};
