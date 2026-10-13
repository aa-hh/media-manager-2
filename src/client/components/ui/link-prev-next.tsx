// v2/Link prev-next — ~/Projects/media-manager-2-design/design-system.lib.pen U5XiTa
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Step = { label: string; onClick: () => void };

const look = 'gap-1.5 text-muted-foreground';

/** Previous and next links, such as S02E06 and S02E08 either side of an episode. Each chevron sits before its label, as the library draws it. */
function LinkPrevNext({ previous, next }: { previous?: Step; next?: Step }) {
  return (
    <div className="flex items-center gap-1">
      {previous !== undefined && <Button variant="ghost" className={look} icon={<ChevronLeft />} onClick={previous.onClick}>{previous.label}</Button>}
      {next !== undefined && <Button variant="ghost" className={look} icon={<ChevronRight />} onClick={next.onClick}>{next.label}</Button>}
    </div>
  );
}

export { LinkPrevNext };
