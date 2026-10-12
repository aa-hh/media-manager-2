# Handover: delete by intent, design and client, 12 October 2026

You are building the design and the client side of AA-124 (Delete by intent: ask what a delete is for). Your ticket is AA-130 (Delete dialog: ask what the delete is for). A cloud session builds the server side (AA-125 to AA-129) and coordinates. Read `docs/adr/0005-ask-what-a-delete-is-for.md`, `CONTEXT.md`, `src/client/AGENTS.md` and this file before acting.

## What changes for the owner

Today's dialog (`src/client/title/DeleteTitle.tsx`) asks *what* to delete, plus a torrent choice per row. It now also asks **what happens afterwards**, covers **chosen episodes and seasons**, lists **downloads in progress**, and the result shows **what Sonarr or Radarr will monitor now**.

| Question | Choices | Default |
|---|---|---|
| What | movie · whole show · a selection of seasons and episodes | the entry point picked |
| Afterwards | Remove from Sonarr/Radarr · Keep, unmonitored · Delete and search again | Remove for a whole title; Keep, unmonitored for a selection |
| Import lists (Remove only, only when `plan.importLists`) | "Don't let import lists add it back" checkbox | off |
| Blocklist (Search again only) | "Don't grab this release again" checkbox | on |
| Airing season (only when listed in `plan.monitoring.airingSeasons`) | Keep following new episodes · Stop following | **none; the owner must pick** before Delete is enabled |
| Torrents | Keep seeding · Remove torrent (per row, as today) | keep seeding |
| Downloads (`plan.queue`) | Leave · Remove · Remove with torrent (per row) | Remove for Remove and Keep, unmonitored; Leave for Search again |
| Second versions | ticked or not (as today) | ticked, **except** Search again: unticked |

When `plan.monitoring.leavesShowEmpty` is true, show a callout: "This leaves the show with no files and nothing monitored." with a button "Remove the show instead" that reloads the dialog for the whole-show target.

The result dialog adds a **Monitoring** row built from the `monitoring` step, for example "S01–S03 not monitored · S04 monitored · new seasons followed".

Wanting another copy beside the current one is **not** in this dialog; that stays in Pick a release.

## Entry points

* Movie and show pages: the existing Delete.
* Season row: the existing Delete, now a selection of one season.
* **New:** episode rows get a selection mode (checkboxes on `RowEpisode` and `RowSeason`), and "Delete selected" opens the dialog for the selection. Design this first in pen.dev (`design/title.pen`), using the library in `design/design-system.lib.pen`.

## The contract

Routes, all under `/api/library`:

| Target | Plan | Delete |
|---|---|---|
| Movie | `GET /movie/:id/delete-plan` | `POST /movie/:id/delete` |
| Show | `GET /series/:id/delete-plan` | `POST /series/:id/delete` |
| Season (kept) | `GET /series/:id/season/:n/delete-plan` | `POST /series/:id/season/:n/delete` |
| Selection (new) | `GET /series/:id/selection/delete-plan?seasons=1,2&episodes=101,102` | `POST /series/:id/selection/delete` |

Additions to the plan (`DeletePlan` in `src/client/library/api.ts`). Existing fields keep their meaning.

```ts
type Mode = 'remove' | 'keepUnmonitored' | 'searchAgain';

type DeletePlan = /* existing fields */ & {
  modes: Mode[];                       // what this target allows; remove only for a whole movie or show
  importLists: boolean;                // the service has an enabled import list (AA-128)
  selection: { seasons: number[]; episodeIds: number[] } | null; // selection target only (AA-126)
  monitoring: {
    followsNewSeasons: boolean | null; // null for a movie
    airingSeasons: number[];           // selected seasons with episodes not yet aired (AA-126)
    leavesShowEmpty: boolean;          // (AA-126)
  };
  queue: Array<{                       // (AA-129)
    downloadId: string;
    title: string;
    progress: number;                  // 0 to 1
    status: string;
    episodeIds: number[];
    advice: RemovalAdvice | null;      // null when nothing has downloaded yet
    removable: { allowed: true } | { allowed: false; reason: string };
  }>;
};
```

The delete request (`DeleteChoices`). Every key is required; the server rejects unknown or missing keys with 400.

```ts
type DeleteChoices = {
  mode: Mode;
  excludeFromImportLists: boolean;     // true only with mode 'remove'
  blocklistCurrent: boolean;           // true only with mode 'searchAgain'
  keepFollowing: Record<string, boolean>; // one entry per plan.monitoring.airingSeasons, keyed by season number; {} otherwise
  queue: Array<{ downloadId: string; action: 'leave' | 'remove' | 'removeWithTorrent' }>;
  removeTorrents: string[];            // unchanged
  secondVersions: Array<{ id: number; removeTorrent: boolean }>; // unchanged
  // selection target only: the same seasons and episodeIds the plan was read with
  seasons?: number[];
  episodeIds?: number[];
};
```

New result steps (`StepResult`), in the order they run:

```ts
| { step: 'queue'; outcome; message; queue: Array<{ downloadId: string; title: string; removed: boolean; torrentRemoved: boolean; reason: string | null }> }
| { step: 'blocklist' | 'search' | 'exclusion'; outcome; message }
| { step: 'monitoring'; outcome; message; monitoring:
    | { kind: 'movie'; monitored: boolean }
    | { kind: 'series'; monitored: boolean; monitorNewItems: string | null;
        seasons: Array<{ seasonNumber: number; monitored: boolean; monitoredEpisodes: number; episodes: number }> } }
```

Errors: unchanged (`plan_changed` and `in_progress` as 409). A 400 now also means a choice the target does not allow (for example `remove` on a selection, or a missing `keepFollowing`). The client should never send one; treat it as a bug and show the server's reason.

## Order of work

1. Design the selection mode and the new dialog sections in pen.dev; check them with the owner.
2. Build against the contract above. Server pieces land one ticket at a time; until a field exists, the plan simply lacks it, so read every new plan field defensively (`plan.queue ?? []`).
3. Wire each section as its server ticket merges. The cloud session posts a comment on AA-130 (Delete dialog: ask what the delete is for) each time one does.

## Rules that bite here

* Delete stays blocked while one is in flight, keyboard included (`src/client/AGENTS.md`).
* The client never decides what is safe: torrent and queue rows take `removal` and `removable` from the plan, never work it out themselves.
* A fresh plan resets every choice to the defaults above (the existing `useEffect` does this for torrents and second versions; extend it).
* Copy follows `CONTEXT.md`: "monitored", "grab", "seeding", "hit and run rule", "second version". Not "wanted", "snatch", "seed rule".

## Coordinating with the cloud session

* The contract lives in this file. If you need to change it, comment on AA-130 with the change and why, and wait for the cloud session to agree before building on it.
* Branches: server work goes on `claude/aa-125-…` and the like; yours on `claude/aa-130-delete-dialog-intent`. Don't edit `src/server/` or `tests/`; the cloud session doesn't edit `src/client/` or `design/`.
* If the owner runs your session with Remote Control on, the cloud session can message it directly as well.
