import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArrowLeft, ArrowRight, Plug, RefreshCw, Undo2 } from 'lucide-react';
import { fn } from 'storybook/test';
import { BarBottomAction } from '@/components/ui/bar-bottom-action';
import { Button } from '@/components/ui/button';

const meta = {
  title: 'Overlays & bars/BarBottomAction',
  component: BarBottomAction,
  tags: ['autodocs'],
  parameters: { design: { type: 'figma', url: 'https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8292' } },
  args: {
    summary: 'Unticked parts are skipped. Settings has them later.',
    action: <Button size="large" icon={<ArrowRight />} onClick={fn()}>Start with Sonarr</Button>,
  },
} satisfies Meta<typeof BarBottomAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inline: Story = {};

export const Phone: Story = { args: { inline: false } };

export const WithSecondary: Story = {
  args: {
    summary: 'Check tests each key. Leave any blank to add it later in Settings.',
    secondary: <Button variant="outline" onClick={fn()}>Skip posters and ratings</Button>,
    action: <Button size="large" onClick={fn()}>Save and continue</Button>,
  },
};

export const UnsavedEdits: Story = {
  args: {
    summary: 'Connect tests the new address, then saves. If the test fails, nothing changes.',
    unsavedNote: 'Unsaved edits',
    secondary: <Button variant="outline" icon={<Undo2 />} onClick={fn()}>Discard edits</Button>,
    action: <Button size="large" icon={<Plug />} onClick={fn()}>Connect</Button>,
  },
};

export const Testing: Story = {
  args: {
    summary: 'Testing http://192.168.1.20:8989. Takes up to 10 seconds.',
    secondary: <Button variant="outline" icon={<Undo2 />} disabled>Discard edits</Button>,
    action: <Button size="large" icon={<Plug />} loading>Testing…</Button>,
  },
};

export const WizardStep: Story = {
  args: {
    summary: 'Sonarr is saved. Continue moves on to Radarr.',
    secondary: <Button variant="outline" icon={<ArrowLeft />} onClick={fn()}>Back</Button>,
    action: <Button size="large" icon={<ArrowRight />} onClick={fn()}>Continue</Button>,
  },
};

export const CheckNow: Story = {
  args: {
    summary: 'Nothing to save. Change a field and Connect tests it before saving.',
    secondary: <Button variant="ghost" icon={<RefreshCw />} onClick={fn()}>Check now</Button>,
    action: <Button size="large" icon={<Plug />} disabled>Connect</Button>,
  },
};
