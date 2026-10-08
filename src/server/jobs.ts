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
};

export const createJobRunner = (timers: Timers = globalTimers) => {
  const jobs = new Map<string, Job>();
  const handles: unknown[] = [];
  let started = false;

  const tick = (job: Job) => {
    if (job.inFlight !== undefined) return;
    let result: Promise<void>;
    try {
      result = Promise.resolve(job.run());
    } catch {
      result = Promise.reject();
    }
    job.inFlight = result
      .catch(() => { console.error(`Job failed: ${job.name}`); })
      .finally(() => { job.inFlight = undefined; });
  };

  return {
    register(name: string, intervalMs: number, run: () => void | Promise<void>) {
      if (jobs.has(name)) throw new Error(`Duplicate job: ${name}`);
      if (started) throw new Error('Register jobs before start.');
      jobs.set(name, { name, intervalMs, run });
    },
    start() {
      if (started) return;
      started = true;
      for (const job of jobs.values()) handles.push(timers.setInterval(() => tick(job), job.intervalMs));
    },
    async stop() {
      if (!started) return;
      for (const handle of handles.splice(0)) timers.clearInterval(handle);
      started = false;
      await Promise.all([...jobs.values()].map((job) => job.inFlight));
    },
  };
};
