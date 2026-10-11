import { type ReactNode, type RefObject, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatBytes, formatDuration } from '../downloads/model';
import { ScreenButton, ScreenHeading } from '../screen';
import type { ConnectionStatus, HealthSnapshot, HealthState } from './useHealth';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const statusWord = (status: ConnectionStatus) => {
  switch (status.kind) {
    case 'ok': return `reachable ${status.version}`;
    case 'unreachable': return 'unreachable';
    case 'rejected': return 'credentials refused';
    case 'not_configured': return 'not connected yet';
  }
};

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex h-[30px] items-center gap-4 bg-[var(--mm-row)] px-5 font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-2)]">
      {children}
    </p>
  );
}

function Line({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--mm-seam)] px-5 py-2 text-[13px]', className)}>{children}</div>;
}

function Sections({ snapshot, now }: { snapshot: HealthSnapshot; now: number }) {
  const onTime = snapshot.jobs.filter((job) => !job.late && !job.lastFailed).length;
  const trackerColumns = 'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] gap-4';
  return (
    <>
      <SectionHeader>PROBLEMS</SectionHeader>
      {snapshot.problems.length === 0 && <Line className="text-[var(--mm-ink-2)]">Nothing needs attention.</Line>}
      {snapshot.problems.map((problem) => (
        <Line key={problem.id}>
          <span className={cn('w-16 font-data text-[11px] font-bold uppercase', problem.level === 'error' ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink)]')}>
            {problem.level === 'error' ? 'risk' : problem.level}
          </span>
          <span className="w-32 text-[var(--mm-ink-2)]">{problem.source}</span>
          <span className="min-w-0 flex-1 text-[var(--mm-ink)]">{problem.message}</span>
          {problem.docsUrl !== null && (
            <a href={problem.docsUrl} target="_blank" rel="noreferrer" className="text-[var(--mm-ink-2)] underline">Docs</a>
          )}
        </Line>
      ))}

      <SectionHeader>SERVICES</SectionHeader>
      {snapshot.services.map((service) => (
        <Line key={service.name}>
          <span className="w-32 text-[var(--mm-ink)]">{service.label}</span>
          <span className={service.status.kind === 'ok' ? 'text-[var(--mm-ink-2)]' : 'text-[var(--mm-risk)]'}>{statusWord(service.status)}</span>
          {service.update !== null && <span className="text-[var(--mm-ink-2)]">update available: {service.update}</span>}
        </Line>
      ))}

      <SectionHeader>TRACKER ACCOUNTS</SectionHeader>
      <div role="table" aria-label="Tracker accounts">
        <div role="row" className={cn(trackerColumns, 'px-5 py-1.5 font-data text-[11px] font-bold tracking-[0.6px] text-[var(--mm-ink-3)]')}>
          <span>TRACKER</span><span>GLOBAL RATIO</span><span>HIT AND RUN</span><span>COOLDOWN</span>
        </div>
        {snapshot.trackers.length === 0 && <Line className="text-[var(--mm-ink-2)]">No trackers seen yet.</Line>}
        {snapshot.trackers.map((tracker) => (
          <div role="row" key={tracker.host} className={cn(trackerColumns, 'border-b border-[var(--mm-seam)] px-5 py-2 text-[13px]')}>
            <span className="min-w-0 text-[var(--mm-ink)]">
              {tracker.host}
              {!tracker.reachable && <span className="text-[var(--mm-risk)]"> · not answering</span>}
            </span>
            <span className="text-[var(--mm-ink-3)]">not set up yet</span>
            <span className="text-[var(--mm-ink-3)]">not set up yet</span>
            <span className={tracker.cooldown?.known === false ? 'text-[var(--mm-risk)]' : 'text-[var(--mm-ink-2)]'}>
              {tracker.cooldown === null ? '' : `since ${new Date(tracker.cooldown.since).toLocaleString()} · "${tracker.cooldown.text}"`}
            </span>
          </div>
        ))}
      </div>

      <SectionHeader>DISK</SectionHeader>
      {snapshot.disks.map((disk) => {
        const used = disk.totalBytes > 0 ? Math.round(((disk.totalBytes - disk.freeBytes) / disk.totalBytes) * 100) : 100;
        return (
          <Line key={disk.path}>
            <span className="min-w-0 flex-1 text-[var(--mm-ink)]">{disk.path}</span>
            <span className="text-[var(--mm-ink)]">{used}% used</span>
            <span className="text-[var(--mm-ink-2)]">{formatBytes(disk.freeBytes)} free of {formatBytes(disk.totalBytes)}</span>
          </Line>
        );
      })}

      <SectionHeader>BACKGROUND JOBS</SectionHeader>
      <Line className="text-[var(--mm-ink-2)]">{onTime} ran on time</Line>
      {snapshot.jobs.filter((job) => job.late || job.lastFailed).map((job) => (
        <Line key={job.name}>
          <span className="w-48 text-[var(--mm-ink)]">{job.name}</span>
          <span className="text-[var(--mm-ink-2)]">
            {job.late ? `late · expected every ${formatDuration(job.intervalMs)}` : 'failed on its last run'}
          </span>
        </Line>
      ))}

      <SectionHeader>BACKUP</SectionHeader>
      <Line className="text-[var(--mm-ink-2)]">
        {snapshot.backup.kind === 'not_set_up' ? 'not set up yet' : `Cloudflare R2 · last ${formatDuration(now - snapshot.backup.lastAt)} ago`}
      </Line>
    </>
  );
}

export function HealthScreen({ state, runChecks, headingRef }: {
  state: HealthState;
  runChecks: () => Promise<void>;
  headingRef: RefObject<HTMLDivElement | null>;
}) {
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    void runChecks().finally(() => setRunning(false));
  };
  const now = Date.now();
  let summary: string | undefined;
  if (state.kind === 'ready') {
    const { problems, checkedAt } = state.snapshot;
    const risks = problems.filter((problem) => problem.level === 'error').length;
    summary = `${plural(problems.length, 'problem')}, ${risks} of them ${risks === 1 ? 'a risk' : 'risks'} · checked ${formatDuration(now - checkedAt)} ago`;
  }
  return (
    <section aria-label="Health">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <ScreenHeading title="Health" summary={summary}>
          <ScreenButton onClick={run} disabled={running}>{running ? 'Checking…' : 'Run all checks'}</ScreenButton>
        </ScreenHeading>
      </div>
      {state.kind === 'loading' && <p className="px-5 py-6 text-[13px] text-[var(--mm-ink-2)]">Reading health…</p>}
      {state.kind === 'failed' && (
        <div className="flex items-center gap-3 px-5 py-6 text-[13px]">
          <p role="alert" className="text-[var(--mm-risk)]">Health could not be read.</p>
          <ScreenButton onClick={run} disabled={running}>Try again</ScreenButton>
        </div>
      )}
      {state.kind === 'ready' && <Sections snapshot={state.snapshot} now={now} />}
    </section>
  );
}
