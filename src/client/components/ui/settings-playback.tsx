// Figma: SettingsPlayback — https://www.figma.com/design/xXlrfBjHLkPumAfRzEFXtO/media-manager-2----design-library?node-id=117-5453
import { useId } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

type SettingsPlaybackProps = {
  /** The chosen Load ahead value; the player's gear menu reads and writes the same one. */
  loadAhead: string;
  /** 30 s, 1 min, 2 min, 5 min, 10 min. */
  options: { value: string; label: string }[];
  onLoadAheadChange: (value: string) => void;
  className?: string;
};

/** The Playback panel in Settings, shown only in the desktop app: Load ahead as a toggle group, and how quality works. */
function SettingsPlayback({ loadAhead, options, onLoadAheadChange, className }: SettingsPlaybackProps) {
  const labelId = useId();
  return (
    <section className={cn('flex w-180 flex-col gap-5 rounded-lg border border-border bg-card p-6', className)}>
      <h2 className="font-ui text-base font-bold text-foreground">Playback</h2>
      <div className="flex flex-col gap-2">
        <span id={labelId} className="font-ui text-[13px] font-semibold text-foreground">Load ahead</span>
        <ToggleGroup aria-labelledby={labelId} value={loadAhead} onValueChange={onLoadAheadChange} className="self-start">
          {options.map((option) => <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>)}
        </ToggleGroup>
        <p className="font-ui text-[13px] leading-[1.5] text-muted-foreground">
          How far ahead the player loads from Plex while you watch. More rides out a slow connection to the server and uses more memory on this computer. Changing it in the player changes it here.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-ui text-[13px] font-semibold text-foreground">Quality</span>
        <p className="font-ui text-[13px] leading-[1.5] text-muted-foreground">Every title starts at Original. A lower quality picked in the player lasts until the player closes.</p>
      </div>
    </section>
  );
}

export { SettingsPlayback };
