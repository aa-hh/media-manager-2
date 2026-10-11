let sink: (line: string) => void = console.log;

export const setLogSink = (fn: (line: string) => void) => {
  sink = fn;
};

export const logEvent = (kind: string, fields: Record<string, unknown>) => sink(JSON.stringify({ at: new Date().toISOString(), kind, ...fields }));
