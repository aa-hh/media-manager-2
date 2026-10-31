// Figma: CalloutInfo — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-751
import { Info } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type CalloutInfoProps = Omit<ComponentProps<'div'>, 'title'> & {
  /** A 16 px lucide icon; info by default. */
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** An outline Button. */
  action?: ReactNode;
};

/**
 * A fact to know, not a problem: muted fill, radius 12, no side bar. Unlike Callout's info look, the icon can be swapped,
 * such as a file icon for a rule read from the env file. Use Callout for risk and warning.
 */
function CalloutInfo({ icon, title, action, className, children, ...props }: CalloutInfoProps) {
  return (
    <div role="status" className={cn('flex w-full gap-2.5 rounded-md bg-muted px-3.5 py-3', className)} {...props}>
      <span aria-hidden="true" className="flex shrink-0 text-muted-foreground [&>svg]:size-4">{icon ?? <Info />}</span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className="font-ui text-sm font-semibold [overflow-wrap:anywhere] text-foreground">{title}</p>
        {children !== undefined && <p className="font-ui text-[13px] leading-[1.45] font-normal [overflow-wrap:anywhere] text-foreground">{children}</p>}
        {action !== undefined && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export { CalloutInfo };
