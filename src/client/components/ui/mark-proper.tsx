// Figma: MarkProper — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-902
import { Wrench } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

/** A proper or repack release, 12 px after the quality. The tooltip says which. */
function MarkProper({ tooltip }: { tooltip: string }) {
  return (
    <Tooltip text={tooltip}>
      <span role="img" aria-label={tooltip} className="flex shrink-0 text-muted-foreground [&>svg]:size-3">
        <Wrench aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

export { MarkProper };
