# Critique: Desktop / Health (imWFw)

Assessment A, design review, from the 1440x900 screenshot.

## Design-specificity verdict

Specific to this product. The rows name real trackers, real paths (/home/alec/files/radarr), real tracker rules (3 of 5 hit and run allowed, 72h seeding) and real job timers. Nobody could move this screen to another app unchanged. The weakness is restraint: every block is rendered at the same weight, so the screen reads as a full status dump. On a normal evening it should read as a short to-do list.

## Nielsen heuristics

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | "checked 2 min ago", per-job last run and live speeds are all shown. Too much status, so nothing stands out as the answer. |
| 2 | Match with the real world | 3 | Uses Sonarr and Radarr wording. "RISK" is not in CONTEXT.md and its rank against ERROR is not explained. |
| 3 | User control and freedom | 2 | The only actions are Test and Docs/Wiki. The "remote path mapping" and "disk 91% full" rows offer no way to fix or snooze them. |
| 4 | Consistency and standards | 2 | RISK is a solid red fill. ERROR and WARNING are identical outlined boxes, so an error looks milder than a risk and the same as a warning. |
| 5 | Error prevention | 3 | Blutopia cooldown and the hit and run count are flagged before the tracker penalises. |
| 6 | Recognition over recall | 3 | Each problem is labelled by source. Key hints show on the first row only, so the reader has to guess they apply to every row. |
| 7 | Flexibility and efficiency | 3 | F, R, W and T shortcuts. Fine for the power user, noise for everyone else. |
| 8 | Aesthetic and minimalist design | 1 | Five blocks at equal weight. Three problems are shown twice. Four "all fine" tables take more than half the screen. A downloads dock that has nothing to do with health. |
| 9 | Help users recover from errors | 2 | Messages describe the fault ("folder Radarr cannot see") but not the fix or where to make it. |
| 10 | Help and documentation | 3 | Wiki or Docs link on every row. |
| | **Total** | **25/40** | Acceptable. Solid content, weak hierarchy. |

## Cognitive load

Failed items (5 of 8, high load):
- Single focus: problems, services, tracker accounts, housekeeping and live downloads all compete. The downloads dock is a second task on a monitoring screen.
- Visual hierarchy: the problems list is the answer, but the services and housekeeping tables below it have the same row height, type size and contrast.
- Chunking: about 30 rows of data in view (6 problems, 4 services, 3 trackers, 2 disks, 1 backup, 5 jobs, 3 downloads).
- Progressive disclosure: services that are fine and jobs that ran fine are fully expanded. The subtitle already says "4 services reachable".
- Minimal choices: the top bar has 5 nav items, search, speeds and a red badge. The header has 2 actions. Every problem row has 2 more.

Decision points with more than 4 visible options:
- Top bar: Search, Downloads, Calendar, Flagged, Health, the search field, and the speed readout (7).
- Problems list: 6 rows times 2 actions = 12 buttons, plus Filter by source and Run all checks.

## Strengths

- One merged problem list, worst first, labelled by source. This matches the owner's decision and answers "is anything wrong?" in the first row.
- Problem text is concrete and plain: "Whatbox drive /home is 91% full · 180 GB free of 2.0 TB".
- The tracker accounts table puts the cause of the two risks (Beyond-HD hit and run, Blutopia cooldown) next to the rules, which nothing in Sonarr or Radarr shows.

## Priority issues

**P1. Three problems appear twice, and red is spent five times on two facts.**
- What: Blutopia cooldown is row 1 of the problem list and a red "DOWNLOADS BLOCKED" chip in tracker accounts. The Beyond-HD hit and run count is row 2 and a red "ROSE BY 1 TODAY" chip. /home at 91% is row 5 and a bar in housekeeping. Add the top bar "2 RISKS" badge and the two RISK chips: five red fills for two problems.
- Why: repeated alarms read as more alarms. The eye cannot tell whether there are 2 problems or 5.
- Fix: keep red only in the problem list (and the top bar badge). In tracker accounts and disk rows, show the value in normal text with a small marker linking back to the problem row, no fill.
- Command: `/impeccable distill`, then `/impeccable colorize`.

**P1. Healthy things take most of the screen.**
- What: services (4 rows, all reachable), background jobs (5 rows, all "ok" or harmless), backup (fine) fill about 60% of the area below the problem list.
- Why: the owner on a normal evening needs "what's broken and what do I do". Everything fine should cost one line.
- Fix: collapse each healthy block to a single summary line ("Services: 4 reachable, 2 updates available", "Background jobs: 5 ran on time", "Backup: 3h ago, next in 20h") that expands on click. Auto-expand a block only when it holds a problem. Keep tracker accounts and disk open because they show limits, not just "ok".
- Command: `/impeccable distill`.

**P1. Remove the live downloads dock from this screen.**
- What: 3 download rows docked at the bottom, with bars, speeds, seeders and tracker codes.
- Why: nothing to do with health, and the speeds already sit in the top bar. It pushes the screen's purpose down and adds a third set of moving numbers.
- Fix: drop the dock on Health. If a download is stalled, it becomes a problem row instead. Same question applies to every non-Downloads screen.
- Command: `/impeccable distill`.

**P2. Severity labels do not rank visually.**
- What: RISK is solid red. ERROR and WARNING are the same outlined box.
- Why: an error from Sonarr (indexer down 6 hours) looks no worse than a warning, and the reader has to read the word. "RISK" is not defined in CONTEXT.md, so its place above ERROR is a guess.
- Fix: three clear steps of weight (filled, tinted, outline) in the order the list sorts by. Define "risk" in CONTEXT.md (a tracker penalty is close, not a fault in a service).
- Command: `/impeccable clarify`, then `/impeccable colorize`.

**P2. Problem rows have the wrong actions.**
- What: every row offers Docs/Wiki and Test, repeated 6 times, with W and T hints on row 1 only.
- Why: Test does not fix "disk 91% full" or "remote path mapping wrong". The useful next step (open the Sonarr setting, see which torrents are short of seeding, clean up /home) is missing, while the same two links repeat down the column.
- Fix: show actions on row hover or focus only, and give each row one specific fix action where one exists ("Show 2 torrents", "Open remote path mappings"). Keep Docs as an icon. Move the W/T hints to a single keyboard help sheet.
- Command: `/impeccable clarify`.

## Persona red flags

- Alex (power user): fine with density, but the duplicates cost scanning time and there is no way to snooze or acknowledge a known warning (Trakt list failures will sit there forever).
- Sam (accessibility): grey secondary text ("update 4.0.21 available", "minimum 1.0", section subtitles) looks below 4.5:1 contrast on the dark ground. Small capitals section labels in grey are hard to read. Hover-only actions (if adopted) must also appear on keyboard focus.
- Owner on a normal evening: opens Health because the top bar says "2 RISKS". Gets the answer in row 1, then has to scroll past 30 rows of "fine" to confirm nothing else matters, and is distracted by moving download bars.

## Minor observations

- Header says "6 problems · 2 risks", and the list says "PROBLEMS 6" with the 2 risks inside it. Reads as 8. Say "6 problems, 2 of them risks" or count them separately.
- Large empty area under tracker accounts on the left while the right column runs long. The two columns are unbalanced.
- Housekeeping mixes disk, backup and job timers under one label with three grey subheadings.
- "Filter by source" is of little use with 6 rows. Hide it until the list is longer than a screen.
- Top bar "rTorrent · 3s ago" next to speeds is extra chrome on every screen.

## Questions

1. If the problem list is empty, should Health show anything else by default, or is "Nothing needs you. Last checked 2 min ago" plus the collapsed summaries enough?
2. Does the owner want to acknowledge or snooze a warning, so long-running known issues (Trakt list) stop counting in the badge?
3. Should tracker accounts live on Health at all, or only appear here when a tracker is near a limit?
