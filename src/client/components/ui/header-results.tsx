// v2/Header/results — ~/Projects/media-manager-2-design/design-system.lib.pen RiBvU
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type HeaderResultsProps = ComponentProps<'header'> & {
  /** Words such as "6 results for". */
  count: ReactNode;
  /** The query, such as “dune”. */
  query: ReactNode;
  /** A ToggleGroup: All, TV, Movies with counts. */
  filter?: ReactNode;
};

/** Above search results, 56 px. */
function HeaderResults({ count, query, filter, className, ...props }: HeaderResultsProps) {
  return (
    <header className={cn('flex h-14 w-full items-center gap-2', className)} {...props}>
      <h1 className="shrink-0 font-ui text-xl font-bold text-foreground">{count}</h1>
      <p className="min-w-0 flex-1 truncate font-ui text-xl font-medium text-muted-foreground">{query}</p>
      {filter}
    </header>
  );
}

export { HeaderResults };
