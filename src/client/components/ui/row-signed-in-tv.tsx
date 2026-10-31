// Figma: RowSignedInTv — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=154-1621
import type { ComponentProps, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type RowSignedInTvProps = Omit<ComponentProps<'div'>, 'children'> & {
  /** The name the TV signed in with. */
  name: ReactNode;
  /** When it signed in and was last used, in the data font. */
  dates: ReactNode;
  onSignOut: () => void;
  /** Sign out is off while another sign-out is in flight. */
  disabled?: boolean;
};

/** A signed-in TV in Settings, 56 px: name over its dates, Sign out at row size. No logo and no pill, unlike RowService. */
function RowSignedInTv({ name, dates, onSignOut, disabled = false, className, ...props }: RowSignedInTvProps) {
  return (
    <div className={cn('flex h-14 w-full items-center gap-3 px-4', className)} {...props}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-ui text-sm font-semibold text-foreground">{name}</span>
        <span className="truncate font-data text-[13px] font-normal text-muted-foreground">{dates}</span>
      </span>
      <Button variant="outline" size="row" disabled={disabled} onClick={onSignOut}>Sign out</Button>
    </div>
  );
}

export { RowSignedInTv };
