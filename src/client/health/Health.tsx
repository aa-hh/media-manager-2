import { CircleCheck, CircleX, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import { type ReactNode, type RefObject, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { EmptyState } from '@/components/ui/empty-state';
import { FactRow } from '@/components/ui/fact';
import { HeaderPage } from '@/components/ui/header-page';
import { LabelGroup } from '@/components/ui/label-group';
import { Logo, trackerLogo, trackerName } from '@/components/ui/logo';
import { RowHealthProblem } from '@/components/ui/row-health-problem';
import { SkeletonRowTwoLine } from '@/components/ui/skeleton';
import { StatusInline } from '@/components/ui/status-inline';
import { type ServiceState, StatusServicePill } from '@/components/ui/status-service-pill';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatBytes, formatDuration } from '../downloads/model';
import { useScreenReady } from '../navigation';
import type { ConnectionStatus, HealthProblem, HealthSnapshot, HealthState } from './useHealth';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const serviceStatus = (status: ConnectionStatus): { state: ServiceState; words: string } => {
  switch (status.kind) {
    case 'ok': return { state: 'connected', words: `Reachable · ${status.version}` };
    case 'unreachable': return { state: 'failed', words: 'Unreachable' };
    case 'rejected': return { state: 'failed', words: 'Credentials refused' };
    case 'not_configured': return { state: 'not-set-up', words: 'Not connected yet' };
  }
};

const levels: Record<HealthProblem['level'], { word: string; icon: ReactNode; text: string; marker?: 'risk' | 'warning' }> = {
  error: { word: 'Risk', icon: <CircleX className="text-destructive" />, text: 'text-destructive', marker: 'risk' },
  warning: { word: 'Warning', icon: <TriangleAlert className="text-warning" />, text: 'text-warning', marker: 'warning' },
  notice: { word: 'Notice', icon: <Info className="text-muted-foreground" />, text: 'text-muted-foreground' },
};

const problemLogo = (source: HealthProblem['source']) => {
  if (source === 'Sonarr') return <Logo name="sonarr" alt="" />;
  if (source === 'Radarr') return <Logo name="radarr" alt="" />;
  return <span aria-hidden="true" className="size-5" />;
};

type TrackerAccount = HealthSnapshot['trackers'][number]['account'];
const unavailableWords = { rejected: 'credentials refused', unreachable: 'not answering', unsupported: 'not available from this tracker' };

function AccountCell({ account, className, value }: { account: TrackerAccount; className?: string; value: (account: Extract<TrackerAccount, { kind: 'ok' }>) => ReactNode }) {
  return (
    <TableCell fill={className === undefined} className={className}>
      {account.kind === 'ok'
        ? value(account)
        : (
          <span className={cn('truncate', account.kind === 'unavailable' && account.reason === 'rejected' ? 'text-destructive' : 'text-subtle-foreground')}>
            {account.kind === 'not_set_up' ? 'not set up yet' : unavailableWords[account.reason]}
          </span>
        )}
    </TableCell>
  );
}

function Sections({ snapshot, now }: { snapshot: HealthSnapshot; now: number }) {
  const onTime = snapshot.jobs.filter((job) => !job.late && !job.lastFailed).length;
  return (
    <>
      <section className="flex flex-col">
        <LabelGroup count={snapshot.problems.length}>Problems</LabelGroup>
        {snapshot.problems.length === 0
          ? (
            <div className="rounded-lg border border-border bg-card py-6">
              <EmptyState icon={<CircleCheck />} title="Nothing needs attention" />
            </div>
          )
          : (
            <Table aria-label="Problems">
              <TableHeader>
                <TableHead className="w-7" />
                <TableHead fill>Problem</TableHead>
                <TableHead className="w-30" />
                <TableHead className="w-70">Level</TableHead>
                <TableHead className="w-30" />
              </TableHeader>
              {snapshot.problems.map((problem) => {
                const level = levels[problem.level];
                return (
                  <RowHealthProblem
                    key={problem.id}
                    marker={level.marker}
                    logo={problemLogo(problem.source)}
                    problem={<span title={problem.message}>{problem.message}</span>}
                    detail={problem.source}
                    fixIcon={level.icon}
                    fix={<span className={level.text}>{level.word}</span>}
                    actions={problem.docsUrl !== null && (
                      <Button variant="outline" size="row" nativeButton={false} render={<a href={problem.docsUrl} target="_blank" rel="noreferrer" />}>
                        Docs
                      </Button>
                    )}
                  />
                );
              })}
            </Table>
          )}
      </section>

      <div className="flex flex-wrap gap-10">
        <div className="flex min-w-0 flex-1 basis-150 flex-col">
          <section className="flex flex-col">
            <LabelGroup count={snapshot.services.length}>Services</LabelGroup>
            <div className="flex flex-wrap gap-2">
              {snapshot.services.map((service) => {
                const { state, words } = serviceStatus(service.status);
                return (
                  <StatusServicePill key={service.name} logo={service.name === 'tmdb' || service.name === 'mdblist' ? null : <Logo name={service.name} alt="" />} name={service.label} state={state}>
                    {service.update === null ? words : `${words} · update available: ${service.update}`}
                  </StatusServicePill>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col">
            <LabelGroup count={snapshot.trackers.length}>Tracker accounts</LabelGroup>
            <Table aria-label="Tracker accounts">
              <TableHeader>
                <TableHead className="w-40">Tracker</TableHead>
                <TableHead fill>Global ratio</TableHead>
                <TableHead className="w-35">Hit and run</TableHead>
                <TableHead className="w-60">Cooldown</TableHead>
              </TableHeader>
              {snapshot.trackers.length === 0 && (
                <TableRow><TableCell fill className="font-ui text-muted-foreground">No trackers seen yet.</TableCell></TableRow>
              )}
              {snapshot.trackers.map((tracker) => {
                const logo = trackerLogo(tracker.host);
                return (
                  <TableRow key={tracker.host}>
                    <TableCell className="w-40 gap-2">
                      {logo !== undefined && <Logo name={logo} alt="" className="size-4" />}
                      <span className="truncate font-ui font-semibold">{trackerName(tracker.host)}</span>
                      {!tracker.reachable && <span className="shrink-0 text-destructive">· not answering</span>}
                    </TableCell>
                    <AccountCell account={tracker.account} value={(account) => (account.ratio === null ? '—' : (
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="font-semibold">{account.ratio.toFixed(2)}</span>
                        {account.ratioMinimum !== null && <span className="truncate text-subtle-foreground">of minimum {account.ratioMinimum}</span>}
                      </span>
                    ))} />
                    <AccountCell account={tracker.account} className="w-35" value={(account) => {
                      if (account.hitAndRuns === null) return '—';
                      return account.hitAndRunsIsLifetime ? `${account.hitAndRuns} lifetime` : String(account.hitAndRuns);
                    }} />
                    <TableCell className={tracker.cooldown?.known === false ? 'w-60 text-destructive' : 'w-60 text-muted-foreground'}>
                      {tracker.cooldown === null
                        ? <span className="truncate">none</span>
                        : <span className="truncate" title={tracker.cooldown.text}>since {new Date(tracker.cooldown.since).toLocaleString()} · "{tracker.cooldown.text}"</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </Table>
          </section>
        </div>

        <div className="flex w-130 max-w-full shrink-0 flex-col">
          <section className="flex flex-col">
            <LabelGroup>Disk</LabelGroup>
            {snapshot.disks.length === 0 && <p className="font-ui text-sm text-muted-foreground">No disk space reported yet.</p>}
            <dl className="m-0">
              {snapshot.disks.map((disk) => {
                const used = disk.totalBytes > 0 ? Math.round(((disk.totalBytes - disk.freeBytes) / disk.totalBytes) * 100) : 100;
                return (
                  <FactRow key={disk.path} label={disk.path} progress={used} note={`${formatBytes(disk.freeBytes)} free of ${formatBytes(disk.totalBytes)}`}>
                    {used}% used
                  </FactRow>
                );
              })}
            </dl>
          </section>

          <section className="flex flex-col">
            <LabelGroup>Background jobs</LabelGroup>
            <dl className="m-0">
              <FactRow label="On time">{onTime} ran on time</FactRow>
              {snapshot.jobs.filter((job) => job.late || job.lastFailed).map((job) => (
                <FactRow key={job.name} label={job.name}>
                  {job.late
                    ? <span className="text-warning">late · expected every {formatDuration(job.intervalMs)}</span>
                    : <span className="text-destructive">failed on its last run</span>}
                </FactRow>
              ))}
            </dl>
          </section>

          <section className="flex flex-col">
            <LabelGroup>Backup</LabelGroup>
            <dl className="m-0">
              <FactRow label="Backup">
                {snapshot.backup.kind === 'not_set_up' ? 'not set up'
                  : snapshot.backup.kind === 'off' ? 'off'
                    : snapshot.backup.kind === 'failing' ? <span className="text-destructive">failing · {snapshot.backup.detail}</span>
                      : `last ${formatDuration(now - snapshot.backup.lastAt)} ago`}
              </FactRow>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

export function HealthScreen({ state, runChecks, headingRef }: {
  state: HealthState;
  runChecks: () => Promise<void>;
  headingRef: RefObject<HTMLDivElement | null>;
}) {
  const [running, setRunning] = useState(false);
  useScreenReady(state.kind !== 'loading');
  const run = () => {
    setRunning(true);
    void runChecks().finally(() => setRunning(false));
  };
  const now = Date.now();
  let summary: string | undefined;
  if (running) summary = 'checking now…';
  else if (state.kind === 'ready') {
    const { problems, checkedAt } = state.snapshot;
    const risks = problems.filter((problem) => problem.level === 'error').length;
    summary = `${plural(problems.length, 'problem')}, ${risks} of them ${risks === 1 ? 'a risk' : 'risks'} · checked ${formatDuration(now - checkedAt)} ago`;
  }
  return (
    <section aria-label="Health" className="flex flex-col gap-6 pt-2 pb-6">
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        <HeaderPage
          title="Health"
          summary={summary}
          action={<Button variant="outline" icon={<RefreshCw />} loading={running} onClick={run}>{running ? 'Checking…' : 'Run all checks'}</Button>}
        />
      </div>
      {state.kind === 'loading' && (
        <div className="flex flex-col gap-3">
          <StatusInline status="busy">Reading health…</StatusInline>
          <div className="flex flex-col">
            {[0, 1, 2, 3, 4].map((index) => <SkeletonRowTwoLine key={index} />)}
          </div>
        </div>
      )}
      {state.kind === 'failed' && (
        <Callout title="Health could not be read." action={<Button variant="outline" size="row" loading={running} onClick={run}>Try again</Button>} />
      )}
      {state.kind === 'ready' && <Sections snapshot={state.snapshot} now={now} />}
    </section>
  );
}
