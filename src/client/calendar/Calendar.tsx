import type { DownloadsState } from '../downloads/useDownloads';

export function Calendar(_props: { downloads: DownloadsState; onUnauthenticated: () => void }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[var(--mm-ground)] px-4 pt-6 text-[var(--mm-ink)] sm:px-6">
      <h1 className="font-ui text-[20px] font-semibold">Calendar</h1>
      <p className="mt-2 font-ui text-[14px] text-[var(--mm-ink-2)]">The calendar arrives with the calendar ticket.</p>
    </div>
  );
}
