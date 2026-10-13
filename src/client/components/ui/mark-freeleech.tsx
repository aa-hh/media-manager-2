// v2/Mark/freeleech — ~/Projects/media-manager-2-design/design-system.lib.pen BUiSG
import { Percent } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

/** Freeleech on this tracker, 12 px after the tracker name. The tooltip names the kind, such as Freeleech 75%. */
function MarkFreeleech({ tooltip }: { tooltip: string }) {
  return (
    <Tooltip text={tooltip}>
      <span role="img" aria-label={tooltip} className="flex shrink-0 text-foreground [&>svg]:size-3">
        <Percent aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

export { MarkFreeleech };
