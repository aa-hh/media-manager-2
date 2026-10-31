// Figma: StatusServicePill — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-3119
import { PencilLine } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

type ServiceState = 'connected' | 'not-set-up' | 'failed' | 'testing' | 'unsaved';

const fills: Record<ServiceState, string> = {
  connected: 'bg-muted',
  'not-set-up': 'bg-muted',
  failed: 'bg-destructive-soft',
  testing: 'bg-muted',
  unsaved: 'bg-warning-soft',
};

type StatusServicePillProps = ComponentProps<'span'> & {
  /** A Logo at 16 px. */
  logo: ReactNode;
  name: ReactNode;
  state: ServiceState;
  /** State words, such as "Connected · 4.0.10" or "Failed: login refused". */
  children: ReactNode;
  /** Logo and dot only; name and state stay for screen readers. Pair it with a Tooltip. */
  compact?: boolean;
  /** Setup wizard strip only (DESIGN.md exception): connected is black with a lime dot, or lime once setup is done. */
  look?: 'plain' | 'dark' | 'lime';
};

/** A service or tracker with its real logo and its state. */
function StatusServicePill({ logo, name, state, compact = false, look = 'plain', className, children, ...props }: StatusServicePillProps) {
  const hidden = compact && 'sr-only';
  const lit = state === 'connected' && look !== 'plain' ? look : undefined;
  return (
    <span
      className={cn('inline-flex h-6.5 shrink-0 items-center gap-1.5 rounded-sm pr-2 pl-1.25 transition-colors duration-(--duration-base) ease-out [&>span]:transition-colors [&>span]:duration-(--duration-base)', compact ? 'bg-transparent px-1' : lit === 'dark' ? 'bg-bar' : lit === 'lime' ? 'bg-live' : fills[state], className)}
      {...props}
    >
      <span className="flex shrink-0 [&>img]:size-4">{logo}</span>
      <span className={cn('font-ui text-[13px] font-semibold', lit === 'dark' ? 'text-bar-foreground' : lit === 'lime' ? 'text-best-foreground' : 'text-foreground', hidden)}>{name}</span>
      {(state === 'connected' || state === 'failed') && (
        <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', state === 'failed' ? 'bg-destructive' : lit === 'dark' ? 'bg-live' : lit === 'lime' ? 'bg-best-foreground' : 'bg-foreground')} />
      )}
      {state === 'not-set-up' && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full border border-subtle-foreground" />}
      {state === 'testing' && <Spinner className="size-3" />}
      {state === 'unsaved' && <PencilLine aria-hidden="true" className="size-3 shrink-0 text-warning" />}
      <span
        className={cn(
          'font-data text-[13px]',
          state === 'failed' ? 'text-destructive' : state === 'unsaved' ? 'text-warning'
            : lit === 'dark' ? 'text-bar-muted-foreground' : lit === 'lime' ? 'text-best-foreground' : 'text-muted-foreground',
          hidden,
        )}
      >
        {children}
      </span>
    </span>
  );
}

export { StatusServicePill };
export type { ServiceState };
