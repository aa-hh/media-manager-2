import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef } from 'react';
import { ToastNumber, ToastProvider, useToastManager } from '@/components/ui/toast';
import { fn } from 'storybook/test';

type ToastOptions = Parameters<ReturnType<typeof useToastManager>['add']>[0];

// Screens raise toasts through the manager; this adds one on mount. Timeout 0 keeps it on screen.
function AddToast(options: ToastOptions) {
  const toasts = useToastManager();
  const added = useRef(false);
  useEffect(() => {
    if (added.current) return;
    added.current = true;
    toasts.add({ timeout: 0, ...options });
  }, []);
  return null;
}

const meta = {
  title: 'UI/Toast',
  component: ToastProvider,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-838' } },
  args: { children: <AddToast title="Folders saved" /> },
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: { children: <AddToast title="Sent to Sonarr." description="media-manager-2 will finish the replace when the download completes." /> },
};

export const ErrorType: Story = {
  args: { children: <AddToast type="error" title="Trackers could not be read" description="Check that media-manager-2 is running, then open Settings again." /> },
};

export const InfoType: Story = {
  args: { children: <AddToast type="info" title="Switch to Plex cancelled" description="Plex sign-in closed before it finished. Jellyfin is still in use." /> },
};

export const WithAction: Story = {
  args: {
    children: (
      <AddToast
        title="Unblocked Severance.S02E01.Hello.Ms.Cobel.1080p.ATVP.WEB-DL.DDP5.1.H.264-FLUX"
        description="Sonarr can grab that release again on the next search."
        actionProps={{ children: 'Undo', onClick: fn() }}
      />
    ),
  },
};

// The add dialog's toast; without `from` the number appears in place.
export const WithNumber: Story = {
  args: {
    children: <AddToast title="Added Severance to your library" description={<>Sonarr is searching <ToastNumber from={undefined}>19</ToastNumber> aired episodes.</>} />,
  },
};
