# Work order: v2 design, missing screens, states and motion

### Goal

Finish the v2 light-mode design: in each of the nine `.pen` files in `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish/design/`, add every screen the archive held and every state the code renders (loading, empty, error, partial, confirmation, undo, problems, disabled, selection), built only from `design-system.lib.pen` components and one shared sample dataset. Add a motion system to the library (duration and easing tokens, a motion sheet) and, per screen file, before/mid/after storyboard frames for its key transitions. First a library-only track adds the few missing components and the motion tokens; after Alec saves and reopens, screen tracks run at most two at a time.

### Verified facts

Design files (all nine open in pen.dev tabs, confirmed by Alec; the scoper confirmed by reading top-level frame names):
- Library `design-system.lib.pen` is open and unaliased: top-level `Iahma` Service logos, `x1g4a`, `r7eDFX`, `Mm8Xf`, `dJZBi`, `yawBw` (sheets 1 to 5). Sheet canvas positions: `x1g4a` (7200, 10259) 1680×7921; `r7eDFX` (9000, 10259); `Mm8Xf` (10800, 10259) 1680×6047; `dJZBi` (7200, 17640) 1680×11209; `yawBw` (9000, 17640) 1680×3411. The slot (10800, 17640) is empty.
- 86 variables, all unthemed. Numbers are stored as `{type:"number",value:4}` (e.g. `radius-xs`), strings as `{type:"string",value:"Schibsted Grotesk"}` (`font-ui`, `font-data`). No duration or easing variable exists.
- Every screen file imports the library under alias `5:` (seen in `library-search.pen`, `title.pen`, `releases.pen`, `settings.pen`, and the front file). Refs look like `5:ht3RN`, tokens `$5:background`, override paths prefix every segment (`"5:qGq1V/5:HSPSn"` in the Library app bar instance `vklKh`; `"5:aqYd6/5:bX27S"` in the Row/service instance `GB2Vc`).
- Existing v2 screens and their canvas positions (all 1440×900, vertical layout, `clip:true`, fill `$5:background`, children App bar ref `5:F5qou` + a page frame + live bar ref `5:jXjdR`): `library-search.pen` `m4XuKw` Library (12000, 6000), `MHUEJ` Search results (12000, 7060); `title.pen` `LdNGY` TV overview, in library (13600, 6000), `RxIN2` Episode details, expanded (13600, 7060); `releases.pen` `UourQ` Pick a release, inline under episode (15200, 6000), `uKtnA` Grab, already owned (15200, 7060), `Vs2IJ` Pick a release, after Grab (15200, 8120) plus toast `JDHTI` at x 40, y 752; `settings.pen` `r62o3J` Settings, all connected (16800, 6000) with toast `m5RIq6` at (1020, 780), `Fv2CA` Settings, problems and unsaved edits (16800, 7060). `downloads.pen`, `flagged-health.pen`, `history.pen`, `calendar.pen`, `sign-in.pen` hold only the six imported library frames (`5:Iahma` … `5:yawBw`) and are indistinguishable from each other by content: the marker proof is the only check that a write lands in the right file.
- The archive `archive/mediaManager2-2026-10-11.pen` is not open (a read of its path returned the front file's six library frames). Archived screens come from `docs/design/critiques/2026-10-11/inventory.md:18-21` in the `design-modernization-review-d37daf` worktree.
- Page frame conventions: Library page `FAtpa` vertical, padding `[0,"$page-margin"]`; Settings body `DXxOB` vertical, padding `[8,"$page-margin",24,"$page-margin"]`, gap 24, children Page header ref `5:pLro9` + content; releases pages `JaWEa` padding `[20,40,0,40]` gap 16 with a Breadcrumb ref `5:K5LLLh` first. These pages reference the file's local unprefixed `$page-margin` copy; leave that as is.
- Component anatomy (library ids; on a screen prefix each with `5:`):
  - `ht3RN` v2/Button: `HQLEf` Icon, `OXVvv` Label, `T1Pftv` Kbd (ref `NAj8m`), `iwvSz` Chevron. Looks by root `fill`/`stroke`: primary `$primary`; secondary `$card` + stroke `$input` 1; ghost `#FFFFFF00`; destructive `$destructive`; outline-destructive `$card`; disabled `$muted`; sizes by `height` 28/40/48 with `cornerRadius` `$control-radius-row|default|large` and padding `[0,"$control-px-row|default|large"]`; loading instance `TSOXZ`. (`F9aUl` section.)
  - `zGBcp` v2/Badge: `CTVTW` Dot (off), `tbtdb` Spinner (off), `htpMr` Icon (off), `rMeqR` Label. Looks: neutral `$muted`, strong `$primary`, lime `$best`/`$live` (Label fill `$foreground`), risk `$destructive-soft`, warning `$warning-soft`, outline `#FFFFFF00`, outline searching (spinner on).
  - `Dslj1` v2/Toast (400 wide, `$bar`, radius `$radius-lg`): `EJ1BD` Icon holder > `M0qgwJ` Icon, `eNCqd` Title, `ENTTo` Detail, `xPnqq` Action > `CcQQ3` Action label "Undo" + `nwkim` Action key, `az3LQ` Close. States on sheet: success `T0SwP`, action hover `KLKbx`, action focus `Msh09`, error `woijm`.
  - `BXgoa` v2/Callout (520 wide): `tPrsU` Icon, `hDbgA` Title, `EcQDN` Body, `ikNaK` Action (off). Looks: risk `$destructive-soft` (default), warning `$warning-soft` (`yEleT`), info `$muted` with action (`ICFJy`).
  - `t80nQS` v2/Empty state (360): `itryR` Icon holder > `vDC6f` Icon, `MlANt` Title, `CCAH8` Body, `axrsP` Action (a Button; `axrsP/OXVvv` Label).
  - `cZb0Z` v2/Panel/inline (560 wide, override width to 1360 on pages): `eb6uh` Header > `eIxb4` Title, `BCfDn` Close; `X6lxb` Content slot (replace with a frame, as the releases panel `AtaqY` does); `PkkWK` Footer > `v7tuN` Primary (48), `aqkcv` Secondary (40), `aqFdT` Hint.
  - `TPw8z` v2/Bar/selection (56 high, `$bar`): `LRqsE` Count, `bWGdd`/`OSMfK`/`FEeRa` Action 1 to 3 (Buttons; `…/OXVvv` labels, `…/T1Pftv` Kbd), `ah0kM` Divider, `umSBo` Hint, `bukb2` Clear.
  - `jXjdR` v2/Downloads live bar (1440×40): `SKfVZ` Icon, `jmHWs` Count, `HkJFl` Speeds, items `cmM33` (`eY4Kz` Name, `i2W1Ne` Track, `C4Eq3` Percent), `hIeuW` (`n9qTil`, `L9ntN`, `GyhFG`), `T71bf` (`BSjyG`, `YeFCG`, `qMxmu`), `Hhfs6` Problem (off; `S66uP` Dot, `pho5s` Problem text), `s4FKjA` Expand (`EVlub` Kbd, `XIJpu` label, `MD5Ba` Chevron). Sheet states: stalled `zQ62n`, idle `U7E2Y`, expand hover `qvyhF`, expand focus `uZOSp`.
  - `F5qou` v2/AppBar/Desktop: `zLSZ8` Product name, `OIwjX` Search (`OIwjX/RigzS` Text, `OIwjX/xMUu8` Clear off, `OIwjX/Fxbk0` Kbd), `f6yp9` Navigation > `H0TcR` Nav Library, `qMw06` Nav Calendar, `qGq1V` Nav Downloads, `Y8D5o` Nav Flagged, `KEW4D` Nav Health (each a v2/AppBar/Nav item `ACA2W`: `dDmBl` Label, `UqFiV` Count > `HSPSn` Count text), `gaNhn` Icon buttons > `v5RcYX` Settings, `W2Rua8` Keys. Nav item active look: fill `$selected` (sheet instance `BKfER`); risk count instance `zKgRj`.
  - `pLro9` v2/Header/page (1360): `iV4mp` Breadcrumb (off), `P9FCIC` Title, `SUWts` Summary, `oP1hc` Action (off, a Button), `ErTy7` Note (off, 680 wide).
  - `mk4uT` v2/Label/group: `xTran` Label, `sx2YK` Count. `hpQjk` v2/Status/service pill: `LnsLt` Logo (replace with a Logo ref), `RCe28` Name, `hKu9E` Dot, `YxJjn` Unsaved icon, `JrjXm` Spinner, `bX27S` State; states connected, testing `FEFGP`, not set up `g7bam`, failed `QnlGB`, compact `tpLTt`, unsaved `z87xP`. `okfXn` v2/Row/service (420×56): `FDiAB` Marker, `o0swt6` Logo, `x6gOz` Name, `Fdc5N` Address, `aqYd6` Status pill.
  - `eCSrr` v2/Progress (200×4, `layout:none`): `zJG1E` Fill (width = percent of 200). `SHXXo` v2/Spinner (icon 16). `ZWg7X` v2/Skeleton (rectangle 160×14, `$muted`, radius `$radius-xs`); the sheet's "poster card loading" `YDyQ7` and "table row loading" `Pwog6` are plain frames, not reusable.
  - Table family: `gp6Kh` v2/Table (`KFz5s` Header, `KSG7I` Body slot), `Fj6GM` v2/Table/Header (`RNB4r` Cells > Head NAME/SIZE/ADDED), `IODuw` v2/Table/Row (1360×40; `WvmaB` Marker off, `w688Kc` Cells), `I73rkQ` v2/Table/Cell (`dacHK` Value, `ARJCR` Sort). Named rows are refs to `IODuw` whose Cells are replaced: `k3Rz6` Row/download 56 high (cells `z2LePX` Title fill, `PXsQm` Progress 180, `NPi9o` Speed 104, `c03qE` ETA 72, `v0uxAC` Tracker 112, `A32IE` State 220, `cwcvr` Actions 72; states hover, focus, selected, stalled `ev2j6`, import blocked `wV9kU`, waiting `YsgdC`); `rBoB2` Row/health-problem 56 (`awWDt` Logo 28, `VWrDs` Problem, `AdQCI` Since 120, `OlU0V` Fix 280, `YQXvK` Action 120; states risk `dmnJT`, warning `S2FtL`, handled `AqcCV`); `NKsS2` Row/flagged 56 (`h4vrx` Poster 32, `Z6td4q` What, `vXpeq` Gave up 120, `e5q3X` Tries 64, `XB3IK` Actions 240; risk `dfmoS`); `Dh5pL` Row/blocklist 40 (`V6WSj` Release, `MI5Zx` Title 220, `o8dCVq` Tracker 112, `vHp7A` Reason 240, `h5UiII` Added 104, `Opo6Q` Action 28; risk `Xymxq`); `nT6fn` Row/history 40 (`mjYAG` When 128, `zjv0R` Event, `nvGlq` By 112, `mAi16` Detail 284; problem `pQ0T9`, warning `S9PDB`); `tm5WE` Row/import-file 40 (`gJIiF` Check, `a2c7h` File, `aWUEf` Maps to 140, `qpiWq` Quality 128, `JjkY2` Size 72, `NgR31` Languages 160, `pkmvA` Action; unchecked `Wy12d`, problem `cduG2`); `N2L6Em` Row/import-file-group 40 (`lHpCy` Chevron, `ZhrqM` Check, `in8HO` Folder, `PygEt` Count, `ib8rU` Size, `T4kwsP` Action; closed `jOut4`, mixed `ELXMV`); `rjunT` Row/episode (states not monitored `d9EFI`, missing `lB9Ot`, downloading `J3lwOf`, searching `zcuyg`, not aired `aMirO`, stalled `rUW6l`); `C5GiQ` Row/season 48 (open `w23C5M`, mixed `q5Rxi`, not monitored `KlvQw`, upcoming `CmD3Q`); `NXfpc` Row/release (grabbed `XqzpS`, cooldown `hi1L9`, rejected `hG3P8`, yours `XKNxs`); `WwDvp` Row/episode-details; `c49N0` Row/second-version (tracked `O99oMy`, downloading `hXQZS`). Matching Table/Header instances for each row family sit on sheet `dJZBi` (`sFg5L` download, `Uxuhe` blocklist, `Yvzat` history, `UwqLO` import-file).
  - Calendar: `zrJc8` Entry 180 wide (`OzPND` Marker off, `Ddi5D` Title, `tQimH` Meta, `eeptz` Progress off; states missing `F1OasH`, gave up `uxd8k`, downloading `KTL3W`, not monitored `N6Trp`); `t2YxG` DayHeader 188×32 (`bRnc2` Day, `wiQIe` Date circle > `ofehh` Date, `npoZc` Tag off; today `VD4Lf`, tomorrow `r3XedV`); `z4pNq0` MonthCell 188×132 (`UWe5j` Date circle, `iMXRl` Entries > `lR96U`, `QdnJD`, `TeEM1` More; today `Jk7Qf`, out of month `L8rp8`, empty `c56Wvm`); `Ey0Ju` Now line (`FryCQ` Time "14:32"); `kGPpG` Calendar/Header 1360×56 (`XK8UT` Range, `BiIMb` Missing badge, `ERhH4` Step > `niATb` Previous, `j6aEZ` Today, `F3z8p` Next, `IER4Q` Time zone, `h8e4l` View toggle group with items `h8e4l/rk0Z8`, `h8e4l/M9EEU9`, `h8e4l/hmSso`).
  - Others: `cofqY` v2/ToggleGroup (items `rk0Z8`, `M9EEU9`, `hmSso`, `aA5uG`, `HwOS2`, `U4NiX`; each `…/DC0sr` Label, `…/IkgcV` Count); `Qf3qz` Tabs trigger (`I4IP7` Label, `O5lpGR` Count); `v8Swg` Select trigger; `N61zp` Field/labelled (`HA4ko` Label, `u5ifaM/Jxm3h` Input, `RPLCk` Help, `bKl3c` Error off); `qq4VX` Option row (`X5jFeq` Radio, `bgVNE` Checkbox off, `o65TR7` Title, `UoGzj` Description, `QgmMs` Kbd); `E7Mh6m` Card/choice (`eND9v` Title, `awp72` Description, `ameDv` Radio, `Evy0C` Kbd; selected `NMUOx`, selected second version `w4Jm0`, disabled `xELIW`); `E8opC` Sheet (phone) (`yhcZp` Title, `wn7mc` Subtitle, `y1eM4F` Content slot, `HXun5` Primary, `RbwPT` Secondary); `FCUUC` Navigation/Phone (`yXtFK` Title, `anJiY` Search); `K5LLLh` Breadcrumb (`Msey3`, `vshbw`, `TwIAg`); `girD3` Tooltip; `D3lFb` DropdownMenu/Content; `Gtcpe` DropdownMenu/Item; `e95lV` Fact/row (`EY0GR` Label, `zR4U4` Progress off, `AslXb` Value, `Qn7Y4` Note off; disk `K72sxW`, disk over limit `pAPgT`); `NaDkI` Header/title (`xEb57` Backdrop, `jx4Vy` Poster, `ZziDl` Info, `N3v4g` Facts, `dK2t3` Compact strip off; not-added instance `Vu3xl`, compact `aWrHx`); `RJNba` Block/add-controls (movie instance `irtmH`); `Z0OVp` Library poster card (states hover `uUaqJ`, selected `w92MSi`, downloading `LFesv`, missing `A1vXF`, manual download `Sivr6`, not out yet `rgm0A`, imported `Y8w18`; override keys seen on `Jz4CB`: `5:Useiw` poster fill, `5:B9wRy` title, `5:aUm15` meta, `5:cEGE4` status badge with `5:cEGE4/5:rMeqR` label); `g073R` Row/search-result 880×84 (not in library `OUPb3`); `GeZ6k` Item/episode-list 420×56 (missing `fh9CX`); `v1tSkC` Focus ring (wrap an instance in it for the focus state, as `TAXlq` does).
  - Sheet section format (copy it, do not retype): a Section frame (vertical, gap 16) holds a "Section title" text, a "Section note" text (width 900, `$muted-foreground`), then "Demo row" frames (horizontal, gap 24) of "State <name>" frames (vertical, gap 8: "Caption" text in `$subtle-foreground` + the component or an instance). Smallest existing section to copy: `gfupz` (v2/Spinner) on `r7eDFX`.
- No phone rows exist in the v2 library (no `Row/release-phone` or `Row/episode-phone`; `DESIGN.md:114` "several phone rows are deferred").
- Code (worktree `/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/design-modernization-screens-0d9377`, `src/client`, on origin/main `a7f4d21`; the `codex-design-finish` worktree has no `src/`):
  - Routes `Home.tsx:66-75`: `/search`, `/downloads`, `/flagged`, `/history`, `/blocklist`, `/health`, `/calendar`, `/series|movie|title/…`, else library. Nav items `Home.tsx:39-46` (Library, Calendar, Downloads, Flagged, History, Health); Flagged count = downloads "needs you" rows (`Home.tsx:105`, `main.tsx:264-267`); Health badge "N RISK(S)" or "N WARNING(S)" (`main.tsx:255-263`); sign-out label states "Signing out…", "Try sign out again", alert "Sign-out failed. Your session may still be active." (`main.tsx:220-236`); session "checking" screen is blank (`main.tsx:205-211`).
  - Sign-in views `SignIn.tsx:5-18` (status, initial, preparing, checking, pending, interrupted, wrong-owner, unavailable, not-configured, expired, invalid, session-expired, cancel-failed), `cancellationBusy` (`SignIn.tsx:68`, labels "Cancelling…" `:362,368,373`), headings `:297-311`, body copy `:326-342`, buttons `:345-380`.
  - Library `Library.tsx`: loading `:106`, failed + Retry `:107-112`, service problem lines `:19-25,154`, empty "Nothing here yet." `:156`, Show filter `:124-136`, Poster fields picker `:137-151`, missing count `:152`, totals line `:164-166`; card lines `:38-48` (progress text `grid.ts:5-6`, "not monitored" `:42`, movie words `grid.ts:25-31`).
  - Search `Search.tsx`: idle hint `:256-260`, searching with previous results at 60% `:296-297,311`, failed + Try again `:298-303`, service problems `:45-51,304-306`, nothing matches `:307-309`, filter group `:275-291`.
  - Title `Overview.tsx`: loading `:124`, failed `:125` with texts `:41-47,82`; preview seasons `:56-73`; add block `:147-155`. `AddControls.tsx`: options loading `:174`, failed `:175,136-142`, adding `:313`, refused `:310,200-208`, added `:164-172`, More options `:268-308`. `TitleHeader.tsx`: monitor problem `:151`, search/refresh sent/failed `:178-180`, Bookmark states all/none/mixed `:9,46-69`. `EpisodeRows.tsx`: season row `:196-226`, no episodes `:181`, episode row words `rows.ts:48-54` and marks `rows.ts:8-26`, search sent/failed `:174-178`, selection bar `:304-311` (text `selection.ts:13-24`), range select `:96-128`, dimmed rows while a panel is open `:173`. `EpisodeDetails.tsx`: "No file yet." `:21`. `title/History.tsx`: loading `:34`, failed `:35`, empty `:36`. `MovieOverview.tsx:46-56`: Pick a release toggle, VersionTable "Your file". Deletes are a hand-off (`TitleHeader.tsx:177`, `MovieOverview.tsx:55`).
  - Pick a release `PickRelease.tsx`: loading "Searching every indexer. This takes about 20 seconds…" `:404`, refreshing "Searching again…" `:405`, failed `:421` (texts `:53-58,289-290`), ready with problem "… These are the earlier results." `:423`, quality filter `:425-439`, empty "No indexer has a release for this." `:441`, risks list `:107-113,476-481`, Override panel `:165-241`, decision panel `:115-163` (confirm step "Yes, replace the current file" `:142-144`, "Replacing…" `:143`), grabbing `:501`, outcome ok `:345-353`, outcome failed `:355-361,364`.
  - Downloads `Downloads.tsx`: header summary `:192-195`, live/reconnecting note `:225-228`, loading `:230`, failed + Try again `:231-236`, empty `:243`, groups `model.ts:299-308`, status words `model.ts:132-147,251-255`, delayed "grabs in …"/"grabbing now" `:124-126`, problem lines `:161-169`, row actions `:170-178`, Remove panel `:56-103` (choices `:9-13`, failed `:94`, sending `:97`), Import panel `ImportPanel.tsx:90-153` (loading `:93`, failed `:94`, reasons `:97,146`, sending `:150`), LiveBar `:274-296`.
  - Flagged `Flagged.tsx`: tabs `:12-16`, action labels `:18-23`, loading `:321`, failed `:322-327`, needs-you header `:330-332`, empty `:333,361`, row actions `:113-121`, search sent/refused `:118-119`, pick panel loading/failed `:67-75`, wanted selection bar `:186-200`, wanted header `:201-211`, searched text `:138-142`. Summary sentences `:293-296`.
  - Health `Health.tsx`: sections `:43-122`, status words `:9-16`, "Nothing needs attention." `:44`, "No trackers seen yet." `:72`, Run all checks / Checking… `:147`, loading `:150`, failed `:151-156`, summary `:137-142`.
  - History `History.tsx`: filters `:6-18`, day groups `:29-38,211-219`, loading/failed/empty `:241-253`, expanded details `:136-147,173-180`, Mark as failed panel `:76-120` (states `:69-74`), Load more `:273-277`, Blocklist link `:229-236`. Blocklist `Blocklist.tsx`: views `:9-15`, undo window 8 s `:24`, pending undo status `:92-99`, failed `:100-102`, loading/failed/empty `:103-114`, selected Unblock `:140-142`, Load more `:147-151`.
  - Calendar `Calendar.tsx`: views `:13`, loading/failed/Retry `:214-220`, service problems `:223-225`, forecast "N aired, still missing" `:102-107`, today cell `:72-74`, out-of-month dimmed `:120`, entry words `model.ts:135-142`, keys `:166-177`, time zone note `:212`, range labels `model.ts:47-59`.
- PRODUCT.md in the screens worktree lists capabilities 1 to 16 (`PRODUCT.md:42-57`); the copy in `codex-design-finish` stops at 10 (`PRODUCT.md:42-51` there). Do not edit either.
- Handover rules (`docs/handover-2026-10-11-design-v2.md:36-44` in `design-modernization-review-d37daf`) and decisions (`:20-32`) apply as written in Executor rules.
- Motion values come from the components critique (`components.md:589-598`): 120/160/220 ms, ease-out `cubic-bezier(0.2, 0, 0, 1)`; spinner 700 ms, skeleton 1.4 s, tooltip delay 400 ms from `.impeccable/design.json:143-158`.

### Canonical sample data

Moment in time: Saturday 11 October 2026, 14:32 (Europe/London). Nav: Library, Calendar, Downloads (count 3), Flagged (count 5), Health (count only on problem screens: 2). Live bar: "3 downloading · 41.6 MB/s down · 12.3 MB/s up · Severance S02E07 64% · The Bear S03 23% · Andor S02E09 91%"; Problem slot on when a stalled row exists: "1 stalled · 0 seeders".

Titles (from the Library screen): Severance (2022 · 16 of 19 · 42.1 GB, Downloading 64%), Dune: Part Two (2024 · 9.6 GB, 2 versions), Andor (2022 · 24 of 24 · 121 GB, Imported), The Bear (2022 · 18 of 38 · 36.4 GB, 10 downloading · 23%), Dune (2021 · 58.3 GB), Dune: Prophecy (2024 · 6 of 6 · 41.0 GB), Oppenheimer (2023 · 72.8 GB), Shōgun (2024 · 10 of 10 · 48.2 GB), Past Lives (2023 · 14.1 GB, Manual download), Slow Horses (2022 · 22 of 24 · 39.7 GB, Missing 2 episodes), Civil War (2024, Gave up searching), Poor Things (2023 · 22.5 GB), The Last of Us (2023 · 9 of 16 · 27.9 GB, Missing 7 episodes), House of the Dragon (2022 · 16 of 18 · 88.0 GB, Not monitored), Arcane (2021 · 18 of 18 · 96.4 GB, 4 versions), Dune: Part Three (2026, Not out yet). Totals: 72 shows · 142 movies · 1,836 episodes · 2,107 files · 18.4 TB · 4 titles gave up searching.

Severance Season 2 (title.pen): E01 Hello, Ms. Cobel (Fri 22 Aug, 1080p WEB-DL), E02 Goodbye, Mrs. Selvig (Fri 29 Aug, 1080p WEB-DL), E03 Who Is Alive? (Fri 5 Sep, not monitored), E04 Woe's Hollow (Fri 12 Sep, 2160p WEB-DL, 2 versions), E05 Trojan's Horse (Fri 19 Sep, 2160p WEB-DL), E06 Attila (Fri 26 Sep, 2160p WEB-DL, Manual download), E07 Chikhai Bardo (Fri 3 Oct, Downloading 64% · 6 min), E08 Sweet Vitriol (Fri 10 Oct, Missing · searched 3 times), E09 The After Hours (Fri 17 Oct, Not out yet), E10 Cold Harbor (Fri 24 Oct, Not out yet). Season 1: 9 of 9, Aired, 38.0 GB. Season 3: Upcoming · 2027. Hero facts: Monitoring "All, except S02E03", Quality profile "UHD preferred", On disk "64.6 GB · 16 files", Next episode "S02E09 · Fri 17 Oct". E04 versions: tracked 2160p `Severance.S02E04.2160p.ATVP.WEB-DL.DV.H.265-FLUX` 4.2 GB PrivateHD "seeding 694 h · rule met"; second version 720p `Severance.S02E04.720p.ATVP.WEB-DL.DDP5.1.H.264-FLUX` 1.4 GB PrivateHD "seeding 41 h of 72 h". (Known discrepancy, do not fix: `releases.pen` dates E07 "Fri 28 Feb", E08 "Fri 7 Mar"; new screens use the October dates.)

Not-in-library show used by the add flow: **The Studio** (2025, Apple TV+, Continuing, ★ 8.1, 1 season · 10 episodes). Not-in-library movie: Dune: Part Three (2026, Legendary, Announced).

Releases for S02E08 (releases.pen, keep as is): yours 1080p FLOS 4.1 GB Beyond-HD; best 2160p FLUX 8.9 GB 312 seeders PrivateHD "72 h or ratio 0.9"; better NTb 7.4 GB; 2160p WEB SuccessfulCrab; playWEB on Blutopia "cooldown 3 h left"; HHWEB; 720p "worse · 720p not wanted". Movie flow (new): Dune: Part Two, owned 2160p WEB-DL · FLUX 9.6 GB (tracked) plus 1080p second version 4.4 GB; releases: `Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR.TrueHD.7.1.Atmos-FraMeSToR` 78.2 GB 214 seeders Beyond-HD "120 h or ratio 1.0" (rejected: over 60 GB max, dimmed); best `Dune.Part.Two.2024.2160p.WEB-DL.DV.HDR10.DDP5.1.Atmos-FLUX` 23.4 GB 188 PrivateHD; same `…2160p.WEB-DL.HDR10-NTb` 19.1 GB 96 PrivateHD; worse `…1080p.BluRay-SPARKS` 12.0 GB 41 Blutopia "cooldown 3 h left".

Downloads (11 rows; header "11 items · 1 needs you · 2 problems being handled"; note "live from rTorrent, plus releases Sonarr and Radarr are holding back"):
- Needs you (1): Shōgun S01E05 · 2160p WEB-DL · NTb · PrivateHD · 100% · seeding 2.1 MB/s up · import blocked: "Sonarr: a file with the same episode already exists at a higher quality" · actions Import by hand, Remove from downloads.
- Being handled by media-manager-2 (2): The Bear S03 (10 episodes) · 1080p WEB-DL · NTb · Beyond-HD · 23% · stalled · 0 seeders connected · "Searching for another release, try 2 of 3 · next in 14 min"; Slow Horses S04E03 · 2160p WEB-DL · FLUX · Beyond-HD · 0% · waiting for peers · 0 seeders connected · "Re-announced to Beyond-HD 4 min ago".
- Everything else (8): Severance S02E07 · 2160p WEB-DL · FLUX · PrivateHD · 64% · 18.4 MB/s · 6 min · 312 seeders · downloading; Andor S02E09 · 2160p WEB-DL · FLUX · PrivateHD · 91% · 23.2 MB/s · 1 min · 240 seeders · downloading; Severance S02E04 2160p · seeding · ratio 2.12 · 694 h; Severance S02E04 720p (second version) · seeding · ratio 0.41 · 41 h; Dune: Part Two 2160p · seeding · ratio 1.30; Oppenheimer 2160p · seeding · ratio 3.04; Past Lives 1080p · seeding · ratio 0.88; Arcane S02 · seeding · ratio 1.95.
- Delayed queue example (one state screen): Poor Things 2160p REMUX · in Radarr's queue, not in rTorrent yet · "grabs in 12m".

Flagged. Needs you (5): Civil War (movie) · Gave up searching · 4 tries · "No release from any tracker since 2 Oct"; Severance S02E08 · Gave up searching · 3 tries · "Only 720p found; profile wants 1080p or better"; Slow Horses S04E02 · Gave up searching · 3 tries; The Last of Us S02E03 · Gave up searching · 3 tries; Shōgun S01E05 · Import blocked · 1 try · "a file with the same episode already exists at a higher quality". Note: "Automatic fixes handled 41 problems this week on their own. These are the ones they gave up on." Missing (10): Severance S02E08, Slow Horses S04E02, Slow Horses S04E04, The Last of Us S02E03 to S02E09 (7). Below cutoff (4): Severance S02E01, Severance S02E02, Dune (2021) 1080p, Past Lives 1080p. Searched text pattern: "last 2h ago · next in 4h".

Health (problem world, matches `Fv2CA`): summary "4 problems, 2 of them risks · checked 2 min ago". Problems: risk · rTorrent · "rTorrent did not answer within 10 seconds" since 14:01; risk · Blutopia · "Blutopia refused the API token" since 13:40; warning · media-manager-2 · "Disk /home/alec/files is 91% used (0.9 TB free of 10 TB)"; notice · Sonarr · "Update available: 4.0.11". Services: Sonarr reachable 4.0.10.2544, Radarr reachable 5.8.3.8933, rTorrent unreachable, Plex reachable 1.41.0. Trackers: Beyond-HD ratio 2.41 of minimum 0.6 · 0 hit and runs · no cooldown; PrivateHD 1.87 of 0.9 · 0; Blutopia credentials refused · cooldown since 13:40 "API token refused". Disk: /home/alec/files 91% used. Jobs: 7 ran on time; "Search missing" late · expected every 6h. Backup: Cloudflare R2 · last 25m ago. All-clear world: "0 problems · checked 2 min ago", rTorrent reachable 0.9.8, Blutopia 1.12 of 0.6.

History (newest first). Today: 14:30 Automatic fix · Severance S02E08 · "Searched again, 3rd try: nothing found" · media-manager-2; 13:48 Grabbed · Andor S02E09 · 2160p WEB-DL · FLUX · PrivateHD · Sonarr; 13:40 Imported · Andor S02E08 · 2160p WEB-DL · Sonarr; 12:15 Grabbed · The Bear S03 · 1080p WEB-DL · NTb · Beyond-HD · Sonarr; 11:02 Download failed · Civil War · 2160p REMUX · FraMeSToR · "0 seeders for 6 h" · Radarr (Mark as failed available); 09:14 Automatic fix · Slow Horses S04E03 · "Re-announced to Beyond-HD" · media-manager-2. Yesterday: 22:10 Imported · Severance S02E04 · 720p second version · media-manager-2; 21:40 Grabbed · Severance S02E04 · 720p WEB-DL · FLUX · PrivateHD · You; 18:05 File deleted · Oppenheimer · 1080p (replaced by 2160p) · Radarr. 9 Oct: 20:31 Imported · Slow Horses S04E01 · Sonarr; 07:12 Grabbed · Shōgun S01E05 · Sonarr. Expanded row detail fields: Release, Tracker, Release group, Custom format score (+1600 · DV · Atmos), How it was found (RSS), Age when grabbed (2 h), Sonarr says.

Blocklist (3): `Civil.War.2024.2160p.UHD.BluRay.REMUX-FraMeSToR` · Civil War · Beyond-HD · "by media-manager-2: stalled, 0 seeders" · Today 11:02; `The.Bear.S03.1080p.WEB-DL-playWEB` · The Bear · Blutopia · "by you: wrong episodes in pack" · Yesterday 16:20; `Dune.Part.Two.2024.1080p.WEB-DL-NTb` · Dune: Part Two · PrivateHD · "by Radarr: unpack failed" · 2 Oct.

Calendar. Week Mon 6 to Sun 12 Oct 2026 ("6 – 12 October 2026"), today Sat 11, now line 14:32: Tue 7 Andor S02E09 09:00 (downloading 91%); Thu 9 The Bear S03E01–E10 09:00 (downloading 23%); Fri 10 Severance S02E08 03:00 (missing, gave up) and Civil War · digital release (gave up); Sat 11 Slow Horses S04E05 21:00 (not aired, plain); Sun 12 nothing. Header Missing badge "2 missing". Forecast "Next 5 days · 11 – 15 October": Sat 11 Slow Horses S04E05 21:00; Tue 14 Andor S02E10 09:00; Wed 15 Dune: Prophecy S02E01 03:00; "4 aired, still missing": Severance S02E08 (Fri 10 Oct), Slow Horses S04E04 (Wed 1 Oct), Slow Horses S04E02 (Wed 17 Sep), The Last of Us S02E03 (27 Apr). Month October 2026: 1 Slow Horses S04E04 (missing); 3 Severance S02E07; 7 Andor S02E09; 9 The Bear S03; 10 Severance S02E08 (missing), Civil War (missing); 11 Slow Horses S04E05; 14 Andor S02E10; 15 Dune: Prophecy S02E01; 17 Severance S02E09; 18 Slow Horses S04E06; 21 Andor S02E11; 24 Severance S02E10; 25 Slow Horses S04E07; 29 Dune: Prophecy S02E03; out-of-month cells 28 Sep to 30 Sep and 1 Nov.

Settings (from `r62o3J`/`Fv2CA`): Sonarr http://localhost:8989 · 4.0.10.2544; Radarr http://localhost:7878 · 5.8.3.8933; rTorrent https://shenzhou.whatbox.ca/xmlrpc · 0.9.8; Plex http://localhost:32400 · 1.41.0; trackers https://beyond-hd.me, https://privatehd.to, https://blutopia.cc. First run: all seven "Not set up", header "0 of 7 connected", help "Nothing is connected yet. Add each service's address and key, then Connect tests and saves it."

Sign-in copy: exactly the headings at `SignIn.tsx:297-311` and bodies at `:326-342`; product name "media-manager-2"; buttons per `:345-380`. Signed-in states use the Library screen with the app bar sign-out control.

### Screens and states

Frame naming follows the existing `v2 / Desktop / <Page>, <state>`. Storyboards: `v2 / Motion / <transition>`. Size 1440×900 unless stated. "Base" = copy of the named existing frame in the same file (Copy in the same file keeps library links). Columns: new frames go in a new column right of the file's existing screens at x = (rightmost existing screen x) + 1600, rows y = 6000, 7060, 8120, 9180, then the next column +1600; empty files start at x = 12000. Nothing may sit at y ≥ 10259 (library sheets).

**library-search.pen** (new column x = 13600)

| Frame | Source | State | Components | Data | Storyboard |
|---|---|---|---|---|---|
| Library, loading | `Library.tsx:106` | 16 skeleton poster cards, totals line hidden | base `m4XuKw`; grid cards replaced by `v2/Skeleton/poster card` ×16 | none | yes (skeleton to content) |
| Library, could not be read | `:107-112` | Callout risk "The library could not be read." + Action "Retry" (secondary 40) in place of grid | `v2/Callout` info-with-action look, fill `$5:destructive-soft` | — | no |
| Library, Sonarr not connected | `:19-25,154` | grid of movies only; Callout warning "Sonarr isn't connected yet, so shows are missing." above grid; toggle "Shows" count 0 | Callout warning, poster cards | the 8 movies | no |
| Library, empty | `:156` | `v2/Empty state` centred: "Nothing here yet" / "Add a show or movie from search." Action "Search" Kbd / | Empty state | — | no |
| Library, poster fields open | `:137-151` | dropdown under the Show select: 5 items with checks (Year ✓, Progress ✓, Size ✓, Quality profile, Date added) | `v2/DropdownMenu/Content` with Check icons on, width 248, float shadow, at the Poster fields trigger | — | no |
| Search results, idle | `Search.tsx:256-260` | app bar search focused and empty; page shows one muted line "Search by name, or paste an IMDb id (tt…), tmdb:… or tvdb:…" | app bar Search focused look | — | no |
| Search results, searching | `:296-297,311` | query "dune: p", header "Searching Sonarr and Radarr…", previous 7 rows in the dimmed look, spinner in the header | Row/search-result dimmed (text `$5:subtle-foreground`), `v2/Spinner` | previous results | yes (results swap) |
| Search results, nothing matches | `:307-309` | header "0 results for “dunee”", Empty state "Nothing matches “dunee” in Sonarr or Radarr." Action "Clear search" | Empty state | — | no |
| Search results, Radarr not answering | `:304-306` | 4 TV rows only; Callout risk "Radarr didn't answer, so movie results are missing." Action "Try again" | Callout | Dune: Prophecy, Children of Dune (+2 in library) | no |
| Search results, could not reach server | `:298-303` | Callout risk "The search didn't reach media-manager-2's server." Action "Try again"; previous rows dimmed | Callout | previous results | no |
| Motion: Library skeleton to content | — | storyboard | see Motion | — | — |
| Motion: Search results swap | — | storyboard | | | |
| Motion: Poster card downloading to imported | — | storyboard (Severance card 64% → Imported) | | | |

**title.pen** (new column x = 15200)

| Frame | Source | State | Components | Data | Storyboard |
|---|---|---|---|---|---|
| TV overview, not in library | archive `P4SDq`; `Overview.tsx:138-156`, PRODUCT 13-14 | hero (not-added look `Vu3xl`), season chips row, `v2/Block/add-controls` TV | Header/title, Block/add-controls | The Studio (2025, Apple TV+, Continuing, ★ 8.1, 1 season · 10 episodes) | yes (add → just added) |
| TV overview, add options could not load | `AddControls.tsx:174-175` | add block body replaced by Callout risk "Sonarr isn't connected yet." | Callout | The Studio | no |
| TV overview, adding | `:313` | Primary button loading "Adding…", fields disabled (`$5:muted`) | Button loading | | no |
| TV overview, Sonarr refused | `:310` | Callout risk under fields "Sonarr refused: a series with this TVDB id already exists" | Callout | | no |
| TV overview, just added | archive `P5clla`; `:164-172`, PRODUCT 14 | hero in-library look; toast "Added to Sonarr" / "Sonarr is searching for the monitored episodes that have aired."; Season 1 rows all "Searching" badge (outline searching) | Toast success, Row/episode searching | The Studio S01E01–E10 | yes |
| Movie overview, not in library | archive `lcXDu` | hero not-added, add block movie instance | Header/title, Block/add-controls `irtmH` | Dune: Part Three (2026, Legendary, Announced) | no |
| Movie overview, in library | archive `m8jCL`, `MovieOverview.tsx:34-56` | hero; actions Search automatically / Pick a release / History; Versions table: tracked + second version rows; History block | Header/title, Table + Row/second-version ×2 (tracked `O99oMy` look), Row/history ×3 | Dune: Part Two | no |
| Title, loading | `Overview.tsx:124` | hero skeleton (176×264 block, 3 lines) + 3 `v2/Skeleton/row` | Skeleton rows | — | no |
| Title, could not be read | `:125,41-47` | Callout risk "Sonarr didn't answer." Action "Try again" | Callout | — | no |
| TV overview, monitoring change scope | archive `uFHBR`, PRODUCT 14-15 | `v2/Panel/inline` under the hero: Title "Change monitoring", Content = 6 `v2/Option row` radios (All episodes, Future episodes, Missing episodes, Existing episodes, First season, None; Future selected), Callout warning "Turns off 3 episodes you set by hand", Footer Primary "Apply monitoring" 48, Secondary Cancel, Hint "Monitors 10 episodes across 2 seasons" ; rows below dimmed | Panel/inline, Option row, Callout | Severance | yes |
| TV overview, range select | archive `Ks0Cn`, `EpisodeRows.tsx:96-128,304-311` | S02 E03–E06 selected (selected look, side bar), selection bar floating 16 px above live bar: "4 selected", Actions Monitor (M), Unmonitor (U), Search automatically (S), Hint "Shift-click to add a range", Clear (Esc) | Row/episode selected, Bar/selection | Severance | yes |
| TV overview, search sent | `TitleHeader.tsx:178-181`, `EpisodeRows.tsx:174-178` | hero "Search missing" button in loading look; E08 row shows inline status "search sent"; E05 row shows "Sonarr didn't answer." | `v2/Status/inline` sent + failed | Severance | no |
| TV overview, monitor refused | `TitleHeader.tsx:151`, `SeriesOverview.tsx:57-59` | bookmark flipped back, inline status failed "Sonarr didn't answer." beside the title bookmark | Status/inline | | no |
| TV overview, no episodes yet | `EpisodeRows.tsx:181` | Empty state under hero: "Sonarr has no episodes for this show yet" / "Refresh the show once Sonarr has its episode list." Action "Refresh" | Empty state | The Studio, just added, without episodes | no |
| Episode details, no file | `EpisodeDetails.tsx:21`, `title/History.tsx:36` | details band for E08: facts, Versions "No file yet", History "Sonarr has no history for this yet." | Row/episode-details, Empty text | Severance S02E08 | no |
| Delete second version | archive `rSYPn`, PRODUCT 4-5 | Panel/inline under E04 details: Title "Delete the 720p second version?", Content: Card/choice "Keep seeding the torrent" (selected, "Recommended: PrivateHD asks 72 h, seeded 41 h") + Card/choice "Remove the torrent too" ("Breaks the PrivateHD rule"), Callout risk; Footer Primary destructive 48 "Delete file, keep seeding", Secondary Cancel | Panel/inline, Card/choice ×2, Callout, Button destructive | E04 | yes |
| Delete movie | archive `XX6W9` | Panel/inline in the movie hero: Title "Delete Dune: Part Two from Radarr?", Option rows (Delete files too / Keep files), Card/choice torrent pair, Footer destructive | same | Dune: Part Two | no |
| Delete, seeding history unknown | archive `d6TYkb` | same panel; the torrent card reads "Seeding time unknown (torrent not in rTorrent)"; Callout warning "No seeding record, so keep the torrent to be safe." Primary "Delete file, keep seeding" | same | Arcane S02E03 2nd version | no |
| Motion storyboards | | Season collapse/expand; Range select + selection bar in; Monitoring panel open; Add and search → just added | | | |

**releases.pen** (new column x = 16800)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| Pick a release, inline under movie header | archive `AHRck`, `MovieOverview.tsx:46-53` | movie hero (compact strip look `aWrHx`) + Panel/inline with the movie release table; "yours" row pinned under the header | Table/Header `Vkz7o`, Row/release states | Dune: Part Two set |
| Pick a release, searching | `PickRelease.tsx:404` | panel header "Searching every indexer. This takes about 20 seconds…" + spinner; body 6 `v2/Skeleton/row` | Spinner, Skeleton rows | S02E08 |
| Pick a release, refreshing | `:405` | existing table with rows dimmed, header "Searching again…", Refresh button loading | Row/release dimmed, Button loading | S02E08 |
| Pick a release, no releases | `:441` | Empty state in the content slot "No indexer has a release for this" / "Searched Beyond-HD, PrivateHD and Blutopia 14 s ago." Action "Search again" | Empty state | S02E09 |
| Pick a release, Sonarr not answering | `:421,53-58` | Callout risk "Sonarr didn't answer the search." Action "Try again"; no rows | Callout | |
| Pick a release, earlier results | `:423` | Callout warning "Sonarr didn't answer the search. These are the earlier results." above the table; "Results from 3 h ago" | Callout warning | S02E08 |
| Pick a release, override | archive `GTb4E`, `:165-241` | Panel content: "What this release counts as": Select "Season 2", episode checkboxes (E08 ✓, E09), Select Quality "As released"; Footer "Use this" / Cancel; header line "Counting as 2 episodes" with Reset | Select trigger, Option row checkbox, Button | S02E08 |
| Grab, confirm replace | `:140-147` | decision panel with Replace card selected and primary now destructive-outline "Yes, replace the current file" | Card/choice, Button | |
| Grab, grabbing | `:501,143` | primary "Grab as replacement" in loading look; cards disabled | Button loading | |
| Grab, refused | `:355-361` | panel closed; under the best row a Callout risk "Sonarr refused the grab: no indexer accepts this release right now" Action "Pick another"; row keeps Grab | Callout | |
| Grab, results out of date | `:359` | Callout warning "These results are out of date. Refresh and pick again." Action "Refresh" | Callout | |
| Motion storyboards | | Panel open under episode; Grab in row (button → loading → Grabbed + progress line); Toast in/out | | |

**settings.pen** (new column x = 18400)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| Settings, first run | archive `TbbN4` | all seven rows "Not set up" (pill `g7bam` look), header "0 of 7 connected", Note on; right pane = Sonarr with empty fields, help lines, Connect primary 48 | Row/service, Status pill, Field/labelled, Button | first-run data |
| Settings, connecting | design (Connect) | Sonarr fields filled, Connect in loading look "Testing…", pill "Testing" (`FEFGP` look), Discard disabled | Button loading, pill testing | |
| Settings, connect failed | `Fv2CA` pattern | Field error on under Address, pill failed, Callout risk at pane bottom with "Try again" | Field/labelled Error on | |
| Settings, discard edits | design | Panel/inline (560, centred over the pane) "Discard edits to Radarr?" Body, Primary "Discard", Secondary "Keep editing" | Panel/inline | |
| Motion storyboards | | Connect: loading → connected + toast; Service row select → pane swap | | |

**downloads.pen** (column x = 12000)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| Downloads | archive `dIXwk`, `Downloads.tsx:197-271`, PRODUCT 6-7 | Header/page "Downloads" + summary + note; three `v2/Label/group` (Needs you 1, Being handled by media-manager-2 2, Everything else 8); one `v2/Table` per group with Header `sFg5L` and Row/download rows (56); problem lines as a second line in the Title cell; Shōgun row selected with its actions in the row's Actions cell; live bar Problem on | Table, Row/download states, Label/group, Button row size | 11 rows |
| Downloads, loading | `:230` | Header + "Reading downloads…" + 6 `v2/Skeleton/row-two-line` | Skeleton | |
| Downloads, could not be read | `:231-236` | Callout risk "Downloads could not be read." Action "Try again" | Callout | |
| Downloads, nothing downloading | `:243` | Empty state "Nothing is downloading" / "Grabs from Sonarr, Radarr and you show up here within seconds." ; live bar idle look `U7E2Y` | Empty state | |
| Downloads, reconnecting | `:225-228` | Callout warning under header "Reconnecting to live updates… showing the last snapshot from 14:30"; live bar "No live status" look from `Fv2CA` | Callout | |
| Downloads, delayed grab | `:124-126,172` | Poor Things row (waiting look `YsgdC`) selected: state "delayed · grabs in 12m", actions "Grab now" (primary row size), Remove from downloads | Row/download waiting | |
| Downloads, remove | archive `oeZxo`, `:56-103`, PRODUCT 5 | Panel/inline under the Shōgun row: Title "Remove from downloads", fact line "Torrent · Keep seeding in rTorrent · media-manager-2 never removes a torrent from here", three Option rows (radio): Blocklist only, Blocklist and search again (selected), Don't blocklist; Footer Primary 48 "Remove from downloads, keep seeding, blocklist and search again", Secondary Cancel; other rows dimmed | Panel/inline, Option row | |
| Downloads, remove failed | `:94` | same panel + Callout risk "Sonarr did not remove it. Try again." | Callout | |
| Manual import | archive `TrXNw`, `ImportPanel.tsx:90-153`, PRODUCT 7 | Panel/inline under Shōgun: Title "Import by hand", lines "Why it stopped: a file with the same episode already exists at a higher quality" and "Files are hardlinked into the library, so the torrent keeps seeding."; Table with Header `UwqLO`, Row/import-file-group (Shogun.S01E05.2160p… 2 files · 8.9 GB) + Row/import-file ×2 (mkv checked, Maps to S01E05, 2160p WEB-DL, 8.7 GB, English; nfo unchecked); Footer Primary "Import 1 file with hardlinks", Cancel | Panel/inline, import rows | |
| Manual import, problem | `:146` | file row problem look `cduG2` ("Maps to: choose an episode" amber), Primary disabled, Callout risk "Pick an episode for every ticked file." | | |
| Manual import, importing | `:150` | Primary loading "Importing…" | Button loading | |
| Downloads live bar, expanded | design (Expand D) | base is the Downloads frame; a Panel/inline (width 1360, x 40, y 440) rises above the bar: Title "Downloads", Content = 3 Row/download rows (the downloading ones) + Label/group; Footer Primary "Open Downloads" (D), Secondary "Collapse" (Esc); page behind unchanged | Panel/inline, Row/download | 3 rows |
| Motion storyboards | | Live bar expand/collapse; Progress tick and download completes (Andor 91% → 100% → imported badge); Remove panel open with rows dimming | | |

**flagged-health.pen** (column x = 12000; Flagged rows y 6000…, Health in the next column x = 13600)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| Flagged, needs you | archive `R1GOrH`, `Flagged.tsx:260-370`, PRODUCT 7, 10 | Header/page "Flagged" + Note; Tabs row (Needs you 5 · Missing 10 · Below cutoff 4) with active underline; Table of Row/flagged ×5 (Civil War row selected, actions Search automatically / Pick a release shown row-size; Shōgun row shows Manual import / Open Health) | Tabs trigger ×3, Table, Row/flagged | 5 items |
| Flagged, missing | archive `Ulb14`, `:153-258` | Missing tab active; header checkbox column; 10 rows (Row/flagged with the first cell replaced by a `v2/Checkbox`), 3 checked, selection line above table "3 selected · Search · Clear" | Checkbox, Button | 10 rows |
| Flagged, below cutoff | `:361` | Below cutoff tab, 4 rows, Severance S02E01 selected with "Pick a release" | | 4 rows |
| Flagged, search sent | `:118-119,195-198` | needs-you Civil War row with Status/inline "Search sent"; Slow Horses row with "Sonarr refused the search." | Status/inline | |
| Flagged, pick a release opening | `:67-75` | Panel/inline under Civil War: header "Pick a release for Civil War", body "Reading Civil War from Radarr…" + spinner | Panel/inline, Spinner | |
| Flagged, pick a release could not load | `:67-75` | same panel; body is Callout risk "Radarr could not be read." Action Close | Panel/inline, Callout | |
| Flagged, nothing needs you | `:333` | Empty state "Nothing needs you" / "Automatic fixes handled everything. Anything they give up on lands here." Action "Open activity log" (A) | Empty state (default copy) | |
| Flagged, loading / could not be read | `:321-327` | two frames: skeleton rows; Callout risk "Flagged items could not be read." Try again | | |
| Health | archive `imWFw`, `Health.tsx:126-159`, PRODUCT 8 | Header/page "Health" + summary + Action "Run all checks" (secondary 40); Label/group "Problems 4" + Table of Row/health-problem (risk ×2, warning, notice in the default look); "Services" as four Status/service pills in a row (connected/failed); "Tracker accounts": Table with Header (Tracker, Global ratio, Hit and run, Cooldown) and 3 Fact/row-based rows (tracker ratio look `pZbrj`); "Disk": Fact/row disk over limit `pAPgT`; "Background jobs": Fact/row "7 ran on time" + "Search missing · late · expected every 6h" warning; "Backup": Fact/row | Row/health-problem, Status pill, Fact/row, Label/group | problem world; app bar Health count 2 |
| Health, all clear | `:44,72` | summary "0 problems · checked 2 min ago"; Problems: Empty state "Nothing needs attention"; all pills connected; disk 62% | | all-clear world |
| Health, checking | `:147` | Action button loading "Checking…"; summary "checking now…" | Button loading | |
| Health, loading / could not be read | `:150-156` | two frames as for Flagged | | |
| Motion storyboards | | Flagged row → pick panel open; Tabs underline slide + table swap; Run all checks (loading → results crossfade) | | |

**history.pen** (column x = 12000; Blocklist frames continue in the same column then next)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| History | archive `EYHjp`, `History.tsx:195-281`, PRODUCT 10 | Header/page "History", summary "Sonarr, Radarr and media-manager-2 · newest first", Action "Blocklist" (ghost 40 with chevron); two Tabs rows (Events: All · Grabs · Imports · Failures · Automatic fixes · Deletions; Service: All · Sonarr · Radarr); Label/group "Today" / "Yesterday" / "9 Oct" with Table per day, Header `Yvzat`, Row/history rows (failed row = problem look `pQ0T9`, automatic fix = default with By "Automatic fix"); "Load more" secondary 40 at bottom | Tabs, Label/group, Table, Row/history | 11 events |
| History, event expanded | `:173-180` | Civil War failed row selected; a `v2/Row/episode-details`-style band (use `WwDvp` with Content replaced) listing Fact/row pairs (Release, Tracker, Release group, Custom format score, How it was found, Age when grabbed, Radarr says) and a "Mark as failed" secondary row-size button; other rows dimmed | Row/episode-details, Fact/row, Button | |
| History, mark as failed | archive `fs0ud`, `:102-119` | band shows Panel/inline: Title "Mark this grab as failed?", Body (the sentence at `:106`), Footer Primary 48 "Mark as failed, keep seeding", Cancel | Panel/inline | |
| History, mark as failed, remove failed on | `:108-112` | same + Callout risk with the "Remove Failed" sentence | Callout | |
| History, marked as failed | `:88-101` | band shows Status/inline sent "Marked as failed. Radarr is searching again." + Close | Status/inline | |
| History, loading more / loading / failed / empty | `:241-253,273-277` | four small frames: Load more button loading; skeleton rows; Callout "History could not be read." Try again; Empty state "No events yet" | | |
| History, filtered to a title | `:187-193,228` | summary "… · Severance"; Events tab Grabs active; 3 rows | | |
| Blocklist | archive `D1bufZ`, `Blocklist.tsx:83-154` | Header/page "Blocklist" summary "3 blocked releases", Note (the sentence at `:87`); Tabs (All · Blocked by you · Blocked automatically · Sonarr · Radarr); Table Header `Uxuhe`, Row/blocklist ×3 (Civil War row risk look), second row selected with "Unblock" row-size secondary | Tabs, Table, Row/blocklist | 3 |
| Blocklist, unblocked with undo | `:92-99,24` | The Bear row gone; Toast at (40, 752): "Unblocked The.Bear.S03.1080p.WEB-DL-playWEB" / "Sonarr can grab that release again on the next search." Action Undo (Z) | Toast | |
| Blocklist, unblock failed | `:100-102` | row back; Callout risk "Sonarr did not unblock it." | Callout | |
| Blocklist, nothing blocked | `:114` | Empty state "Nothing is blocked here" | | |
| Motion storyboards | | Event row expand; Unblock → row collapses + undo toast → Undo restores | | |

**calendar.pen** (column x = 12000)

| Frame | Source | State | Components | Data |
|---|---|---|---|---|
| Calendar, week | archive `J1uFA4`, `Calendar.tsx:92-130,188-229`, PRODUCT 9 | Calendar/Header (Range, Missing "2 missing", Previous/Today/Next, Time zone "Times in Europe/London", View: Week active); 7 columns 188 wide: DayHeader (Sat 11 = today look, Sun 12 = tomorrow look `r3XedV`), Entries (Andor downloading, The Bear downloading, Severance S02E08 gave up look, Civil War gave up, Slow Horses plain), Now line in Sat column | Calendar/Header, DayHeader, Entry, Now line | week data |
| Calendar, month | archive `g20KL`, `:108-126` | View Month; 5 rows × 7 MonthCells (out-of-month look for 28–30 Sep and 1 Nov, today look on 11); entries as per data; one cell with "+2 more" | MonthCell | month data |
| Calendar, forecast | archive `S8S9Ex`, `:102-107` | View "Forecast"; Label/group "4 aired, still missing" (warning count colour) with 4 Entry rows at width 1360 (gave up / missing looks); then Label/group per day (Sat 11 · today, Sun 12, Mon 13, Tue 14, Wed 15) with full-width Entries | Label/group, Entry | forecast data |
| Calendar, loading | `:214` | header + 7 columns of `v2/Skeleton/calendar entry` ×2 each | Skeleton | |
| Calendar, could not be read | `:215-220` | Callout risk "The calendar could not be read." Action Retry | Callout | |
| Calendar, Sonarr not connected | `:223-225` | Callout warning "Sonarr isn't connected yet, so episodes are missing." above the week; only Civil War entry remains | Callout | |
| Calendar, empty week | design | week of 26 Oct – 1 Nov with no entries; a muted line under the header "Nothing airs this week." | text | |
| Motion storyboards | | Week step (Next: crossfade); Entry downloading → imported; View switch (segmented slide) | | |

**sign-in.pen** (column x = 12000; 1440×900, no app bar or live bar; page fill `$5:background`)

One component instance per frame (see Missing library components, `v2/Sign-in/block`), placed at x 96, y 306 (critique `settings-signin-status.md:327`, fixed y across states), plus the frames that show the signed-in app bar states:

| Frame | Source (`SignIn.tsx`) | Heading / body / buttons |
|---|---|---|
| Sign in, loading | view `status` `:298,353-355` | "Sign in" / initial copy / Button disabled "Loading…" |
| Sign in | `initial` `:299,326-330,346-351` | "Sign in" / two body lines / Primary "Sign in with Plex" with the Plex logo (`5:hNlc0`) as the Icon |
| Sign in, opening Plex | `preparing` `:300,332,352-356` | Button loading "Opening Plex…" |
| Sign in, checking Plex account | `checking` `:301,333,355` | Button loading "Checking…" |
| Sign in, not finished on Plex | `pending` `:302,334,358-363` | Primary "Check again", ghost "Try again", ghost "Cancel" |
| Sign in, cancelling | `cancellationBusy` `:362` | pending layout, buttons disabled, Cancel reads "Cancelling…" |
| Sign in, interrupted | `interrupted` `:303,335,365-369` | Primary "Try again", ghost "Cancel" |
| Sign in, wrong owner | `wrong-owner` `:304,336,377-378` | Primary "Try again" |
| Sign in, Plex unavailable | `unavailable` `:305,337` | Primary "Try again" |
| Sign in, not configured | `not-configured` `:306,338` | no button; body names `PLEX_OWNER_ID` and `APP_ORIGIN` in `$5:font-data` |
| Sign in, attempt expired | `expired` `:307,339` | Primary "Try again" |
| Sign in, could not be verified | `invalid` `:308,340` | Primary "Try again" |
| Sign in, session expired | `session-expired` `:309,341` | Primary "Try again" |
| Sign in, could not be cancelled | `cancel-failed` `:310,342,371-375` | Primary "Try cancelling again", ghost "Try again" |
| Signed in, signing out | `main.tsx:220-225` | Library screen copy; app bar Keys slot replaced by a ghost 40 button "Signing out…" disabled |
| Signed in, sign-out failed | `main.tsx:228-231` | same; button "Try sign out again"; Callout risk below the app bar "Sign-out failed. Your session may still be active." |
| Signed out | `SignIn.tsx:72,230` | initial layout; Status/inline sent "Signed out." above the heading |
| Motion storyboards | | Initial → Opening Plex; Checking → Library (hand-off fade) |

**Phone track (optional, last)**: `library-search.pen` "v2 / Phone / Search results" (390×844: Navigation/Phone with Search, Label/group, Row/search-result at width 358), `title.pen` "v2 / Phone / TV overview" (Header/title at width 390 compact look + Item/episode-list rows) and "v2 / Phone / Episode actions sheet" (Scrim 390×844 + Sheet with 3 Option rows), `releases.pen` "v2 / Phone / Pick a release" (Item/episode-list header + Row/release instances at width 358 showing Quality, Release, Comparison and Size only; other cells `enabled:false`) and "v2 / Phone / Grab sheet" (Sheet: Title, Subtitle, Content = 3 Fact/row, Primary "Replace tracked version", Secondary "Keep as second version"), `sign-in.pen` "v2 / Phone / Sign in" (block at width 342). Archive sources `o1n2Js`, `Wzmnv`, `IoIR0`, `YQrvQ`, `LN7tO`, phone sign-in. No new components; if a phone frame cannot be built from existing components with width and `enabled` overrides, STOP and report.

### Missing library components

All go in `design-system.lib.pen`, built as copies of the Section format, named `v2/...`, `reusable:true`, states as instances beside them. Tokens only from the existing 86 plus the motion tokens below.

1. `v2/Status/inline` (sheet `r7eDFX`, new Section appended after `XkoYu`). Anatomy: horizontal frame, gap 6, `alignItems:center`, height 20: `Icon` (icon 12, lucide `check`), `Spinner` (ref `SHXXo` 12×12, off), `Text` (`$font-ui` 13/500). Looks as root/children overrides: sent (Icon `check` in `$muted-foreground`, Text `$muted-foreground` "search sent"); failed (Icon `alert-circle` `$destructive`, Text `$destructive` "Sonarr didn't answer."); busy (Icon off, Spinner on, Text `$muted-foreground` "Searching…"). Section note: "Inline result of an action next to the control that started it: sent, failed, busy. Replaces loose status words. Maps to shadcn: none (plain text with an icon)." Needed by title (search sent/failed, monitor refused), flagged, history, downloads, sign-in (Signed out.).
2. `v2/Skeleton/row` (sheet `r7eDFX`, new Section after `ZWojF`): frame 1360×40, horizontal, padding `[0,16]`, gap 16, `alignItems:center`, children five `v2/Skeleton` refs with widths 48, `fill_container`, 120, 120, 90 (height 14). States: "two-line" instance with height 56 and the fill block replaced by a vertical frame of two blocks (280×14, 180×12). `v2/Skeleton/row-two-line` is that instance promoted to its own component (reusable). Used by downloads, flagged, history, title, releases loading frames.
3. `v2/Skeleton/poster card`: vertical frame width 152, gap 8: Skeleton ref 152×228 `cornerRadius:"$radius-md"`, 120×14, 80×12 (copy `YDyQ7`'s shape, make it reusable with refs). Used by library loading.
4. `v2/Skeleton/search result`: frame 880×84, padding `[10,16]`, gap 14: Skeleton 40×60 radius 4; vertical frame gap 8 with blocks 240×14, 420×12, 560×12. No current frame uses it (the Search results swap storyboard uses dimmed rows, not skeletons); build it anyway, the library's Skeleton section promises per-row skeletons.
5. `v2/Skeleton/calendar entry`: frame 180×44, `$muted` fill, radius `$radius-sm`, padding `[6,8,6,10]`, vertical gap 6: blocks 100×12, 70×10. Used by calendar loading.
6. `v2/Sign-in/block` (sheet `Mm8Xf`, Section appended after `pOyfv`): vertical frame width 400, gap 0: `Product name` text ("media-manager-2", `$font-ui` 13/600 `$muted-foreground`, 32 below via a frame padding), `Heading` text (`$font-ui` 36/800 `$foreground`, `textGrowth:"fixed-width"`, width `fill_container`), `Body` vertical frame gap 12 padding `[20,0,32,0]` with `Body 1` and `Body 2` texts (`$font-ui` 16/400 `$muted-foreground`, fixed-width, line height 1.5), `Buttons` horizontal frame gap 8: `Primary` ref `ht3RN` height 48 large look with Icon replaced by ref `hNlc0` (Plex logo) 24×24 and Label "Sign in with Plex", `Secondary 1` ref `ht3RN` ghost 48 (off), `Secondary 2` ghost 48 (off); `Status` ref to `v2/Status/inline` (off) placed above Heading. States on the sheet: initial, opening Plex (Primary loading), pending (three buttons), not configured (no buttons). Needed by all sign-in frames (16 instances).
7. Motion tokens and the motion sheet (see Motion system).

Nothing else is missing: deletes, remove-from-downloads, manual import, monitoring and discard-edits all use `v2/Panel/inline` (its note names delete as a use); undo uses `v2/Toast`; inline field errors use `v2/Field/labelled` Error; empty states use `v2/Empty state`; disabled looks exist on Button, Nav item, Row, Card/choice.

### Motion system

Tokens (add with `SetVariables({...})` with no `replace` argument, so the 86 existing variables stay): `duration-fast` 120, `duration-base` 160, `duration-slow` 220, `duration-spin` 700, `duration-shimmer` 1400, `duration-toast` 6000, `delay-tooltip` 400 (all `type:"number"`, milliseconds); `ease-out` "cubic-bezier(0.2, 0, 0, 1)", `ease-in` "cubic-bezier(0.4, 0, 1, 1)", `ease-in-out` "cubic-bezier(0.4, 0, 0.2, 1)", `ease-linear` "linear" (all `type:"string"`). Rule written on the sheet: anything entering uses `ease-out`, anything leaving `ease-in`, loops `ease-linear`; under `prefers-reduced-motion: reduce` every loop stops, every slide or scale becomes an opacity-only fade of `duration-fast`, and every size change is instant.

Transition table (also the content of the motion sheet; columns Trigger · What changes · Duration · Easing · Reduced motion):

| # | Trigger | What changes | Duration | Easing | Reduced motion |
|---|---|---|---|---|---|
| 1 | Page change (nav click, breadcrumb) | new page opacity 0→1 | duration-fast | ease-out | instant |
| 2 | Hover on rows, buttons, nav items, poster cards, calendar entries, cards | fill to the hover token; poster brightness 100→92% | duration-fast | ease-out | keep (colour only) |
| 3 | Press | fill to pressed token | 0 | — | — |
| 4 | Focus ring | appears | 0 | — | — |
| 5 | Panel/inline open (pick a release, monitoring, delete, remove, import, discard) | height 0→full, opacity 0→1, rise 6 px; sibling rows to the dimmed look | duration-base | ease-out | opacity only, duration-fast |
| 6 | Panel/inline close | reverse | duration-fast | ease-in | opacity only |
| 7 | Season expand / collapse, history row expand | chevron rotates 90°, rows height 0→full | duration-base | ease-out | instant |
| 8 | Row selection, range select | side bar and `selected` fill appear | duration-fast | ease-out | keep |
| 9 | Selection bar in / out | slide up 16 px + fade in; fade out | duration-base / duration-fast | ease-out / ease-in | fade only |
| 10 | Toast in / stay / out | slide up 12 px + fade in; stays duration-toast (paused on hover); fade out | duration-slow / — / duration-fast | ease-out / — / ease-in | fade only |
| 11 | Phone sheet + scrim | sheet slides from the bottom edge, scrim opacity 0→1 | duration-slow | ease-out (in) / ease-in (out) | fade only |
| 12 | Dropdown menu, select list | fade + 4 px slide from the trigger | duration-fast | ease-out / ease-in | fade only |
| 13 | Tooltip | after delay-tooltip, fade in | duration-fast | ease-out | same |
| 14 | Skeleton to content | shimmer loops (duration-shimmer, ease-linear); content crossfades over the skeleton | duration-base | ease-out | no shimmer; instant swap |
| 15 | Spinner | one turn per duration-spin | duration-spin | ease-linear | still |
| 16 | Progress bar update (row, live bar, poster strip) | Fill width to the new percent; percent text swaps instantly | duration-slow | ease-out | instant |
| 17 | Download completes / imports | state badge crossfade (Downloading → Imported), row leaves "Everything else" list after duration-toast | duration-base | ease-out | instant |
| 18 | Grab in row | Grab → loading (spinner) → "Grabbed" badge crossfade; progress line grows from 0 | duration-base, then 16 | ease-out | instant |
| 19 | Undo window (blocklist, toast) | row height → 0 after the window closes; Undo restores it | duration-base | ease-in / ease-out | instant |
| 20 | Checkbox, radio, bookmark toggle | glyph scale 0.85→1, check stroke draws | duration-fast | ease-out | instant |
| 21 | Toggle group / tabs selected marker | segment or underline slides to the new item | duration-base | ease-out | instant |
| 22 | Calendar step, view switch, search results swap, settings pane swap | content crossfade | duration-base | ease-out | instant |
| 23 | Live bar expand / collapse | panel rises from the bar | duration-base / duration-fast | ease-out / ease-in | fade only |
| 24 | Sign-in state change | heading and body crossfade; button label swaps instantly | duration-base | ease-out | instant |
| 25 | Connect (settings), Run all checks, Add and search | button to loading look at once; result crossfade | duration-base | ease-out | instant |

Motion sheet frame spec: in `design-system.lib.pen`, a new top-level frame `v2 · Library 6 · Motion` at x 10800, y 17640, made by copying sheet `yawBw` and deleting every child except the copied "Sheet header" (then set its title text to "v2 component library · 6 of 6 · Motion" and note to the rule sentence above). Children appended, in this order, each a frame width `fill_container`: (a) "Tokens" vertical gap 16 with a "Title" text "Motion tokens" and one "Token line …" row per token group copied from `ptqKk`'s shape (Key 96 wide + Values `fill_container`, `$muted-foreground`): Durations, Easings, Reduced motion; (b) "Transition table": a "Header" row (5 texts, `$font-ui` 11/600 capitals `$subtle-foreground`, widths 220, 420, 140, 160, fill) and 25 rows (same widths, `$font-ui` 13, `$foreground` first column, `$muted-foreground` others, 32 high, line under `$border` via a 1-px rectangle in a vertical wrapper); (c) "Storyboard legend": a text explaining "Each screen file holds `v2 / Motion / …` frames: three stages, Before · Mid · After, with the stage time in the caption; Mid shows the state at half the duration, drawn with opacity and position overrides."

Storyboard frame spec (per screen file): frame named `v2 / Motion / <transition>`, width 1440, horizontal, padding 24, gap 24, fill `$5:background`, `clip:true`; three children "Stage before", "Stage mid", "Stage after", each vertical gap 8 width 440: a "Caption" text (`$5:font-ui` 13/600 `$5:subtle-foreground`: "Before · 0 ms", "Mid · 80 ms · duration-base ease-out", "After · 160 ms") and a "Stage" frame 440 wide, height H (given per step), `clip:true`, fill `$5:card`, stroke `$5:border` 1, `layout:"none"`, holding instances positioned with x/y so the moving part is visible. Mid stage: the appearing node gets `opacity:0.5` and its y offset halved (e.g. toast rising 12 px → 6 px), a growing panel gets half height via a wrapper frame with `clip:true`, a progress Fill width halfway. A transition that is a crossfade shows both old and new nodes at `opacity:0.5` in Mid.

### Steps

Rules for every step: every id below is a library id; on a screen prefix it with `5:` (ref `5:ht3RN`, token `$5:background`, override key `"5:OXVvv"`, nested `"5:aqYd6/5:bX27S"`). Read before overriding: `Get('5:<component>',{resolveInstances:true,depth:4})` on the screen file shows the exact child ids of cells that are elided above. Use `Copy` for repeated rows; `Copy` returns new ids, so read the copy with `Get` before updating its children. Keep each `execute` call to one frame or one row group. No `Export`. `placeholder:true` on every new top-level frame until it is finished.

**Track 1: library (design-system.lib.pen only)**

1. Marker proof for `design-system.lib.pen`: `mId=Insert(document,{type:"frame",name:"marker design-system.lib.pen",x:0,y:0,width:10,height:10,fill:"#FF0000"})`, then `Get((n,c)=>{if(!c.parentCtx&&String(n.name).startsWith('marker '))Print(n.id,n.name);c.skipChildren()})` must print exactly one line, `marker design-system.lib.pen`; then `Delete(mId)`. Also run `GetVariables()` and confirm 86 variables and that `radius-xs` is `{type:"number",value:4}`.
2. Add the 11 motion tokens with one `SetVariables({...})` call, no second argument. Re-run `GetVariables()` and confirm 97 variables and that `background` is still `#FFFFFF`.
3. Create the Skeleton components: Copy section `gfupz` into `r7eDFX` (Copy returns the new section id; Get it), rename it "Section v2/Skeleton rows", set the title text "v2/Skeleton rows", note "Loading rows that match each row family's shape: row 40, row two-line 56, poster card, search result, calendar entry. Shimmer 1.4 s (duration-shimmer), static under reduced motion. Maps to shadcn Skeleton.", replace the Demo row's "State Component" content with `v2/Skeleton/row` (reusable) and add State frames for the other four, each with its own reusable component (`v2/Skeleton/row-two-line`, `v2/Skeleton/poster card`, `v2/Skeleton/search result`, `v2/Skeleton/calendar entry`), sized as in Missing library components. Then `Move` the new section to sit right after `ZWojF` (index = ZWojF's index + 1 in `r7eDFX`).
4. Create `v2/Status/inline`: Copy `gfupz` into `r7eDFX`, rename to "Section v2/Status/inline", set title and note (text in Missing library components), State Component holds the reusable frame; add State frames "sent", "failed", "busy" as instances with the overrides listed. Move it to right after `XkoYu` (end of sheet is fine).
5. Create `v2/Sign-in/block`: Copy `gfupz` into `Mm8Xf`, rename "Section v2/Sign-in/block", note "Sign-in page content block, 400 wide, fixed position on the page (x 96, y 306). Overrides: Status (off), Heading, Body 1, Body 2, Primary (label, loading, Plex logo icon), Secondary 1 and 2 (off by default). Copy comes from src/client/SignIn.tsx. Custom.", build the component as specified, add States initial, opening Plex, pending, not configured.
6. Create the motion sheet: `Copy('yawBw', document, {x:10800, y:17640, name:"v2 · Library 6 · Motion", placeholder:true})`; `Get` the copy with depth 1, `Delete` every child except the one named "Sheet header"; `Update` the header's title text to "v2 component library · 6 of 6 · Motion" and its note to the rule sentence. Add the "Tokens" block (copy `ptqKk` three times from `x1g4a` into the new sheet's Tokens frame and update Key/Values texts: "Durations" → "duration-fast 120 hover, press, check · duration-base 160 panels, menus, tabs, crossfades · duration-slow 220 toast, phone sheet, progress tween · duration-spin 700 · duration-shimmer 1400 · duration-toast 6000 · delay-tooltip 400"; "Easings" → the four values with their uses; "Reduced motion" → the rule).
7. Add the "Transition table" frame with the header row and the 25 rows from the Motion system table (one `execute` per 8 rows, built with a loop over an array of 5-string rows). Add the "Storyboard legend" text. `TakeScreenshot([sheetId])`; set `placeholder:false`.
8. Verification (Track 1 procedure below). Report the new component ids (they are needed by every screen track) and the motion sheet id.

**Pause (Alec)**: with `design-system.lib.pen` in front, press Cmd+S. Then for each of the eight screen files: close its tab and reopen it from disk (File > Open), so the import re-reads the saved library. Each screen track then confirms availability before writing: `Get((n,c)=>{if(!c.parentCtx)Print(n.id,n.name);c.skipChildren()})` must list `5:<motion sheet id>` "v2 · Library 6 · Motion", and `Get('5:r7eDFX',n=>n.reusable&&n.name==='v2/Status/inline'&&Print(n.id))` must print one id. If either is missing, STOP and report "library not reloaded".

**Every screen track, first steps (same for Tracks 2 to 10)**

A. Marker proof for the file (as Track 1 step 1 with the file's own name). Then the availability check above. Then run the clipping check on one existing screen in the file (for empty files, on `5:r7eDFX`) and keep its output as the baseline.
B. Base frame. Files with screens: `Copy('<existing screen id>', document, {name:"<new name>", x:<column x>, y:<row y>, placeholder:true})`, then read the copy (`Get(id,{depth:2})`) to learn the new child ids. Empty files: `Insert(document,{type:"frame",name:"…",x:12000,y:6000,width:1440,height:900,layout:"vertical",clip:true,fill:"$5:background",placeholder:true})`; children: `{type:"ref",ref:"5:F5qou",name:"App bar",width:"fill_container"}`, `{type:"frame",name:"Page",width:"fill_container",height:"fill_container",layout:"vertical",padding:[8,40,24,40],gap:24}`, `{type:"ref",ref:"5:jXjdR",name:"Downloads live bar",width:"fill_container"}`. Set the active nav item: read `Get('5:F5qou',{resolveInstances:true,depth:4})`, copy the exact props that make `H0TcR` Nav Library look active onto the page's nav item (e.g. `"5:qGq1V"` for Downloads) and reset `"5:H0TcR"` to the default look; set counts `"5:qGq1V/5:HSPSn"` "3", `"5:Y8D5o/5:HSPSn"` "5". Live bar items as in Canonical sample data.
C. Build the frame's content per the Screens table, one `execute` per section (header, each table or group, panel, toast). `TakeScreenshot([frameId])` once per finished frame; `placeholder:false`.

**Track 2: downloads.pen** — frames in the order of the table (Downloads first; the other frames are copies of it with changes). Steps: A, B; 1 Downloads (header via `5:pLro9` with Title "Downloads", Summary "11 items · 1 needs you · 2 problems being handled", Note on with the live note; three group blocks: `5:mk4uT` + `5:gp6Kh` with Header replaced by a copy of `5:sFg5L`'s cells and Body rows as `5:k3Rz6` instances; Shōgun row `fill:"$5:selected"` with Marker on, its two actions as `5:ht3RN` height 28 instances in the row's Actions cell; the import-blocked second line in the Title cell); 2 loading; 3 could not be read; 4 nothing downloading; 5 reconnecting; 6 delayed grab; 7 remove; 8 remove failed; 9 manual import; 10 import problem; 11 importing; 12 live bar expanded (base is the Downloads frame; place the panel over it); 13 three storyboards (stage H: 320 for expand, 200 for progress tick, 480 for remove panel); 14 verification.

**Track 3: flagged-health.pen** — A, B; frames in table order (Flagged ×9, then Health ×5 in the next column), storyboards ×3 (stage H 420, 120, 160), verification.

**Track 4: history.pen** — A, B; History ×8 frames, Blocklist ×4, storyboards ×2 (H 360, 220), verification.

**Track 5: calendar.pen** — A, B; week (build the 7-column grid as a horizontal frame gap 8 of column frames width 188 with DayHeader + vertical entries; Now line as `layoutPosition:"absolute"` child at the Sat column at y for 14:32 = header 32 + 0.6 × column height), month (5 row frames of 7 `5:z4pNq0`), forecast, loading, could not be read, Sonarr not connected, empty week; storyboards ×3 (H 240, 120, 80); verification.

**Track 6: title.pen** — A, B (base `LdNGY`; for the just-added and not-in-library frames the hero instance is `5:NaDkI` with the `Vu3xl` overrides read from the sheet); frames in table order; storyboards ×4 (H 300 season, 220 selection bar, 420 monitoring panel, 300 just added); verification.

**Track 7: releases.pen** — A, B (base `UourQ`; the movie frame bases on a copy of `UourQ` with the Episodes block replaced by a compact `5:NaDkI` strip); frames in table order; storyboards ×3 (H 460, 120, 160); verification.

**Track 8: library-search.pen** — A, B (base `m4XuKw` / `MHUEJ`); frames in table order; storyboards ×3 (H 300, 260, 280); verification.

**Track 9: settings.pen** — A, B (base `r62o3J`); 4 frames; storyboards ×2 (H 200, 320); verification.

**Track 10: sign-in.pen** — A (empty file), base: 1440×900 frame fill `$5:background`, `layout:"none"`, one `5:<Sign-in block id>` instance at x 96, y 306; 17 frames (the two signed-in ones copy a Library-like page: build it once from `5:F5qou` + an empty Page + `5:jXjdR`, then copy); storyboards ×2 (H 320); verification.

**Track 11 (optional): phone** — owns `library-search.pen`, `title.pen`, `releases.pen`, `sign-in.pen` after Tracks 6, 7, 8, 10 finish; A per file; six 390×844 frames at x = next free column, one per row from y 6000 onward; verification per file.

### Out of scope — do not touch

Dark mode and the archive file; the unprefixed local token copies in each screen file (the `$page-margin` references on existing pages stay); existing v2 screens beyond adding states (no restyling of `m4XuKw`, `MHUEJ`, `LdNGY`, `RxIN2`, `UourQ`, `uKtnA`, `Vs2IJ`, `r62o3J`, `Fv2CA`); the known data discrepancies between existing screens (releases.pen February dates, Library "2 downloading", settings toast at bottom right); `src/`; `DESIGN.md`, `design/README.md`, `.impeccable/*`, `PRODUCT.md` (both copies); the handover's open library fixes: `row` token being `#000000`, `radius-xl` 14, stale sheet notes (Select 36 px, ToggleGroup 30 px, old names `ink-2`, `line-strong`, `risk`), `detail-indent` 133 vs 136, the Button Shift+R hint, the possibly lost notes on `K72sxW` and `pAPgT`; editing `v2/Button` itself (it times out); any `SetVariables` with `replace:true`; PNG or HTML exports; commits, pushes, git stash.

### Retired terms

none.

### Verification

Per track, run in the track's own file(s), paste outputs in the report:

1. Marker proof output (step A) with the file name, before the first write.
2. Screenshot pass: `TakeScreenshot([...])` of every new frame, at most 3 ids per call, after the frame is finished; one sentence per frame on what it shows and that nothing is collapsed, overlapping or cut off. For storyboards one screenshot per storyboard frame.
3. Clipping check, per new frame: `Get('<frameId>',(n,c)=>{if(n.enabled===false){c.skipChildren();return}if(c.problems)Print('CLIP',n.id,n.name,'in',c.parentCtx&&c.parentCtx.node.name,c.problems);if(n.type==='text'&&c.parentCtx&&(c.bounds.x+c.bounds.width>c.parentCtx.bounds.width+1||c.bounds.y+c.bounds.height>c.parentCtx.bounds.height+1))Print('TEXT-OVERFLOW',n.id,n.name,String(n.content).slice(0,40))},{resolveInstances:true})`. Pass = no `TEXT-OVERFLOW` lines and no `CLIP` lines other than those also present in the baseline run on an existing screen of the same file (name the baseline ids, e.g. the known `T1Pftv` Kbd clip inside Row/second-version). Fix overflow by widening the container or shortening copy, never by hiding.
4. Checklist, one row per frame or storyboard: frame name · id · x,y · components used (refs) · states shown · sample data checked against the Canonical sample data · screenshot taken (call number) · clipping check result · `placeholder` false. Plus one line: "Alias prefix used: 5:" and the availability-check output.
5. Track 1 adds: `GetVariables()` output count before (86) and after (97) with the 11 names; the ids of the five skeleton components, `v2/Status/inline`, `v2/Sign-in/block`, and the motion sheet; a screenshot of the motion sheet and of each new Section.
6. Nothing else: no tests, no builds, no exports, no commits. Alec saves (Cmd+S) each file at the end; the executor reports which files have unsaved changes (every file it wrote).

### Execution plan

| Track | Files owned | Model / effort | Order | Wall-clock |
|---|---|---|---|---|
| 1 library: components, tokens, motion sheet | `design-system.lib.pen` | opus / medium | SERIAL, alone | 2 h |
| Pause | — | Alec: Cmd+S on the library, close and reopen the eight screen files | after 1 | 5 min |
| 2 downloads | `downloads.pen` | opus / high | Wave A, PARALLEL with 3 | 3 h |
| 3 flagged + health | `flagged-health.pen` | opus / high | Wave A | 3 h |
| 4 history + blocklist | `history.pen` | opus / medium | Wave B, PARALLEL with 5, after A | 2.5 h |
| 5 calendar | `calendar.pen` | opus / medium | Wave B | 2.5 h |
| 6 title | `title.pen` | opus / high | Wave C, PARALLEL with 7, after B | 3.5 h |
| 7 releases | `releases.pen` | opus / high | Wave C | 2.5 h |
| 8 library + search | `library-search.pen` | opus / medium | Wave D, PARALLEL with 9, after C | 2 h |
| 9 settings | `settings.pen` | opus / medium | Wave D | 1.5 h |
| 10 sign-in | `sign-in.pen` | opus / medium | Wave E, alone, after D | 2 h |
| 11 phone (optional) | `library-search.pen`, `title.pen`, `releases.pen`, `sign-in.pen` | opus / medium | Wave F, alone, after E; skip if Alec says so | 2.5 h |

Never more than two tracks writing at once; two tracks never share a file. Each wave starts only after both tracks of the previous wave have reported their verification. Alec presses Cmd+S on each file after its track reports (the executor cannot save).

### Executor rules (copy verbatim into the handoff prompt)

> - Follow the steps in order. Do not add, merge, reorder, or skip steps.
> - Before editing in any folder, read the nearest AGENTS.md above it (and the root one) if the repo has them.
> - If reality contradicts a Verified fact or a step is impossible as written, STOP and report the discrepancy. Do not improvise a workaround.
> - Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for.
> - "Done" means the Verification procedure was run in this session and passed. Paste the evidence (screenshot results, clipping check output, filled checklist).
> - Touch nothing in the Out-of-scope list. Never commit or push.
> - Deliver what was asked, at the scope intended. If the spec seems mistaken, say so in a sentence and continue as specified.
> - Use the `impeccable` skill (Skill tool) when composing a new screen or state, for layout, hierarchy, copy and motion judgement; it never overrides a Verified fact, a token, or a decision in this work order.
> - You run in the background. Do not start agents of your own, do not use Bash `run_in_background`.
> - pen.dev reaches any `.pen` file open in a tab; a `filePath` to a file that is not open silently writes to the file in front. Before the first write to a file, insert a frame named `marker <file name>` through that path, read the top-level frames back through the same path, confirm the only marker present carries this file's name, then delete it. Identical file contents prove nothing; the marker is the only proof.
> - Every ref, override key segment and token in a screen file carries the file's alias prefix: `5:ht3RN`, `"5:aqYd6/5:bX27S"`, `$5:background`. Confirm the alias from the top-level `<alias>:x1g4a` frame before the first write.
> - Never run a whole-document `Get` visitor; walk `Get(id,{depth:N}).children` or visit one frame's subtree.
> - Keep `execute` calls small (one frame section or one row group each); take screenshots only when a frame is finished; at most two agents write to pen.dev at once.
> - pen.dev writes to disk only when Alec presses Cmd+S; you cannot save. Report which files you changed.
> - Never copy and paste between `.pen` files; it cuts the library links. New screens come from `Copy` inside the same file or from `Insert` with `5:` refs.
> - Each screen file holds an unused local copy of the 86 tokens (unprefixed); leave it alone.
> - `SetVariables` is called with no second argument (merge); `replace:true` would erase the tokens. Never call `Export`.

---

## Amendment after Track 1 (orchestrator, 11 Oct 2026)

Track 1 is done. New library ids (prefix with `5:` in screen files):

| Component | Id |
|---|---|
| `v2/Skeleton/row` | `g34znm` |
| `v2/Skeleton/row-two-line` | `kJlIx` |
| `v2/Skeleton/poster card` | `Om6ge` |
| `v2/Skeleton/search result` | `MFkuO` |
| `v2/Skeleton/calendar entry` | `jhCRH` |
| `v2/Status/inline` | `UMUhR` (children Icon `PMpjn`, Spinner `WnEQF`, Text `yO8o3`) |
| `v2/Sign-in/block` | `X2BYp` (Product name `lbIQG`, Status `RreFa`, Heading `SKxTr`, Body 1 `BEk5a`, Body 2 `UfeJ0`, Buttons `Bs63D`, Primary `lmLf2` with Plex logo `lmLf2/a0PNj` and Label `lmLf2/OXVvv`, Secondary 1 `f186pm`, Secondary 2 `pHS1b`) |
| Motion sheet | `vxYbM` |

Deviations Track 1 recorded (accepted, do not undo): calendar-entry skeleton blocks use `$border` on the `$muted` fill; transition-table rows hug their text with 8 px padding instead of a fixed 32; Sign-in Primary has its Kbd hint off; `row-two-line` is a separate component built with the same structure.

**Replacement for the availability check** (the version in the Pause paragraph crashes; use this one, in the screen file, before the first write):
```js
const top=[];Get((n,c)=>{if(!c.parentCtx)top.push(n.id+' '+n.name);c.skipChildren()});const ms=top.filter(t=>/ v2 · Library 6 · Motion$/.test(t));Print(ms.length?'motion sheet: '+ms.join(', '):'MISSING motion sheet')
const st=[];const w=n=>{if(!n||typeof n!=='object')return;if(n.reusable&&n.name==='v2/Status/inline')st.push(n.id);if(Array.isArray(n.children))n.children.forEach(w)};w(Get('5:r7eDFX',{depth:5}));Print(st.length===1?'status inline: '+st[0]:'MISSING v2/Status/inline ('+st.length+')')
```
Expected after Alec's save and reload: `motion sheet: 5:vxYbM v2 · Library 6 · Motion` and `status inline: 5:UMUhR`. If either line says MISSING, STOP and report "library not reloaded".

**Replacement for the clipping check** (Verification item 3; same rule for pass/fail; the visitor needs `resolveInstances:true`, and the fallback splits a subtree that throws):
```js
const ROOT='<frameId>',out=[],skipped=[]
const chk=id=>{const loc=[];try{Get(id,(n,c)=>{if(n.enabled===false){c.skipChildren();return}if(c.problems)loc.push('CLIP '+n.id+' '+n.name+' in '+(c.parentCtx&&c.parentCtx.node.name)+' '+c.problems);if(n.type==='text'&&c.parentCtx&&(c.bounds.x+c.bounds.width>c.parentCtx.bounds.width+1||c.bounds.y+c.bounds.height>c.parentCtx.bounds.height+1))loc.push('TEXT-OVERFLOW '+n.id+' '+n.name+' '+String(n.content).slice(0,40))},{resolveInstances:true});loc.forEach(l=>out.push(l))}catch(e){const g=Get(id,{depth:1,resolveInstances:true});if(g.enabled===false)return;skipped.push(id+' '+g.name);if(Array.isArray(g.children))g.children.forEach(k=>chk(k.id))}}
chk(ROOT);out.forEach(l=>Print(l));Print('issues',out.length,'| split at',skipped.length?skipped.join(', '):'none')
```
Tested: `m4XuKw` in library-search.pen → `issues 0 | split at none`. Run it in a separate execute call after the frame is built, not in the same call (checks run in the building call report false problems before layout settles).

## Amendment 2, during Wave A (Alec's ruling on tall pages; orchestrator's ruling on row actions)

**Tall pages (Alec, 11 Oct):** every desktop screen stays 1440×900 with `clip:true`, like the existing v2 screens. Content that does not fit above the live bar is cut off, as in the real app, which scrolls the page between the fixed app bar and live bar. Each frame may be "scrolled": offset the Page frame's content upward (a negative y on the content, or `clip:true` on Page with the content shifted) so the state the frame exists to show (a panel, a selected row, a toast) sits in view. Record the scroll offset in the checklist. The clipping check ignores clipping caused only by the screen's bottom edge: a `CLIP` line whose node's bounds start below the live bar's top edge, or are cut only at the bottom of the Page frame or the screen, is expected; everything else still counts. Frame sizes and the 1,060 px row spacing do not change; nothing sits at y ≥ 10259.

**Row actions (orchestrator):** a row's actions never widen its Actions column, and column widths stay shared across every table on the page. For the selected row (download, flagged, blocklist, history), the action buttons go on an "Actions line" directly under that row: a horizontal frame, height 40, padding `[0,16]` plus the row's leading indent, gap 8, fill `$5:selected`, holding the `5:ht3RN` height-28 instances, the same way the app renders them under the row (`Downloads.tsx:170-178`, `Flagged.tsx:113-121`). The Actions cell keeps its 72 px and shows nothing extra. Rows keep their component height (56 or 40). Track 2 reverts its widened "Needs you" table (Actions 300, Title 244, Shōgun row 76) to the shared widths and a 56 px row, and moves the two buttons to an Actions line.

## Running notes (orchestrator)

- Column rule confirmed by Tracks 3 and 4: four frames per column (y 6000, 7060, 8120, 9180); next column at x + 1600; nothing at y ≥ 10259.
- Alec, during Track 5: week-view day columns need a visible separator, a 1 px `$5:border` line between adjacent columns, full column height. Applies to any later frame that draws a week grid.
- Gap found by Track 4, parked for the wrap-up: `v2/AppBar/Desktop` has no History nav item, but the app has one (`Home.tsx:39-46`). Needs a library edit and a reload; not done mid-run. History screens show no active nav item.
- Track status (orchestrator): done and checked by screenshot: 1 library, 2 downloads, 3 flagged-health, 4 history, 5 calendar, 6 title, 8 library-search. Running: 7 releases, 9 settings, 10 sign-in. Three writers at once produced no timeouts in any track so far.
- Alec, after Track 8: on search results the "In library" chip is redundant with the "In your library" group header. Ruling: hide the chip on rows in that group on every search-results frame (including the existing `MHUEJ`); keep the header and the file count. Done by a follow-up executor on library-search.pen.
- Alec, after Track 6: frame `brbw1` (Delete, seeding history unknown) mixes scales; the delete panel's components are far larger than the rows around it; a modal may fit better. A read-only critique is running; its recommendation goes to Alec before any rebuild.

## Amendment 3: delete confirmations become a dialog (Alec, 11 Oct, after the critique of `brbw1`)

Decisions: (1) delete confirmations open in a centred dialog over the scrim; pick a release, change monitoring, remove from downloads and import by hand stay inline. (2) `v2/Panel/inline` loses its float shadow: in-flow panels get the 1 px `border` edge only; dialogs, menus, toasts and sheets are the only floating things. (3) Phone track skipped.

### Track 12: library, second pass (design-system.lib.pen only; opus / medium; runs alone on the library)

1. Marker proof for `design-system.lib.pen` (as Track 1 step 1). Confirm `GetVariables()` still has 97 variables.
2. `v2/Panel/inline` (`cZb0Z`): remove the float shadow from the component root (keep `card` fill, `radius-lg` corners, 1 px `border` stroke). Read `Get('cZb0Z',{depth:1})` first and record the shadow value you remove. Update its section note so it says in-flow panels have an edge and no shadow. Do not change its size, padding, slots or any instance on the sheet other than what the shadow removal changes automatically.
3. Scrim note `Y7zmI`: change the sentence that says the scrim goes "behind a phone sheet or an inline panel on small screens" to say it goes behind a phone sheet or a dialog.
4. New component `v2/Dialog` on sheet `r7eDFX`, as a new Section (copy section `gfupz`, rename "Section v2/Dialog", title "v2/Dialog", note: "Centred confirmation over v2/Scrim for rare, destructive or lossy actions: delete a file or version, delete a title, discard unsaved edits. Not for decisions that need the rows in view; those stay in v2/Panel/inline. Maps to shadcn AlertDialog."). Build it by copying `cZb0Z` and changing: width 560, padding 24 on all sides (content 512 wide), vertical layout gap 0; `card` fill, `radius-lg` (10) corners, 1 px `border` stroke, the float shadow `0 2px 6px #1111110F, 0 8px 24px #1111111F` (copy the exact shadow object you removed in step 2). Children in order:
   - `Header`: horizontal, `alignItems:start`, gap 16: `Title` text 18/700 `foreground` (`fill_container`), `Close` = the panel's ghost Close button with the Esc key hint.
   - `Subject` text 14/400 `muted-foreground`, `fill_container`, fixed-width wrap, 8 below the title; sample "S02E04 · 720p · 1.4 GB. The 2160p tracked version is not touched."
   - `Options`: vertical, gap 8, 20 above: two `v2/Card/choice` (`E7Mh6m`) at width 512, the first in the selected look with key hint 1, the second default with key hint 2.
   - `Groups` (off by default): for Delete movie, a vertical frame holding two groups, each a 14/600 `foreground` heading ("Files", "Torrents") plus its own Card/choice pair; when on, `Options` is off.
   - `Callout` (`BXgoa`) at width 512, 12 below the options, off by default; warning look for "no seeding record", risk look for a hit-and-run breach.
   - `Footer`: horizontal, `justifyContent:end`, gap 8, 24 above: `Cancel` = `ht3RN` secondary 40 "Cancel", `Primary` = `ht3RN` destructive 48 with the ↵ key hint, label like "Delete file, keep seeding".
   States on the sheet as instances: default (two options, no callout), with warning callout, with risk callout, grouped (Files + Torrents), discard edits (title "Discard edits to Radarr?", subject, no options, Primary destructive "Discard", Cancel "Keep editing").
5. Add the dialog's motion to the motion sheet `vxYbM` transition table as row 26: "Dialog open / close · scrim opacity 0→1, dialog opacity 0→1 and scale 0.98→1; reverse on close · duration-base / duration-fast · ease-out / ease-in · fade only, no scale". Copy an existing row frame and edit its five texts.
6. Verification as Track 1: GetVariables count (97, unchanged), screenshot of the new section, of `cZb0Z`'s section and of the motion sheet, clipping check on the new section; report the new component id and its child ids, and the shadow value removed.

### Pause (Alec): Cmd+S on `design-system.lib.pen`; then close and reopen every screen file that has a Panel/inline instance (`downloads.pen`, `flagged-health.pen`, `history.pen`, `releases.pen`, `title.pen`, `settings.pen`) so the shadow change and the new component arrive.

### Track 13: delete dialogs (title.pen and settings.pen; opus / high; runs after Track 12's pause and after Track 9 settings has reported)

A. Marker proof per file; availability check must also find `v2/Dialog` under `5:r7eDFX` by the depth walk.
B. In `title.pen`, rebuild `w5Ulv1` (Delete second version), `jSIY0` (Delete movie) and `brbw1` (Delete, seeding history unknown) in place (same ids are not required; same names and positions are): remove the inline delete panel, put the page back to its state before opening (the row or hero that triggered it keeps the selected look, rows back in place, no dimming), then add `5:y7vLCb` v2/Scrim covering the whole 1440×900 including app bar and live bar, and one `5:<Dialog id>` instance centred (x = (1440 − 560) / 2, y so the dialog is vertically centred), with the content from the Screens table for each frame: second version → default state with warning callout off and subject naming E04 720p; movie → grouped state; seeding unknown → warning callout on ("No seeding record, so keep the torrent to be safe."), the second card reading "Seeding time unknown (torrent not in rTorrent)". Primary labels as in the Screens table.
C. In `settings.pen`, rebuild the "Settings, discard edits" frame (Track 9 reports its id) the same way with the dialog's discard-edits state over the scrim; the Panel/inline it used goes.
D. Storyboard: add `v2 / Motion / Delete dialog open` to title.pen (stage H 420): before (page, row selected), mid (scrim at 0.5, dialog at 0.5 opacity, scaled 0.99), after.
E. Verification as for every screen track (screenshots, clipping check, checklist). Also re-screenshot one inline-panel frame per reopened file (`bCDVU`, `XffKk`, `UIskY`, `hGG02`, `x6fPFV`) to confirm the shadow is gone and nothing else moved; report any difference.

## Amendment 4: sign-in page redesign (Alec, 11 Oct)

Alec: the sign-in page "looks nothing like the rest of the app"; run the impeccable passes `shape`, `delight` and `colorize` on it. Plex findings: Plex publishes no "Sign in with Plex" button spec; its trademark page says the Plex mark may not be altered or distorted, must not imply Plex endorsement, and needs attribution when used ("used under license from Plex" or an approved statement); a Plex forum reply adds that an app must make clear it is not an official Plex product. The library's `hNlc0` Logo/Plex is the black chevron (`logos/plex-icon.png`, 20×20). Plex's own colour for the chevron is its gold (#E5A00D). Allowed renderings: the unaltered black chevron on a light (`card`) button, or Plex's gold chevron on the black primary. Never a white or recoloured mark beyond Plex's own gold.

Track 12 results: `v2/Dialog` is `Oi69B` (section `zwbXg` on `r7eDFX`; Subject text `r45NK`, Callout frame `nnfu7` with instance `xplqO`, Groups `V3LVl4`, Options `pJNJH`, cards `JVFmZ`/`RNDEm`, Footer `lM0li`, Cancel `fV7RX`, Primary `D8VI1F`; states `JYmpS` default, `Z7YXr` warning, `F81HS` risk, `RljJf` grouped, `dkPi5` discard edits). `cZb0Z` Panel/inline has no shadow now. Motion row 26 is `z1zpi`.

### Track 14: sign-in redesign, phase 1 (library only; opus / high; alone on the library)
Run the impeccable skill's `shape`, then `colorize`, then `delight` references against the sign-in surface (PRODUCT.md: Operate mode, one owner, desktop first), with these fixed inputs: the v2 tokens and controls only; copy verbatim from `SignIn.tsx:297-380`; the app's identity is the paper-white page, black actions, lime only for best/live, 4 to 10 px corners, soft shadows only on floating things, Schibsted Grotesk; the page must read as the same product as the Library screen (`m4XuKw` in library-search.pen: app bar with product name, 48 px search in a 64 px bar). Decide and record: the page composition (where the block sits, whether the product name is set like the app bar's, what else is on the page: a quiet product line, the "not an official Plex product" attribution line, a keyboard hint), the colour moves (where black, where `muted`, whether Plex gold appears and only on the mark), and the delight moves (one or two purposeful touches, e.g. the state change crossfade already in the motion sheet, a focus ring that matches the app, the chevron as the only accent). Then rebuild `v2/Sign-in/block` (`X2BYp`) in place to that plan, keeping its child names (Product name, Status, Heading, Body 1, Body 2, Buttons, Primary, Secondary 1, Secondary 2) so the 17 instances in sign-in.pen keep their overrides, and update its section note. If the plan needs a gold Plex mark, add `Logo/Plex gold` beside `hNlc0` in `Iahma` using `logos/plex-icon.svg` recoloured to #E5A00D saved as `logos/plex-icon-gold.svg` (an executor may write that file; it is a copy of Plex's mark in Plex's own colour). Verification as Track 1 (screenshots of the section and its four states, clipping check, variable count unchanged at 97). Report the plan in prose (10 lines max) and what changed.

### Pause (Alec): Cmd+S on the library; close and reopen all eight screen files.

### Track 15: sign-in redesign, phase 2 (sign-in.pen only; opus / medium; parallel with Track 13)
After the reload, rebuild the 17 sign-in frames and 2 storyboards to the phase 1 plan: page-level changes (anything outside the block), re-check every instance's overrides against the copy, re-run the clipping check and screenshots. The two signed-in frames (`pDOyQ`, `PDZwf`) only change if the plan touched the app bar sign-out control.

## Amendment 5: the decision-scale rule (Alec, 11 Oct, after `aoVjd`)

Rule, three tiers by where a decision lives:
1. **In the table.** Opens from a row and keeps the rows in view: row scale only. A tinted band (`muted` fill, square, no stroke, no shadow, same as the episode details band) directly under the row; text 13; choices as a 28 px `v2/ToggleGroup` or 32 px `v2/Option row` instances; the action is a 28 px `v2/Button` on the row's Actions line, labelled with the outcome; a 13 px hint beside it. No 40 or 48 px control and no card surface inside a table, ever. Uses: grab choice (replace tracked version or keep as second version), remove from downloads, search sent / failed status, history event details, flagged row actions.
2. **Page panel.** Opens under a page header or hero, or holds its own rows: `v2/Panel/inline` (edge, no shadow), 40 px controls, one 48 px main action. Uses: pick a release, import by hand, change monitoring, pick a release from Flagged.
3. **Dialog.** Destructive or lossy confirmations leave the flow: `v2/Dialog` over `v2/Scrim`. Uses: delete a file or version, delete a title, replace the current file (the grab confirm step), discard unsaved edits.
The rule goes on the library (a note on `r7eDFX` beside the Panel/inline and Dialog sections) and later into DESIGN.md (wrap-up).

### Track 16: grab at row scale (releases.pen only; opus / high; after the pause, parallel with 13 and 15)
A. Marker proof; availability check must find `v2/Dialog` (`5:Oi69B`) by the depth walk under `5:r7eDFX`.
B. Rebuild the grab choice in `uKtnA` (Grab, already owned) and `Vs2IJ` (Pick a release, after Grab) to tier 1: remove the "Grab choice" block (`vUvzq`) and its footer; under the best row add an Actions line (horizontal, 40 high, padding [0,16] plus the row indent, gap 12, fill `$5:selected`): a `5:cofqY` ToggleGroup at 28 with two items "Replace tracked version" (selected) and "Keep as second version", a 28 px primary `5:ht3RN` "Grab" with the ↵ hint, and a 13 px `$5:muted-foreground` hint text that carries the consequence of the selected item (replace: "Replaces your 1080p file. The old torrent keeps seeding until Beyond-HD's rule is met."; second version: "Both files stay. media-manager-2 tracks the second one."). `Vs2IJ` keeps its grabbed state and toast; only the leftover choice block goes.
C. Rebuild `aoVjd` (Grab, confirm replace) as tier 3: the page as `uKtnA` with "Replace tracked version" selected, plus `5:y7vLCb` scrim over the whole frame and a centred `5:Oi69B` dialog in its default state with: Title "Replace the current file?", Subject "Severance S02E08 · 1080p WEB-DL · FLOS · 4.1 GB is replaced by the 2160p FLUX release. The old torrent keeps seeding.", Options off, Callout off, Cancel, Primary destructive 48 "Yes, replace the current file" (the verbatim label from `PickRelease.tsx:142-144`).
D. Rebuild `LHY6B` (Grab, grabbing) as tier 1: the Actions line with the Grab button in the loading look "Replacing…" (`PickRelease.tsx:143`) and the toggle group disabled.
E. Rebuild the storyboard `vJy0n` (Grab in row) so its stages show the Actions line pattern (toggle + Grab → loading → Grabbed badge and progress line).
F. The movie frame `GBCFs` and the other pick-a-release frames (`T3504v`, `J1CNDm`, `FElGl`, `k5nKR`, `uubLL`, `x6fPFV`, `r1BJU`, `xN9Vx`) do not change unless they contain the old choice block (check `r1BJU`, `xN9Vx`); if they do, remove it the same way.
G. Verification as every screen track; screenshots of every changed frame; clipping check; checklist with before/after notes.

### Track 17: remove from downloads at row scale (downloads.pen only; opus / medium; after the pause, after one of 13, 15, 16 reports so at most three writers run)
A. Marker proof; availability check.
B. Rebuild `XffKk` (Downloads, remove) and `HB6Vi` (Downloads, remove failed) to tier 1: remove the `5:cZb0Z` panel; under the Shōgun row's Actions line add a tinted band (`$5:muted`, square) holding: a 13 px line "Remove from downloads · the torrent keeps seeding in rTorrent", three `5:qq4VX` Option rows at 32 px (Blocklist only; Blocklist and search again, selected; Don't blocklist) with their one-line descriptions, and an action row with a 28 px primary "Remove and search again" (label follows the selected option: "Remove and blocklist" / "Remove and search again" / "Remove") plus a 28 px secondary "Cancel" (Esc). The failed frame adds the risk `5:BXgoa` callout at width 520 inside the band under the options. Rows below stay dimmed as before.
C. Rebuild the storyboard `oFqv5` (Remove panel open) to the band pattern (band height 0 → half → full).
D. `gMHUe`, `mrJgK`, `PXvyT` (Import by hand) stay tier 2 and do not change beyond the shadow loss from the library.
E. Verification as every screen track.

## Amendment 6: errors next to lime (critique of `r1BJU`, `xN9Vx`; orchestrator, 11 Oct)

Rule, joining the decision-scale rule: an error about one row shows as a `v2/Status/inline` failed line (12 px `alert-circle` in `$destructive`, 13/500 `$destructive` text) in a `$muted` band directly under that row (full table width, 32 high, square, no shadow, 1 px `$border` bottom edge, padding [0,16], content starting at the row's first cell x); an error or warning about the whole table shows as a one-line `v2/Callout` (Body off, Action off) above the table with a 16 px gap; a lime fill (`best`, `best-soft`, `live`) never touches a red or amber fill. The Actions line of a selected row keeps `$selected` (it belongs to the row); a decision or status band under it is `$muted`.

Library reload after Tracks 12 and 14 is confirmed: `5:Oi69B` v2/Dialog and `5:UMUhR` resolve from the screen files; `5:cZb0Z` has no shadow. Track 14 results: `Logo/Plex gold` `zYSrG`; `X2BYp` children: Product name `eWC0L` (off by default), Status `RreFa`, Heading `SKxTr`, Body 1 `BEk5a`, Body 2 `UfeJ0`, Buttons `Bs63D`, Primary `lmLf2` (icon `a0PNj` now the gold PNG, key hint `lmLf2/T1Pftv` on "↵", label `lmLf2/OXVvv`), Secondary 1 `f186pm`, Secondary 2 `pHS1b`, Attribution `Bq7tJ` (off by default; text "Plex and the Plex chevron are trademarks of Plex, Inc. media-manager-2 is not an official Plex product and is not endorsed by Plex."). States: initial, opening Plex `JYHn0`, pending, not configured.

Changes to earlier tracks:
- Track 16 B: the grab Actions line keeps `$selected` (it is the selected row's line); any band under it is `$muted`. Track 16 F is replaced: `r1BJU` (Grab, refused) → remove the lime-tinted "Grab outcome" frame `L52wTz` and its callout `tpUrL`; add the `$muted` band under the best row `QRhHI` with one `5:UMUhR` failed line, copy "Sonarr refused the grab: no indexer accepts this release right now"; no button; the row keeps `best-soft` and the best pill. `xN9Vx` (Grab, results out of date) → remove `F0lKcG` and `x2Z1v`; add a one-line warning `5:BXgoa` (title 14/600 "These results are out of date. Refresh and pick again.", Body off, Action off) above the table at x 60, y 344, 1320 wide, table header pushed down 16 px, exactly as `uubLL` does; the panel header's Refresh button is the action.
- Track 17 B: `HB6Vi` (remove failed) uses a `5:UMUhR` failed line "Sonarr did not remove it. Try again." beside the band's 28 px action, not a callout. `mrJgK` (Manual import, problem): move "Pick an episode for every ticked file." to a one-line risk callout above the import table inside the panel (Body off, Action off); the file row keeps its problem look.
- New **Track 18 (history.pen; opus / low; after a slot frees):** `ojlOR` (mark as failed, remove failed on) → the "Remove Failed" sentence becomes 13 px `$5:destructive` text inside the band under the panel's body, no callout. `W7DXL1` (Blocklist, unblock failed) → the callout becomes a `$muted` band under the returned The Bear row with a `5:UMUhR` failed line "Sonarr did not unblock it." Verification as every screen track.

### Track 15 phase 2 instructions (from Track 14), binding for sign-in.pen
1. App bar on all 15 sign-in frames: `5:F5qou` at the top, full width, with `5:OIwjX` (Search), `5:f6yp9` (Navigation) and `5:gaNhn` (Icon buttons) off; only the product name shows.
2. Move every block instance from x 96, y 306 to x 40, y 160.
3. Turn `5:Bq7tJ` (Attribution) on and position it bottom left: absolute, x 0 inside the block, y so its bottom sits 24 px above the frame's bottom edge (read its bounds to set y).
4. Chevron `5:a0PNj`: on for "Sign in" and "Signed out"; the spinner replacement stays on "Opening Plex"; off on every other frame.
5. Key hint `5:lmLf2/5:T1Pftv`: off on Loading…, Opening Plex…, Checking…, Cancelling…; on wherever the Primary is a working action.
6. Keep the heading, body and label overrides; keep `5:Bs63D` off on "not configured" and `5:RreFa` on for "Signed out". Drop any override of `5:eWC0L` or `5:lbIQG`.
7. `pDOyQ` and `PDZwf` (signed-in frames) do not change.
8. Storyboards `exGG2` and `exMjS`: rebuild their stages from the new block (position, app bar).
9. Code follow-up to note in the report: the ↵ hint assumes Enter triggers the Primary.
- Alec, during Track 16 (`uKtnA`): two Grab buttons on screen. Ruling from the code (`PickRelease.tsx:494-501`): the row's Override and Grab show only while the row is selected and no panel is open; opening the decision hides them. On every frame with the decision line open, the row's Actions cell shows only the score; the decision line's single action is labelled with the outcome ("Grab as replacement" / "Grab as second version", ↵) with a ghost 28 px "Cancel" (Esc) beside it. Same rule for any future row-opened decision: the opener's buttons leave while its decision is open.

## Amendment 7: remove from downloads is a dialog (Alec, 11 Oct)

Rule addition to tier 3: taking something out of a list or the library (remove from downloads, unblock with no undo, delete) is a dialog even when the torrent keeps seeding. Tier 1 keeps the grab choice, inline status, history details and flagged row actions.

Track 17 is replaced by **Track 17b (downloads.pen; opus / medium):** `XffKk` (Downloads, remove) and `HB6Vi` (Downloads, remove failed) become dialogs. The page under the scrim is the Downloads screen with the Shōgun row selected and its Actions line showing its two buttons (nothing is "open" in the table). Scrim `5:y7vLCb` over the full 1440×900; `5:Oi69B` centred. Content: Title "Remove from downloads?"; Subject "Shōgun S01E05 · 2160p WEB-DL · NTb · 8.9 GB · seeding on PrivateHD. The torrent keeps seeding in rTorrent; media-manager-2 never removes a torrent from here."; Options: three stacked `v2/Card/choice` at width 512 (add a third by copying the second inside the Options frame): "Blocklist only" (key 1), "Blocklist and search again" (key 2, selected), "Don't blocklist" (key 3), each with its one-line description from `Downloads.tsx:9-13` or the Track 2 wording; Callout off; Cancel 40; Primary destructive 48 labelled with the outcome of the selected option ("Remove and search again"), ↵ hint. Remove failed: same dialog with the Callout slot on in the risk look, "Sonarr did not remove it. Try again." Storyboard `oFqv5` becomes "Remove dialog open" (before: row selected with its Actions line; mid: scrim and dialog at 0.5; after: full), stage height 420. `mrJgK` change from Amendment 6 (message above the import table) stands; `gMHUe`, `PXvyT` stay panels. Verification as every screen track.

## Amendment 8: grab on an owned title opens the dialog (Alec, 11 Oct)

Rule: the grab choice on an already-owned title (replace or second version) is tier 3; clicking the row's Grab opens `v2/Dialog` over the scrim, and the dialog is the confirmation (no separate "yes, replace" step). Tier 1 keeps inline status, history details and flagged row actions. Track 16 steps B to E are replaced:

- `uKtnA` (Grab, already owned): page = `UourQ`'s state with the best row selected and its Override and Grab buttons visible (the click just happened); no Actions line under it; scrim `5:y7vLCb` full frame; `5:Oi69B` centred: Title "This is already in your library"; Subject "Severance S02E08 · your 1080p WEB-DL · FLOS · 4.1 GB. The current file's torrent keeps seeding either way." (sentence from `PickRelease.tsx:134`); Options: card 1 "Replace tracked version" selected, description "The new release becomes the tracked file, even at lower quality, and is kept from automatic upgrades." (`PickRelease.tsx:146-148`); card 2 "Keep as second version", description "Keeps both files side by side in Plex."; Callout off; Cancel 40 (Esc); Primary destructive 48 "Grab and replace the current file" (↵).
- `aoVjd` (rename to "Grab, as second version"): same dialog with card 2 selected; Primary becomes the black primary look, 48, "Grab as second version".
- `LHY6B` (Grab, grabbing): the replace dialog with the Primary in the loading look "Replacing…" (`PickRelease.tsx:143`), both cards in the disabled look, Cancel disabled.
- `Vs2IJ` (after Grab): unchanged, the dialog has closed and the row shows Grabbed.
- Storyboard `vJy0n` becomes "v2 / Motion / Grab dialog open": three stages side by side at 440 (before: row selected with Override and Grab; mid: scrim and a 436-wide dialog stand-in at 0.5; after: full), stage height 420, as the delete-dialog storyboard `FVDOo` in title.pen does. The Grab → Grabbed badge crossfade moves into the after stage's caption.
- `r1BJU` and `xN9Vx` keep Amendment 6 (status line under the row; warning callout above the table).
- Any Actions line or choice block built under the best row in these frames is removed.
- Alec, after Track 16: the replace dialog's primary is the black primary, not destructive. Rule: destructive red is for deleting or removing (files, versions, titles, downloads, discarding edits); replacing a file and grabbing are black actions. Applied to `uKtnA`, `LHY6B` and the `vJy0n` storyboard.
