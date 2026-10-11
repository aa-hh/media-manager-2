import type { ReactNode } from 'react';
import { Button } from './components/ui/button';
import { HeaderPage } from './components/ui/header-page';

// Kept so Flagged, Health, History and Blocklist build until their screens use Button and HeaderPage directly.
export function ScreenButton({ children, onClick, disabled, filled }: { children: ReactNode; onClick: () => void; disabled?: boolean; filled?: boolean }) {
  return (
    <Button
      size="row"
      variant={filled ? 'default' : 'outline'}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onClick(); }}
    >
      {children}
    </Button>
  );
}

export function ScreenHeading({ title, summary, children }: { title: string; summary?: ReactNode; children?: ReactNode }) {
  return <HeaderPage title={title} summary={summary} action={children} />;
}
