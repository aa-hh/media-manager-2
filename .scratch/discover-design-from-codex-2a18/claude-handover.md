# Discover design handover for Claude

## Task and settled scope

Finish editable desktop Discover screens in:

`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/discovery.pen`

Alec chose designs first. No application code, phone, tablet, settings, title-page designs, API integration, credentials, deployment, commits or pushes. Another agent owns Settings. Alec waived the reviewer agent; still check the drawings and prove they were saved. Use `/impeccable` and the existing light design system. Alec requested Sol 6.1 for delegated execution in Codex, never a 5.6 model. Claude is now explicitly requested to take over.

The complete Astra-scoped specification is:

`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/.scratch/discover-design-from-codex-2a18/work-order.md`

Read it, but apply the progress corrections below. Do not restart scoping, repeat completed preparation, or replay the repaired first call.

## Current state, checked 11 October 2026

The design is incomplete. A fresh read through Pencil MCP found one top-level frame, `UQMi9`, named `Discover — Desktop`, width 1440, white/light tokens, vertical layout, `clip: true`. Its children are:

| Node | ID | State |
| --- | --- | --- |
| Shared app bar instance | `xDZDU` | Linked to `b:F5qou`; navigation repaired |
| Replaced navigation subtree | `jwirM` | Six linked items, Discover selected |
| Main content | `jszwB` | Heading, service selection, six rows |
| Page heading | `UM9y3` | Linked to `b:pLro9` |
| Streaming-service selection | `GE8it` | Trigger and United States label |
| Trending row / poster container | `N2M05a` / `NganN` | Eight placeholder cards |
| Popular movies row / poster container | `myagw` / `eQHQT` | Eight placeholder cards |
| Popular TV row / poster container | `uVJip` / `cd9s7` | Eight placeholder cards |
| Upcoming movies row / poster container | `URP0v` / `CwgLz` | Eight placeholder cards |
| Upcoming TV row / poster container | `aavLP` / `OxKy7` | Eight placeholder cards |
| Netflix row / poster container | `M22mA` / `cbUBC` | Eight placeholder cards; provider illustrative |

All 48 cards still have muted poster fills, “Loading title” and blank metadata. No actual poster images or attribution footer have been applied. The eight other frames do not exist. No completed visual pass, detector run, exports or reopened-file persistence check exists.

The executor initially called the file unsaved. Later handover inspection found disk metadata `design/discovery.pen 62707 1791738882`, changed from the original 368 bytes. The last MCP read omitted the earlier `placeholder: true` property. The actor who saved or changed this is unknown. **Do not claim the disk is empty, or that persistence was verified.** Inspect the live canvas before any reopen; preserve it and save the exact document before reloading. Do not discard an Edited document.

The last `get_app_state` showed the exact requested discovery file active, with only `UQMi9` top-level. This is a snapshot, not a guarantee of the next active window.

## What already worked, and why execution stopped

The first app-bar edit tried `Insert` into an imported instance descendant and rolled back completely. Fresh execution successfully repaired failed edit `YJ66g` with `Replace`. Navigation is now Library, Discover, Calendar, Downloads, Flagged, Health; all six items link to `b:ACA2W`, only Discover selected. Product name, global search, settings and keyboard controls remain. A disabled heading summary sizing warning was corrected. **Do not repair YJ66g again or create another home frame.**

Execution stopped when Codex Computer Use returned that its application session had been explicitly stopped for that turn. This blocked the requested native Save checkpoint; it did not establish that Pencil MCP was unavailable. Claude should continue through its Pencil MCP connection and its own authorized native save mechanism. Do not repeat the claim that another foreground document requires another agent to pause.

## Pencil MCP rules and file targeting

Read Pencil's current skill, `execute.md`, `pen-schema.md` and component guide. Never read, grep, parse or edit raw `.pen` bytes; use MCP. Metadata checks are allowed.

Every call must use the full target `filePath`. Astra proved that an **open** file can be addressed independently of the foreground document: Settings reads returned its unique node while discovery stayed foreground, and that node was absent when addressing discovery. An unopened file can fall back to foreground, according to `design/README.md`.

Before mutations, read `UQMi9` inside the same execute snippet and require its name `Discover — Desktop`, then read `b:F5qou` and require `v2/AppBar/Desktop`, width 1440. Abort before edits on mismatch. Another foreground file alone is not a blocker. Native Save must target the exact discovery window. Pencil's native bundle ID is `dev.pencil.desktop`.

Reuse linked instances. Do not modify the library. `Insert` takes ordinary frames; replacing children inside imported instances uses `Replace(instanceId + '/childId', completeTree)`. Never update `children` through `Update`. A failed execute must be repaired with its `editId` and exact `edits`, not resent. Local `const`/`let` do not persist across calls; re-read IDs instead of relying on another agent's globals. Export does not save the `.pen` file.

Useful linked IDs in this document:

- App bar `b:F5qou`; navigation item `b:ACA2W`; page header `b:pLro9`.
- Poster card `b:Z0OVp`; image `b:Useiw`; title `b:B9wRy`; metadata `b:aUm15`; status `b:cEGE4`.
- Button `b:ht3RN`; select trigger `b:v8Swg`; checkbox `b:lm8WQ`; dialog `b:Oi69B`; empty state `b:t80nQS`.

Inspect the current library before overriding descendants. Interface font is Schibsted Grotesk; data font is Barlow Semi Condensed. Use 40-pixel page margins, 20-pixel poster gaps, eight cards per row. Lime remains reserved for best releases and live downloads. Do not use the archived dark/purple surface brief as the design reference.

## Assets prepared; use them before researching more

Assets and source records are under:

`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/.scratch/discover-design-from-codex-2a18/assets/`

- `manifest.json`: initial movie and TV artwork, upcoming TV examples and approved TMDB logo. Original downloads returned HTTP 200.
- `supplement-manifest.json`: eight future movie posters and another TV asset, with URLs and recorded HTTP 200.
- `released-movie-manifest.json`: additional released movie artwork, including replacements for some wrong original artwork.
- `future-tv-eighth.json`: The White Darkness, TVmaze 61500, in development, no premiere date. Its image is a source book cover, not a verified official TV poster. Prefer a neutral missing-poster treatment if unsuitable.
- `contact-sheet.jpg`, `future-contact.jpg`, `released-contact.jpg`: preparation contact sheets. They are not exports of completed designs.

Artwork came from TMDB's image CDN, TVmaze's public image servers, and supplementary IMDb/Metahub sources. These sources support design fixtures, not a decision to add those APIs to the app. HTTP 200 does not prove correct artwork. Inspect it, preserve provenance in node context, and do not fabricate posters or dates. TVmaze IDs are not TMDB IDs. No ratings were fetched; label any example ratings illustrative in design notes. Omit unavailable ratings.

The original `executor-preparation-handoff.md` is historical and now stale: its claims that no repair occurred, foreground changes block MCP, and asset preparation is incomplete have been superseded. `failed-step1.txt` is historical evidence only.

## Remaining deliverable

Continue from the existing home structure, completing steps 2–8 of the work order and any remaining step 1 checks:

1. Fill the six home rows with correct illustrative artwork and title/year/type/rating/library state. Trending mixes movies and TV. Keep owned titles visible. Add the attribution footer.
2. Create `Discover — Movies, filtered`, with eight cards per row and two full rows; genre/provider multi-select, region, year range, minimum rating, sort/direction, removable chips and Clear filters. No permanent sidebar.
3. Create `Discover — TV, filtered` with the same controls and genuine TV fixtures.
4. Create `Discover — Trending, all titles`, retaining its mixed source and All/Movies/TV selection.
5. Create `Discover — Streaming services open`, with search, multi-select, region, Save/Cancel. One row per selected provider. Provider order, subscription-only restrictions and splitting providers by movie/TV remain unsettled.
6. Create `Discover — Filters open`, showing selection, clearing and sort choices without overlapping open menus.
7. Create `Discover — Loading, empty and unavailable`, covering loading, failed row with retry, partial-source failure retaining results, no filter matches, unconfigured message linking to Settings, and missing-poster/no-rating/long-title/library/hover/keyboard-focus card examples.
8. Create `Discover — Design notes`, with illustrative-data labels, navigation destinations, stored details shown immediately, missing details fetched on hover/focus, filters in the page address, pagination reset and Back restoration, source preservation, and deduplication by media type plus TMDB ID. Static drawings do not prove interaction behavior.

No hero, quiz, personal-history controls, ranking sliders, related-title screens or settings screens. Keep ranking weights and upcoming time horizon as unresolved proposals in notes.

## Sources and policy

Trakt public charts plus TMDB were discussed for Trending; Trakt anticipation/list activity plus TMDB for upcoming. Exact weights and date horizon are not settled. The existing server currently supplies TMDB discovery; blended Trakt results and some filter/sort options require future implementation. Do not imply this integration works already.

The scoper personally read `https://developer.trakt.tv/docs/api-use-policy`. Include its constraints in design notes: proportionate feature caching, no bulk catalog mirror or redistributed data feed, no access evasion or unauthorized protected-account data, approved branding without implied endorsement, and no piracy-promoting product copy. Do not imply registration grants content rights or compliance approval. The Trakt Client ID exists, but read-only requests returned 403, so the connection is unverified. No key or secret is needed for this design task.

Use plain linked Trakt credit at `https://trakt.tv`; its branding page did not load, so no fabricated logo. Use the downloaded approved TMDB logo and exact notice: “This product uses the TMDB API but is not endorsed or certified by TMDB.” Credit JustWatch for availability data. Keep policy implementation details outside product UI.

Earlier product context is in `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/discovery-integration-api-scope-f36fa7/docs/handover-2026-10-11-discover-tmdb.md`. Current source facts were checked in `/Users/alechenderson/.codex/worktrees/2a18/media-manager-2`, newer than the design checkout. The app connects Sonarr, Radarr, Plex and rTorrent. Seerr research found its Discover uses TMDB; Trakt/Letterboxd are outbound links there. No need to repeat that research to finish these drawings.

## Protect unrelated work

Target worktree commit is `1aac296d8a6737e7c8e4ff91d95429c9730a6ccd`, branch `claude/design-v2-screens`. Recheck HEAD/status. Existing modified files are design-system.lib.pen, releases.pen, settings.pen and title.pen. Existing untracked files include discovery.pen, generated.png, setup-wizard.pen and `.scratch/light-mode-episode-details/`. Settings and setup-wizard metadata changed during other sessions. Preserve all of it; no reset, restore, cleanup, commit or push.

Only discovery.pen is owned. Keep supporting notes, assets and exports in the same `.scratch/discover-design/` folder as this handover. Read the target root AGENTS.md and design/README.md before editing. Read `/Users/alechenderson/.agents/skills/impeccable/SKILL.md`, Operate/extension guidance, and craft-floor immediately before editing. Impeccable context already ran once successfully; do not rerun it or repair product/design documentation.

## Finish and prove it

- Read frame structure and linked instances. Check layout clipping/overflow and resolve warnings. Nine distinct, named desktop frames; `clip: true`, no unfinished placeholders.
- Inspect screenshots of all nine frames, with detail captures where needed. One bounded correction pass, no prolonged polish loop.
- Run the requested detector once from the design worktree: `/Users/alechenderson/.agents/skills/impeccable/scripts/impeccable detect --json design/discovery.pen`. Unsupported encrypted input is a limitation, not a visual pass.
- Save the exact native discovery document, confirm Edited disappears, then reopen only that document and reread all nine frames plus a screenshot. Never discard another document's edits. Prove disk persistence; timestamps alone are insufficient.
- Export each frame as PNG into `.scratch/discover-design/exports/`, report name/ID/file mapping. Compare protected-file metadata without attributing other agents' changes to this task.
- Report completed screens, verification and remaining limitations. Say reviewer skipped at Alec's request. Do not run builds or tests for design-only work, or claim implementation/authentication completion.
