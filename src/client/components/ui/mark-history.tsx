// Figma: MarkHistory — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-862
import { Ban, CircleX, History } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const looks = {
  failed: { Icon: CircleX, tone: 'text-destructive' },
  blocklisted: { Icon: Ban, tone: 'text-destructive' },
  grabbed: { Icon: History, tone: 'text-muted-foreground' },
} as const;

/** What happened to this release before, 14 px at the release cell's right edge: failed, blocklisted or grabbed. The tooltip says when. */
function MarkHistory({ kind, tooltip }: { kind: keyof typeof looks; tooltip: string }) {
  const { Icon, tone } = looks[kind];
  return (
    <Tooltip text={tooltip}>
      <span role="img" aria-label={tooltip} className={cn('flex shrink-0 [&>svg]:size-3.5', tone)}>
        <Icon aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

export { MarkHistory };
