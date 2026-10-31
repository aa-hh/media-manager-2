// Figma: MenuResume — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=106-825
import { Play, RotateCcw } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type MenuResumeProps = Pick<ComponentProps<typeof DropdownMenuContent>, 'side' | 'align' | 'sideOffset'> & {
  /** The saved position, such as "21:00". */
  resumeAt: string;
  onResume: () => void;
  onRestart: () => void;
  /** The title's versions, highest quality first; the Version group shows only when there are two or more. */
  versions?: { value: string; label: ReactNode }[];
  version?: string;
  onVersionChange?: (value: string) => void;
};

const label = 'px-2 pt-1.5 pb-0.5';

/**
 * The menu the header's Resume button, an episode still or a library card's Resume opens when there is a saved position:
 * Start (Resume from, Play from the start), then Version with the default ticked. Picking a version keeps the menu open.
 */
function MenuResume({ resumeAt, onResume, onRestart, versions, version, onVersionChange, ...props }: MenuResumeProps) {
  return (
    <DropdownMenuContent {...props}>
      <DropdownMenuGroup>
        <DropdownMenuGroupLabel className={label}>Start</DropdownMenuGroupLabel>
        <DropdownMenuItem icon={<Play />} onClick={onResume}>Resume from {resumeAt}</DropdownMenuItem>
        <DropdownMenuItem icon={<RotateCcw />} onClick={onRestart}>Play from the start</DropdownMenuItem>
      </DropdownMenuGroup>
      {versions !== undefined && versions.length > 1 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel className={label}>Version</DropdownMenuGroupLabel>
            <DropdownMenuRadioGroup value={version} onValueChange={(value) => onVersionChange?.(String(value))}>
              {versions.map((item) => (
                <DropdownMenuRadioItem key={item.value} value={item.value} closeOnClick={false}>{item.label}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </>
      )}
    </DropdownMenuContent>
  );
}

export { MenuResume };
