# Work order: critique follow-up

The 26 static screens will keep their dense, dark design while correcting misleading instructions, text contrast, the episode-release count, phone control sizes, and missing component-state examples. The existing galleries will contain all component examples. DESIGN.md and its sidecar will describe the resulting prototype accurately.

## OPEN QUESTIONS — needs confirmation

None. The owner has authorized the follow-up work. The episode table contains seven visible releases and two hidden BLU releases; their hidden qualities are unspecified. Show nine total and omit the unsupported quality counts.

## Execution plan

Use one serial executor in:

`/Users/alechenderson/Projects/media-manager-2/.claude/worktrees/codex-design-finish`

Expected starting commit: `180a9db`.

- **Executor:** `gpt-6.1-sol`, **high** effort. Shared components affect 26 screens; instance overrides and phone geometry require careful verification.
- **Ownership:** `design/mediaManager2.pen`, `DESIGN.md`, `.impeccable/design.json`, the two new Markdown files named below, and `docs/design/critiques/2026-10-08-follow-up-work-order.md`.
- **Fresh reviewer:** `gpt-6-astra`, **high** effort. Review the combined result independently against this order and the preserved owner decisions.
- **recommended_execution:** `agents`. All design edits touch one Pen file, so additional design executors cannot run concurrently.
- **Critical path:** baseline → design changes → documentation → combined verification → independent review.
- **Contended file:** `design/mediaManager2.pen`. Never give it to concurrent editors.

The model choices follow the owner’s explicit Astra/Sol override of the skill’s Fable/Opus defaults.

## Executor rules

1. Read the nearest `AGENTS.md` before editing each folder.
2. Read Impeccable’s `reference/craft-floor.md` immediately before design edits. Apply the already scoped audit, typeset, colorize, clarify, adapt, harden, distill, and polish findings below.
3. Read Pen’s `execute.md`, `pen-schema.md`, and `guide/components.md` through `mcp__pencil__read_skill`.
4. Access `.pen` content exclusively through Pen tools. Never read, parse, search, hash, serialize, or write it through filesystem tools, scripts, Git content commands, or Impeccable fingerprint helpers.
5. Pass the complete target path to every Pen call. The active editor belongs to another task; do not switch it.
6. Do not commit, push, create another pull request, merge, export designs, start a server, or add application code.
7. You are not alone in the workspace. Preserve other work. If the target state differs from this order, report the concrete difference.
8. Set `placeholder:true` while modifying each root frame; clear it when that frame is complete.
9. Use existing components. Preserve instance overrides. Expanded instance paths are valid update targets; ordinary parent/child paths are not.
10. After an execute failure, patch that call using its `editId` and `edits`. Do not resend the snippet.
11. No speculative cleanup or added features. Do not change release data, tracker rules, destructive defaults, selection, or product terminology beyond the exact instructions below.
12. Screenshots establish static appearance only. Do not claim working keyboard, touch, screen-reader, or backend behavior.

## Grounding

- `PRODUCT.md:17`: desktop use and quick phone grabs.
- `PRODUCT.md:40`: first-version capabilities.
- `PRODUCT.md:55` and `CONTEXT.md:31`: “release” means a torrent.
- `DESIGN.md:46`: 26 static screens; framework behavior remains unimplemented.
- `DESIGN.md:50`: palette roles.
- `DESIGN.md:52`: purple for one best passing release; red for risks.
- `DESIGN.md:60`: frame sizes and existing bar dimensions.
- `DESIGN.md:62`: selected-row actions and one focused decision.
- `.impeccable/surfaces/design-mediamanager2-pen.md:12`: routine states stay quiet.
- `docs/design/critiques/README.md:3`: historical critique archive.
- `scripts/build.sh:8`, `scripts/test.sh:17`, `scripts/test.sh:20`: build and test commands are unconfigured placeholders.

Pen anchors below were read directly through MCP. Pen content has node IDs rather than filesystem line anchors.

## Tasks and numbered steps

### D1 · Correct the static design

**Files:** `design/mediaManager2.pen`, MCP nodes below.  
**kind:** `new-code` task category; the deliverable is static design, with no application code.  
**depends_on:** none.  
**recommended_model:** `gpt-6.1-sol`; shared components, expanded instances, and phone layout require reliable multi-step edits.  
**recommended_effort:** high; preserve 26 screens and distinguish enabled content from deliberately dim surroundings.  
**verify:** steps 11–12.

**1. Record the baseline through MCP.**

Read the root frames, reusable component IDs, reference targets, and existing clipping reports. Keep the results in the executor report.

Expected screens:

```js
const screens = [
  "GYT2F","pWgUy","BxurY","fSkBY","zWW5R","L7crsL","GOM8w",
  "EYHjp","imWFw","dIXwk","vIwpS","iAVnz","TrXNw","R1GOrH",
  "GTb4E","J1uFA4","rSYPn","oeZxo","Ulb14","fs0ud","XX6W9",
  "d6TYkb","g20KL","c9Z57","D1bufZ","S8S9Ex"
];
for (const id of screens) {
  Print(Get(id,(n,c)=>c.depth===0
    ? {id:n.id,name:n.name,bounds:c.bounds}
    : undefined));
}
Print(Get(n=>n.reusable ? {id:n.id,name:n.name} : undefined));
Print(Get((n,c)=>c.depth===0&&n.type==="ref"
  ? {id:n.id,ref:n.ref,name:n.name}
  : undefined));
```

Expected: 25 desktop frames at 1440×900, one phone at 390×844, 29 reusable components, three existing galleries, and 12 unnamed top-level references.

Record the owner decisions listed under “Preserved decisions” before edits.

**2. Correct enabled secondary text and semantic colors.**

Keep font families, sizes, weights, spacing, graphite surfaces, seams, and decorative strokes.

- Change enabled text using `$ink-3` to `$ink-2`.
- Apply shared-source changes where the shared text is responsible; update explicit instance overrides where necessary.
- Leave deliberate disabled/dim opacity in place. Do not brighten those frames to satisfy contrast.
- Do not globally change `ink-3`: it still serves borders and decoration.
- Include table headings, compact detail-panel headings, key-help labels, and live-download secondary text.
- Shared live-download nodes `XPZd4` and `kxzox` must use `$ink-2`.
- Include the nine detail headings under `c9Z57`/`hxdC9`, including `GF0CE`, `ccphC`, and `Tudhu`.

Update only these existing semantic color values:

```js
SetVariables({
  best:{type:"color",value:"#B46AF5"},
  risk:{type:"color",value:"#FF534A"}
});
```

These values were calculated against the actual palette:

| Pair | Contrast |
|---|---:|
| `#B46AF5` / `#22262E` | 4.565:1 |
| `#B46AF5` / `#15171C` | 5.397:1 |
| `#0E0F12` / `#B46AF5` | 5.769:1 |
| `#FF534A` / `#22262E` | 4.758:1 |
| `#9AA1AB` / `#22262E` | 5.821:1 |

This fixes phone `L4opfG` and `XZle3`, filled best-quality cells such as `ovLlZ`, `cng1E`, and `x7W2Ji`, and risk text such as `AmAQb`, `qilwM`, `PhzrS`, and `k1aYQV`.

For selected torrent-choice segments:

- Shared `ENvI1` fill becomes `$ink-2`; its label `z9yeF` becomes `$on-cell`.
- Check `ylOra/ENvI1` and `ylOra/z9yeF`; correct explicit overrides to the same values.
- Instance `eE3zZ/yLgYL` fill becomes `$ink-2`; `eE3zZ/ntEvP` becomes `$on-cell`.
- Preserve which segment is selected.

Do not add green or yellow fills. Do not assign purple to additional release rows.

**3. Correct exact copy and counts.**

Use these replacements:

| Node | Replacement |
|---|---|
| `SYjlq` | `Free space, then imports resume on their own.` |
| `ArlNQ` | `Sonarr could not identify the episodes for 2 of the 10 files, so it imported none of them.` |
| `qHYpY` | `All 9` |
| `Bv12V` | `2160p` |
| `A16sya` | `1080p` |
| `EjYOZ` | `720p` |
| `ebqBJ` | `All WEB-DL · results from 14 min ago · refresh Shift R (about 20s) · season packs P` |

Preserve `cqGFc` as `2 more on BLU:` and the seven visible rows `IVllu`, `eIhGg`, `XQ0CN`, `R59w1u`, `gISiu`, `WGr1m`, `WV4ph`.

Their represented qualities are four 2160p, two 1080p, and one 720p. The two hidden BLU qualities are unknown. Do not invent them.

Read movie refresh hints `Ogx4A` and `SBxUv`; preserve their existing Shift R convention. Correct any other **fresh-search** hint using plain R, without changing Replace shortcuts or adding a help overlay.

**4. Remove the three identified routine-state annotations.**

- `KtiEM`: replace `Downloaded · upgrade wanted` with `Below cutoff`.
  - Supporting nodes already show `WooAV` = `below cutoff`, an owned 1080p file, and `X9xBJJ` explaining the 2160p BluRay profile.
- `ARdi0/GxiPC`: replace `Season 3  not aired` with `Season 3`.
- `P1IGQR`: replace with `2021 · 2h 35m · Movie · Radarr · Minimum availability: Released`.

Preserve monitoring controls and all unusual-state explanations.

**5. Give phone controls adequate bounds and add Close.**

Only phone components and their gallery sources change. Desktop dimensions remain untouched.

- Shared navigation `MUNOv`: height 44, padding `[0,12]`, gap 10, vertically centered.
- Override `GD708` to the same height and padding so its old overrides cannot retain the 40px layout.
- Wrap source icons `y9EUe` and `ILsoH` in separate 44×44 transparent frames, centered.
- Preserve the icon dimensions at 20×20 and 18×18 and preserve their identities.
- Give the title the remaining width.

For refresh:

- `hWOKV`: height 44, padding `[0,12]`, vertically centered.
- `YhRfR`: width 80, height 44, centered contents.
- Preserve the dimmed state while the sheet is open.

For filters:

- `C6EVy`: height 60, padding `[8,12]`, existing gap 6.
- `ju8Qg`, `feWAu`, `EKDpm`, `vH9zC`: height 44, centered contents. Set `ju8Qg` width 44. Preserve the other three widths; preserve all four labels, selection, fills, and dimmed state. These are the movie filters; do not apply the episode-count changes to them.

For the sheet:

- Add a ghost Close control to `O8ptOh`, after the existing best mark.
- Use a named 44×44 transparent frame with centered text `Close`, Barlow 13, weight 600, `$ink`.
- Set the header height to at least 44; let `Aoqwm` use remaining width.
- Preserve both 48px commitment buttons `D55zT1` and `aYv33`.
- Preserve full release name, detail values, replace/second-version choice, and one focused decision.

For the live-download control:

- Keep `k6xD1` visibly 32px high.
- Put it inside a new 44px-high, full-width transparent frame with padding `[12,0,0,0]`.
- Place that frame at the end of the phone’s normal vertical layout, after the existing spacer.
- Keep the visible bar at y=812–844; its containing control frame occupies y=800–844.
- Position the absolute sheet so its bottom is y=800. After layout settles, set its y to `800 - resolved sheet height`.
- No overlap between the sheet and the 44px live-download control.

The screen remains 390×844. The existing seven 58px release rows remain. Resize only the flexible spacer as necessary. The sheet continues to cover the background release list intentionally.

**6. Add only the missing component states used by this prototype.**

Keep the existing 29 reusable families and their defaults. New state examples are instances, not additional reusable families.

In `bi8Au`:

- Add a named example section at x=24, y=800, width=1352.
- Increase gallery height to 1160.
- Show focus and disabled examples for `i1ciSB`, `OtgnD`, `QUIMh`, and `YxJcD`.
- Use two horizontal rows: focus examples, then disabled examples.
- Label each example with its existing component name plus `focus` or `disabled`.
- Focus appearance: a transparent square wrapper with a 2px `$ink-2` stroke and 4px padding around the unchanged component.
- Disabled appearance: an instance at opacity 0.35, with a normal-opacity explanatory label outside it.
- Search stays 420px wide; retain the existing button widths.

In `NPTcm`, append a named section after `mPtT9`, within the existing 1400×1800 gallery:

- Checkbox unchecked: `x96xJ`, override `i0mNr6.enabled=false`.
- Checkbox mixed: `x96xJ`, override its indicator to width 6, height 2, enabled.
- Radio unselected: `jW1po`, override `KrpyT.enabled=false`.
- Switch off: `eUx2Z`, transparent fill, `$ink-2` stroke 1; `SCl9F` reads `OFF`, fill `$ink-2`.
- Focus and disabled examples for `dOT87` and `n78nTm`, using the same wrapper/opacity convention.
- One labelled expanded disclosure instance: `GrI8m.icon="chevron-up"`.
- Keep existing selected/on/default examples.

Use compact horizontal groups with labels. Do not add loading, error, permission, or empty-state catalogues unrelated to these findings.

**7. Move and name the 12 real top-level examples.**

These are confirmed ordinary root references, with no per-instance content overrides. Preserve them; do not delete.

Move eight `gndqp` references into a named vertical example section in `p9EDhk`:

`HP3XQ`, `z6YgbH`, `C7xuB`, `vWNIP`, `XhGPE`, `FzvxI`, `CJqFY`, `YoFRa`.

Name them `Badge/Status example 1` through `Badge/Status example 8`. Their content stays unchanged.

Move:

- `l2eYw` into the shared-controls example section; name `Button/ghost example`.
- `tp8sC` there; name `Button/Keyboard shortcuts example`.
- `obiKm` there; name `Button/default example`.
- `b9fQ47` into the selection gallery’s example section; name `Switch/Monitored example`.

Place the three shared-controls references in one additional horizontal row beneath the state examples. Increase `bi8Au` only as far as needed, staying entirely above the screens at y=0. Preserve gallery x/y positions and avoid overlap with neighboring galleries.

**8. Complete one bounded visual pass.**

Capture the changed phone, shared galleries, and representative screens in batches. Inspect:

- `fSkBY`
- `GYT2F`, `BxurY`
- `R1GOrH`, `TrXNw`
- `zWW5R`, `L7crsL`, `d6TYkb`
- `c9Z57`, `oeZxo`
- `bi8Au`, `p9EDhk`, `NPTcm`

Fix all concrete defects from this pass in one batch. Permit one confirmation screenshot round. Do not begin another general critique.

### D2 · Record the result and synchronize design documentation

**Files:** `DESIGN.md:50`, `DESIGN.md:60`, `.impeccable/design.json`, new `docs/design/critiques/2026-10-08-follow-up.md`, new `docs/design/critiques/2026-10-08-follow-up-verification.md`, new `docs/design/critiques/2026-10-08-follow-up-work-order.md`.  
**kind:** docs.  
**depends_on:** D1.  
**recommended_model:** `gpt-5.6-terra`, low effort would suffice independently; retain the same Sol executor to avoid another handoff for these narrow edits.  
**recommended_effort:** low; update known values and record actual evidence.  
**verify:** JSON parsing, diff checks, and comparison against MCP results.

**9. Synchronize the existing documentation.**

In DESIGN.md:

- Set `best` to `#B46AF5` and `risk` to `#FF534A`.
- Describe `ink-2` as readable secondary text and `ink-3` as muted borders, decoration, and disabled treatment.
- State that the phone top bar is 44px.
- Keep visible live-download bars at 32px and document the phone’s 44px containing control.
- Add one short sentence that galleries show the listed static focus, disabled, selection, and off states.
- Retain the statement that runtime behavior and accessibility are not implemented or proven.

In `.impeccable/design.json`:

- Change the live-bar sample’s `.ds-live-items, .ds-live-expand` text color from `#69707B` to `#9AA1AB`.
- Synchronize any prose or exact values affected by these changes.
- Do not expand the sidecar into an application or rebuild unrelated samples.
- Leave border colors unchanged.

No AGENTS.md, registry, dependency, or migration change is needed.

**10. Persist the critique and verification honestly.**

The orchestrator supplies the already delivered critique report and reviewer provenance.

- Archive it in `2026-10-08-follow-up.md`.
- Identify it as the pre-fix critique, score 29/40.
- Preserve the reported assessment provenance and detector limitations.
- Do not rerun the detector.
- Do not invoke critique-storage commands on the `.pen` path: their local-file fingerprint behavior would violate the MCP-only access rule.
- Explain this storage exception in one sentence.
- End the archived critique with: `Questions skipped: the owner requested immediate execution of all relevant follow-ups.`

Write `2026-10-08-follow-up-verification.md` with the numbered-step results, MCP verification output, screenshot node IDs, and remaining limitations.

Do not award a new heuristic score without a new independent scored assessment.

### V1 · Verify the combined result

**Files:** all changed files; design content through MCP only.  
**kind:** test.  
**depends_on:** D1, D2.  
**recommended_model:** same Sol executor; fresh Astra reviewer follows.  
**recommended_effort:** high for the design verification; the distinction between inherited and overridden component values affects correctness.  
**verify:** paste actual outputs from the following checks.

**11. Run structural, content, reference, and contrast checks.**

Run in the worktree:

```bash
git status --short
git diff --check
git diff --stat
python3 -m json.tool .impeccable/design.json >/dev/null
```

Do not read the Pen diff contents.

Do not report a build or test pass. The repository’s scripts contain no real build/test commands, so there is no headless suite to send to the second Mac.

Run this MCP screen and reference check:

```js
const screens = [
  "GYT2F","pWgUy","BxurY","fSkBY","zWW5R","L7crsL","GOM8w",
  "EYHjp","imWFw","dIXwk","vIwpS","iAVnz","TrXNw","R1GOrH",
  "GTb4E","J1uFA4","rSYPn","oeZxo","Ulb14","fs0ud","XX6W9",
  "d6TYkb","g20KL","c9Z57","D1bufZ","S8S9Ex"
];
const failures=[];
for(const id of screens){
  Get(id,(n,c)=>{
    if(c.depth!==0)return;
    const w=id==="fSkBY"?390:1440;
    const h=id==="fSkBY"?844:900;
    if(Math.abs(c.bounds.width-w)>.01||
       Math.abs(c.bounds.height-h)>.01) failures.push({id,b:c.bounds});
  });
}
const refs=Get(n=>n.type==="ref"?{id:n.id,ref:n.ref}:undefined);
for(const r of refs){
  try{
    const target=Get(r.ref,{depth:0});
    if(!target)failures.push(r);
  }catch(e){failures.push(r);}
}
Print("screen or reference failures",failures);
Print("reusable count",Get(n=>n.reusable?n.id:undefined).length);
Print("root references",Get((n,c)=>c.depth===0&&n.type==="ref"?n.id:undefined));
Print("placeholders",Get(n=>n.placeholder?n.id:undefined));
```

Expected: no failures, 29 reusable components, no root references, no placeholders.

Check exact copy:

```js
const expected={
  SYjlq:"Free space, then imports resume on their own.",
  ArlNQ:"Sonarr could not identify the episodes for 2 of the 10 files, so it imported none of them.",
  qHYpY:"All 9",
  Bv12V:"2160p",
  A16sya:"1080p",
  EjYOZ:"720p",
  cqGFc:"2 more on BLU:",
  ebqBJ:"All WEB-DL · results from 14 min ago · refresh Shift R (about 20s) · season packs P",
  KtiEM:"Below cutoff",
  "ARdi0/GxiPC":"Season 3",
  P1IGQR:"2021 · 2h 35m · Movie · Radarr · Minimum availability: Released",
  GiQ6o:"your 1080p goes to Sonarr's recycle bin; its torrent keeps seeding on BHD"
};
Print("copy failures",Object.entries(expected).flatMap(([id,content])=>{
  const n=Get(id,{resolveInstances:true});
  return n.content===content?[]:[{id,expected:content,actual:n.content}];
}));
```

Check clipping on all 26 screens and all three galleries using:

```js
for(const id of screens.concat(["bi8Au","p9EDhk","NPTcm"])){
  Print(id,Get(id,(n,c)=>c.problems
    ? {id:n.id,name:n.name,problem:c.problems,parent:c.parentCtx?.node.id}
    : undefined,{resolveInstances:true}));
}
```

Compare against the baseline. Fix newly introduced clipping. Do not treat intentional sheet coverage as clipping or silently repair unrelated pre-existing geometry.

Use the following numerical contrast calculation with `resolveVariables:true` reads:

```js
const L=h=>h.match(/[a-f\d]{2}/gi).slice(0,3)
  .map(x=>parseInt(x,16)/255)
  .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4)
  .reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
const C=(a,b)=>(Math.max(L(a),L(b))+.05)/
                    (Math.min(L(a),L(b))+.05);
const v=GetVariables().variables;
for(const [a,b] of [
  ["ink-2","ground"],["ink-2","row"],["ink-2","row-alt"],
  ["ink-2","row-hover"],["best","row-hover"],["on-cell","best"],
  ["risk","row-hover"],["on-cell","ink-2"]
]) Print(a,b,C(v[a].value,v[b].value));
```

Also enumerate actual enabled, undimmed text:

- Traverse with `resolveInstances:true` and `resolveVariables:true`.
- Skip subtrees with `enabled:false` or opacity below 1; retain their IDs as intentional exceptions.
- For each visible text node, find its nearest opaque solid background through `parentCtx`.
- Calculate the actual pair; report any ratio below 4.5.
- If a pair cannot be determined from a solid fill, report it for visual inspection rather than inventing a background.
- Verify all reported critique nodes, including the selected torrent segments.
- Do not count hidden component descendants or deliberate inactive surroundings as ordinary text failures.

Record resolved phone bounds for every target created in step 5. Check width and height ≥44 for Back, Search, refresh, four filters, Close, and the live-download containing frame. Both commitment buttons stay ≥48 high. Check sibling bounds for overlap.

**12. Verify preserved decisions and request independent review.**

Through MCP, compare the following against the recorded baseline:

- `iAVnz` still selects episodes 3–6 only.
- `EGBx5` and `ZsVWw` remain `$ground` with a `$seam` bottom border.
- `GOM8w` keeps newest-added ordering.
- `imWFw` has no snooze action.
- `VUL1M/KrpyT` and `b1CKC/KrpyT` remain enabled, preserving Remove from Radarr selection.
- `eINdH/KrpyT` remains enabled; `N7mCCS/KrpyT` remains disabled.
- `GiQ6o` keeps its exact Sonarr recycle-bin and continued-seeding copy and `$ink-2`.
- Every screen retains its one-line live-download bar.
- Release tables keep purple on only the best passing release.
- No green/yellow comparisons, shadows, new cards, rounded button styling, or additional simultaneous decisions appear.
- The manual-import state still contains one corrected assignment and one unset assignment.
- Root screen IDs, dimensions, and count remain unchanged.

The executor returns:

1. Steps completed.
2. Actual verification output.
3. Screenshots inspected and any confirmation captures.
4. Saved-file status, distinguishing MCP state from native disk save.
5. Any unresolved discrepancy.

The parent performs native save when that editor becomes available, then confirms the saved-file status without parsing the Pen file.

A fresh reviewer must inspect the final MCP state, the screenshots, the documentation changes, and this checklist. The reviewer must report concrete defects by node ID. Static screenshots do not prove interactions.

## Test, documentation, and registry impact

No application tests, runtime dependencies, server, registry, or migration changes.

Verification consists of MCP structure/content/contrast checks, phone geometry, visual inspection, JSON parsing, and Git whitespace checks. Existing build/test placeholders are not evidence of a pass.

## Execution risks

- Explicit instance overrides can conceal a shared-source fix; inspect resolved instances.
- Hidden descendants contain stock component text; exclude disabled branches from assertions.
- A sheet can fit the screen while overlapping its controls; verify resolved bounds.
- Native persistence may lag MCP edits while another design is active; report these states separately.
- The historical critique files describe earlier design states; preserve their contents and append this run as new files.
