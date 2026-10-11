export type PublishedEvent = { id: number; type: string; data: unknown };

export type EventHub = {
  publish(type: string, data: unknown): number;
  subscribe(listener: (event: PublishedEvent) => void): () => void;
};

// razor: no replay buffer and no Last-Event-ID; a reconnecting browser receives only later events. Upgrade path: ring buffer keyed by id replayed from Last-Event-ID.
export const createEventHub = (): EventHub => {
  const listeners = new Set<(event: PublishedEvent) => void>();
  let lastId = 0;
  return {
    publish(type, data) {
      if (type === '' || /[\r\n]/.test(type)) throw new TypeError('Event type must be a nonempty single line.');
      let json: string | undefined;
      try {
        json = JSON.stringify(data);
      } catch {
        json = undefined;
      }
      if (json === undefined) throw new TypeError('Event data must be JSON-serializable.');
      lastId += 1;
      const event = { id: lastId, type, data };
      for (const listener of [...listeners]) listener(event);
      return lastId;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
};
