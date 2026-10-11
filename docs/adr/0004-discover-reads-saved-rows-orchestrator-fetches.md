# 0004. Discover reads saved rows; one orchestrator fetches

Status: accepted

## Context

Discover home rows blend TMDB and Trakt lists. Every title on a row needs a saved TMDB summary (poster, genres, date, overview), and a row filtered by streaming service needs each title's availability, which TMDB answers one title at a time. Trakt allows 1,000 unauthenticated requests per 5 minutes. The home screen asks for about a dozen rows at once and must never wait on TMDB or Trakt once a row has been loaded.

## Decision

Routes read saved rows from the `discover_rows` table through `src/server/discover/rows.ts` and ask the orchestrator to fill a key that is missing. `src/server/discover/orchestrator.ts` alone calls the TMDB and Trakt clients and the title store's `fetch`; routes, rows and recipes never import them. Each row is a recipe in `src/server/discover/recipes.ts` naming its sources and their weights, blended by weighted reciprocal-rank fusion: a title scores the sum of `weight / (10 + rank)` over the sources that list it. A missing row waits up to 8 seconds for its first build, then comes back `pending` while the build carries on and saves. The `discover-refresh` job runs every 10 minutes and rebuilds saved rows past their age limit (30 minutes for Trending, 6 hours for other rows, 24 hours for genre and service lists) that someone read in the last 24 hours, keeps the old row when a rebuild fails, and deletes rows nobody read for 7 days.

## Consequences

Sources, weights and rate-limit behaviour are tuned in one place, and a new row is a recipe entry. A source-text test fails when a route, `rows.ts` or `recipes.ts` imports a client or the title store. The first load of a new filter combination can show empty `pending` rows until the build finishes, and a row filtered by streaming service makes up to 40 availability lookups the first time.
