/** Credits for the data sources Discover shows. */
export function Attribution() {
  return (
    <footer className="flex flex-col gap-0.5 border-t border-border pt-5 font-ui text-xs text-muted-foreground">
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>
        Streaming availability from JustWatch. Charts from <a href="https://trakt.tv" className="rounded-xs text-foreground focus-ring">Trakt</a>.
      </p>
    </footer>
  );
}
