// v2/Row/service — ~/Projects/media-manager-2-design/design-system.lib.pen okfXn
import type { ComponentProps, ReactNode } from 'react';
import { Logo, type LogoName } from '@/components/ui/logo';
import { StatusServicePill, type ServiceState } from '@/components/ui/status-service-pill';
import { cn } from '@/lib/utils';

type RowServiceProps = Omit<ComponentProps<'button'>, 'children'> & {
  logo: LogoName;
  name: ReactNode;
  /** The service's address, in the data font. */
  address: ReactNode;
  state: ServiceState;
  /** State words for the pill, such as "Connected" or "Unsaved edits". */
  stateText: ReactNode;
  selected?: boolean;
};

/** A row in the settings service list, 56 px. Selected: grey tint and the 3 px black side bar. */
function RowService({ logo, name, address, state, stateText, selected = false, className, ...props }: RowServiceProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      className={cn(
        'relative flex h-14 w-full items-center gap-3 rounded-sm px-4 text-left',
        'transition-colors duration-(--duration-fast) ease-out active:duration-0 focus-ring',
        selected ? 'bg-selected' : 'hover:bg-surface-hover active:bg-surface-pressed',
        className,
      )}
      {...props}
    >
      {/* Always present and out of the flow, so selecting a row moves nothing; only its opacity changes. */}
      <span aria-hidden="true" className={cn('absolute top-2 bottom-2 left-0 w-0.75 rounded-[2px] bg-foreground transition-opacity duration-(--duration-fast) ease-out', !selected && 'opacity-0')} />
      <Logo name={logo} alt="" className="size-6" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-ui text-sm font-semibold text-foreground">{name}</span>
        <span className="truncate font-data text-[13px] font-normal text-muted-foreground">{address}</span>
      </span>
      {/* The pill with its logo and name off: its first two children (logo and name) are hidden; the dot stays. */}
      <StatusServicePill logo={null} name={null} state={state} className="[&>span:nth-child(-n+2)]:hidden">
        {stateText}
      </StatusServicePill>
    </button>
  );
}

export { RowService };
