// Figma: MarkComparison — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=8-841
import { ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

/** How a release compares with the current file, such as "better": an up arrow and a word, no fill. */
function MarkComparison({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-0.75 rounded-xs px-1.5 font-ui text-xs font-semibold whitespace-nowrap text-foreground">
      <ArrowUp aria-hidden="true" className="size-3" />
      {children}
    </span>
  );
}

export { MarkComparison };
