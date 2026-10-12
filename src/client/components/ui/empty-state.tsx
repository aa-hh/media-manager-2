// v2/Empty state — design/design-system.lib.pen t80nQS
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** A 20 px lucide icon, such as Flag. */
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** One outline Button for the next step; leave out when there is nothing to do. */
  action?: ReactNode;
};

/** Nothing to show yet, said plainly with one next step. Centred, 360 px. */
function EmptyState({ icon, title, action, className, children, ...props }: EmptyStateProps) {
  return (
    <div className={cn('mx-auto flex w-90 max-w-full flex-col items-center gap-2 p-6 text-center', className)} {...props}>
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
        {icon}
      </span>
      <p className="font-ui text-base font-bold [overflow-wrap:anywhere] text-foreground">{title}</p>
      {children !== undefined && <p className="w-full font-ui text-sm leading-[1.45] font-normal text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
