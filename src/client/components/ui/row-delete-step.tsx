// Figma: RowDeleteStep — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=10-8538
import { CircleCheck, CirclePause, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StepLook = 'done' | 'kept' | 'failed';

const icons: Record<StepLook, ReactNode> = {
  done: <CircleCheck aria-hidden="true" className="text-foreground" />,
  kept: <CirclePause aria-hidden="true" className="text-muted-foreground" />,
  failed: <TriangleAlert aria-hidden="true" className="text-warning" />,
};

/** One step of a delete, in the order it ran, with why under it. A failed step is amber, since the rest still ran. */
function RowDeleteStep({ look, text, why }: { look: StepLook; text: string; why?: string | null }) {
  return (
    <div className="flex w-full gap-2.5 border-b border-border py-2.5 [&>svg]:size-4 [&>svg]:shrink-0">
      {icons[look]}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 font-ui text-[13px]">
        <span className={cn('font-medium [overflow-wrap:anywhere]', look === 'failed' ? 'text-warning' : 'text-foreground')}>{text}</span>
        {why !== null && why !== undefined && why !== '' && <span className="text-muted-foreground [overflow-wrap:anywhere] select-text">{why}</span>}
      </div>
    </div>
  );
}

export { RowDeleteStep };
