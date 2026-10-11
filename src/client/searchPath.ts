// Searching moves the path to /search and remembers the screen it left, so clearing the search returns to that screen.
// No imports, so the tests can load it from source.
export const nextSearchPath = (pathname: string, state: unknown, query: string): { pathname: string; state: unknown } => {
  const trimmed = query.trim();
  if (trimmed !== '' && pathname !== '/search') return { pathname: '/search', state: { from: pathname } };
  if (trimmed === '' && pathname === '/search') {
    const from = (state as { from?: unknown } | null)?.from;
    return { pathname: typeof from === 'string' ? from : '/', state: null };
  }
  return { pathname, state };
};
