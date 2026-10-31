// Settings, Playback: Load ahead, kept by the desktop app, so it is the same value the player's gear menu shows.
import { useEffect, useState } from 'react';
import { SettingsPlayback } from '@/components/ui/settings-playback';
import { desktopBridge } from '../desktopBridge';
import { LOAD_AHEAD, loadAheadChoice } from '../player/model';

/** Rendered only inside the desktop app; a plain browser has no player and no Load ahead. */
export function PlaybackSettings() {
  const bridge = desktopBridge();
  const [bytes, setBytes] = useState<number | null>(null);
  const read = () => {
    void bridge?.getLoadAhead().then(setBytes, () => undefined);
  };
  useEffect(read, [bridge]);
  if (bridge === undefined || bytes === null) return null;
  return (
    <SettingsPlayback
      loadAhead={loadAheadChoice(bytes).value}
      options={LOAD_AHEAD}
      onLoadAheadChange={(value) => {
        const option = LOAD_AHEAD.find((candidate) => candidate.value === value);
        if (option === undefined) return;
        setBytes(option.bytes);
        void bridge.setLoadAhead(option.bytes).catch(read);
      }}
    />
  );
}
