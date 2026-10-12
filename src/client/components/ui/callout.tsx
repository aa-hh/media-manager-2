// v2/Callout — design/design-system.lib.pen BXgoa
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CalloutLook = 'risk' | 'warning' | 'info';

const looks: Record<CalloutLook, { fill: string; icon: ReactNode }> = {
  risk: { fill: 'bg-destructive-soft', icon: <TriangleAlert aria-hidden="true" className="text-destructive" /> },
  warning: { fill: 'bg-warning-soft', icon: <CircleAlert aria-hidden="true" className="text-warning" /> },
  info: { fill: 'bg-muted', icon: <Info aria-hidden="true" className="text-muted-foreground" /> },
};

type CalloutProps = Omit<ComponentProps<'div'>, 'title'> & {
  look?: CalloutLook;
  title: ReactNode;
  /** What to do about it, one or two sentences. */
  children?: ReactNode;
  /** An outline Button, such as Retry. */
  action?: ReactNode;
};

/** A message inside the page: what went wrong and what to do. Flat, radius 8, no side bar. */
function Callout({ look = 'risk', title, action, className, children, ...props }: CalloutProps) {
  return (
    <div
      role={look === 'info' ? 'status' : 'alert'}
      className={cn('flex w-full gap-2.5 rounded-md px-3.5 py-3 [&>svg]:size-4 [&>svg]:shrink-0', looks[look].fill, className)}
      {...props}
    >
      {looks[look].icon}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="font-ui text-sm font-semibold [overflow-wrap:anywhere] text-foreground">{title}</p>
        {children !== undefined && <p className="max-w-[60ch] font-ui text-[13px] leading-[1.45] font-normal [overflow-wrap:anywhere] text-foreground">{children}</p>}
        {action !== undefined && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export { Callout };
export type { CalloutLook };
