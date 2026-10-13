// v2/Navigation/Phone — ~/Projects/media-manager-2-design/design-system.lib.pen FCUUC
import { ChevronLeft, Ellipsis } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type NavigationPhoneProps = {
  title: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  onMore?: () => void;
  moreLabel?: string;
  /** An InputSearch; shown full width under the bar. */
  search?: ReactNode;
};

const square = 'size-11 px-0 [&>svg]:size-5';

/** The phone's top bar: back, centred title, a more button, and an optional search field under it. */
function NavigationPhone({ title, onBack, backLabel = 'Back', onMore, moreLabel = 'More', search }: NavigationPhoneProps) {
  return (
    <header className="flex w-full flex-col border-b border-border bg-card">
      <div className="flex h-13 items-center px-1">
        {onBack !== undefined ? <Button variant="ghost" iconOnly className={square} icon={<ChevronLeft />} aria-label={backLabel} onClick={onBack} /> : <span className="size-11" />}
        <h1 className="min-w-0 flex-1 truncate text-center font-ui text-[17px] font-bold text-foreground">{title}</h1>
        {onMore !== undefined ? <Button variant="ghost" iconOnly className={square} icon={<Ellipsis />} aria-label={moreLabel} onClick={onMore} /> : <span className="size-11" />}
      </div>
      {search !== undefined && <div className="px-4 pb-3 [&>div]:h-11 [&>div]:px-3.5">{search}</div>}
    </header>
  );
}

export { NavigationPhone };
