export type Timers = {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

export const globalTimers: Timers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

type Job = {
  name: string;
  intervalMs: number;
  run: () => void | Promise<void>;
  inFlight?: Promise<void>;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastFailed: boolean;
};

export const createJobRunner = (timers: Timers = globalTimers, now: () => number = Date.now) => {
  const jobs = new Map<string, Job>();
  const handles: unknown[] = [];
  let started = false;
  let startedAt: number | null = null;

  const tick = (job: Job) => {
    if (job.inFlight !== undefined) return;
    job.lastStartedAt = now();
    let result: Promise<void>;
    try {
      result = Promise.resolve(job.run());
    } catch {
      result = Promise.reject();
    }
    job.inFlight = result
      .then(() => { job.lastFailed = false; })
      .catch(() => {
        job.lastFailed = true;
        console.error(`Job failed: ${job.name}`);
      })
      .finally(() => {
        job.lastFinishedAt = now();
        job.inFlight = undefined;
      });
  };

  return {
    register(name: string, intervalMs: number, run: () => void | Promise<void>) {
      if (jobs.has(name)) throw new Error(`Duplicate job: ${name}`);
      if (started) throw new Error('Register jobs before start.');
      jobs.set(name, { name, intervalMs, run, lastStartedAt: null, lastFinishedAt: null, lastFailed: false });
    },
    start() {
      if (started) return;
      started = true;
      startedAt = now();
      for (const job of jobs.values()) handles.push(timers.setInterval(() => tick(job), job.intervalMs));
    },
    // A job is late when it has not finished within three intervals, counted from start when it never ran.
    status() {
      const at = now();
      return [...jobs.values()].map((job) => ({
        name: job.name,
        intervalMs: job.intervalMs,
        lastStartedAt: job.lastStartedAt,
        lastFinishedAt: job.lastFinishedAt,
        lastFailed: job.lastFailed,
        late: startedAt !== null && (job.lastFinishedAt ?? startedAt) + 3 * job.intervalMs < at,
      }));
    },
    async stop() {
      if (!started) return;
      for (const handle of handles.splice(0)) timers.clearInterval(handle);
      started = false;
      await Promise.all([...jobs.values()].map((job) => job.inFlight));
    },
  };
};
