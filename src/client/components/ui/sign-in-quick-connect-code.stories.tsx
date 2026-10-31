import type { Meta, StoryObj } from '@storybook/react-vite';
import { SignInQuickConnectCode } from '@/components/ui/sign-in-quick-connect-code';

const meta = {
  title: 'Sign in/SignInQuickConnectCode',
  component: SignInQuickConnectCode,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=13-6084' } },
  // Its text colours are for the dark sign-in page; this is that page's ground and column width.
  decorators: [
    (Story) => (
      <div className="bg-[#07080b] p-12">
        <div className="w-100">
          <Story />
        </div>
      </div>
    ),
  ],
  args: { code: '482913', expiry: 'Expires in 9:41' },
} satisfies Meta<typeof SignInQuickConnectCode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
