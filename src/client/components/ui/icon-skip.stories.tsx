import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkipBack10, SkipForward30 } from '@/components/ui/icon-skip';

const meta = {
  title: 'Icons & logos/Skip icons',
  component: SkipBack10,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y?node-id=15-1199' } },
  decorators: [(Story) => <div className="inline-flex bg-black p-3 text-foreground-on-dark [&>svg]:size-6"><Story /></div>],
} satisfies Meta<typeof SkipBack10>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Back10: Story = {};

export const Forward30: Story = {
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/5XDOiiHT4DNqDRgYkgbe5y?node-id=15-1205' } },
  render: (args) => <SkipForward30 {...args} />,
};
