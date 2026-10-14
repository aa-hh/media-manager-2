# Plex playback features for the desktop player

Researched 14 Oct 2026. Builds on [README.md](README.md) (Decision section), [media-servers.md](media-servers.md) (Plex section) and [player-stack.md](player-stack.md); it does not repeat them. The player is the Electron app playing the original file in mpv, with the "one panel" design (a quiet control bar plus a "Picture and sound" side panel).

How the facts were checked:
- **Checked on the slot**: read-only GET requests to the slot's Plex (1.43.2.10687, API version 1.2.2) and a copy of Plex's own database, run over `ssh shenzhou` on 14 Oct 2026 between 02:50 and 03:00 UTC. Nothing was changed, no playback, no play queue, no task started. The copies were deleted afterwards.
- **Spec**: the official reference at [developer.plex.tv/pms](https://developer.plex.tv/pms/), API 1.2.3.
- **Plex Web**: Plex's own web app, version 4.162.1, read from its JavaScript at app.plex.tv on 14 Oct 2026. Minified code, so names of internal functions are not quoted.
- **Unverified** marks anything not confirmed by one of those or by a named source.

Words used below:
- **Marker**: a time range Plex stores for a file, such as "intro from 3:54 to 5:27". Times are in milliseconds.
- **Play queue**: Plex's server-side list of what plays next.
- **Timeline call**: `POST /:/timeline`, the progress report a player sends every 10 seconds and on every play, pause or seek.
- **mpv JSON IPC**: mpv's documented way for another program to control it over a socket (`--input-ipc-server`). The app sends commands such as `seek` and listens for property changes such as `time-pos` (the playing position in seconds).
- **BIF file**: a single file holding many small preview pictures from a video, one every few seconds. Roku designed the format ([Roku BIF spec](https://developer.roku.com/docs/developer-program/media-playback/trick-mode/bif-file-creation.md)).

Sizes: **small** is 1 to 2 days, **medium** 3 to 5 days, **large** 1 to 2 weeks, for one developer with tests, on top of the base player in [player-stack.md](player-stack.md).

## Recommendation

First version:

| Feature | Size | Why first |
|---|---|---|
| Next episode plays by itself, with a 10-second countdown that starts at the final credits | medium | The owner asked for it. Needs a play queue, which also brings markers for free. |
| Skip Intro and Skip Credits buttons, plus a setting per kind: off, show button, skip automatically | small to medium | The owner asked for it. Markers already exist for most files. |
| No trailers before movies | none | Plex only adds trailers when the player asks for them. We never ask. |
| Audio and subtitle choice remembered, and carried to the next episode | medium | Plex stores it per file; we copy it forward. |
| Resume where you stopped, and report progress so Plex marks things watched | small | The timeline calls exist already in the plan; this adds two fields. |
| Preview pictures above the scrub bar | small to medium | The pictures already exist on the slot for 777 of 782 files. No new server work. |

Later:

| Feature | Size | Note |
|---|---|---|
| Chapter list in the "Picture and sound" panel | small | mpv reads chapters from the file itself. |
| Chapter pictures | small | Only some files have them; the server setting is off. |
| Subtitle auto-sync | medium | Uses an undocumented address. |
| Trailers before movies, as an opt-in count | small | Only if the owner wants them. |
| Shuffle a show | small | Documented, but only for queues without manually added items. |

Leave out: ad skipping (no ad markers exist and the files have no ads), Watch Together (several people watching in step; one owner doesn't need it), downloads and sync, loudness levelling (server analysis is off).

"Auto skip trailers": the owner may have meant TV intros, which the skip setting covers. Trailers before movies need no skipping because the app never requests them (see below).

## What the slot already has (checked on the slot)

Server settings, read from `GET /:/prefs`:

| Setting (label in Plex) | Pref name | Value | Plex default |
|---|---|---|---|
| Generate intro video markers | `GenerateIntroMarkerBehavior` | `asap` (scheduled task and when media is added) | `asap` |
| Generate credits video markers | `GenerateCreditsMarkerBehavior` | `asap` | `asap` |
| Marker source | `MarkerSource` | `any` (both, try online first) | `any` |
| Generate ad video markers | `GenerateAdMarkerBehavior` | `scheduled` | `scheduled` |
| Generate voice activity data | `GenerateVADBehavior` | `asap` | `never` |
| Generate video preview thumbnails | `GenerateBIFBehavior` | `asap` | `never` |
| Video preview thumbnail frame duration | `GenerateBIFFrameInterval` | 2 seconds | 2 |
| (hidden) keyframes only | `GenerateBIFKeyframesOnly` | true | true |
| Generate chapter thumbnails | `GenerateChapterThumbBehavior` | `never` | `scheduled` |
| Analyze audio tracks for loudness | `LoudnessAnalysisBehavior` | `never` | `scheduled` |
| Video play completion behaviour | `LibraryVideoPlayedAtBehaviour` | `3` (earliest of the threshold and the first credits marker) | `3` |
| Video played threshold | `LibraryVideoPlayedThreshold` | 90% | 90% |
| Use language preferences from plex.tv | `LanguageInCloud` | true | false |
| Cinema Trailers from library / theaters / Blu-ray | `CinemaTrailersFromLibrary` / `...FromTheater` / `...FromBluRay` | true / false / false | same |
| Choose Cinema Trailers from | `CinemaTrailersType` | 1 (only unwatched movies) | 1 |
| Movie pre-roll video | `CinemaTrailersPrerollID` | empty | empty |
| Time at which tasks start / stop | `ButlerStartHour` / `ButlerEndHour` | 2 / 5 (02:00 to 05:00 server time, UTC) | 2 / 5 |

Library settings (`GET /library/sections/{id}/prefs`): both libraries have preview thumbnails, credits detection and voice activity detection on; TV also has intro detection on. Ad detection is `1`, which the server's own option list labels "For recorded items" (TV recordings only). The Films library has "Enable Cinema Trailers" on.

Server facts that answer open questions in [player-stack.md](player-stack.md):
- `GET /` reports `streamingBrainABRVersion` 3, so Plex Web would offer its automatic quality on this server.
- The "Transcoder default throttle buffer" setting exists as `TranscoderThrottleBuffer`, set to 600 seconds (default 60).

Coverage, from a copy of Plex's database (81 movies, 692 episodes):

| What | Movies | Episodes |
|---|---|---|
| Credits marker | 80 | 647 |
| Credits marker flagged `final` | 77 | 623 |
| Intro marker | (not detected for movies) | 267 |
| Ad marker | 0 | 0 |
| Preview pictures (`indexes="sd"` on the file) | 87 of 90 files | 690 of 692 files |
| Voice activity data | 89 of 90 files | 327 of 692 (job running during the check) |

Intro gaps: 36 shows have no intro markers at all, including Silo, Fallout, Andor, The Wheel of Time and Severance. Pilot episodes also lack them (The Leftovers S01E01 has none, S01E02 has one). Plex finds intros by matching the audio at the start of episodes in the same season ([Skip TV Show Intros](https://support.plex.tv/articles/skip-content/), modified Aug 2024), so a season with one episode in the library can't be matched. Intro detection was still working through The Shards season 1 during the check, so some gaps may close by themselves.

Chapter names fill some gaps. Of the 692 episodes, 358 carry chapters from the file. 112 episodes without an intro marker have a chapter named "Intro" or similar, 61 have a "Recap" or "Previously on" chapter, and 267 have a "Credits" chapter. These come from streaming-service releases.

## 1. Next episode plays by itself (Up Next)

**How Plex does it**
- The player creates a play queue: `POST /playQueues?type=video&uri=...&continuous=1` (spec). `continuous=1` is "Whether to create a continuous play queue (e.g. from an episode)", so the queue holds the following episodes.
- `uri` format: `server://{machineIdentifier}/com.plexapp.plugins.library/library/metadata/{ratingKey}`. Not spelled out in the spec; python-plexapi builds it this way ([playqueue.py](https://github.com/pushingkarmaorg/python-plexapi/blob/master/plexapi/playqueue.py), line 171). This server's `machineIdentifier` comes from `GET /`.
- To start a show at its next unwatched episode, the spec has `onDeck=1` ("started on the On Deck episode if one exists"). Plex Web instead fetches the show with `includeOnDeck=1` first.
- Plex Web sends `continuous=1` for shows, seasons and episodes.
- `GET /playQueues/{id}` returns a window of the queue around the current item. Plex Web adds `includeMarkers=1&includeChapters=1`, so markers arrive with each queue item.
- Moving to the next item: the spec says "There is no play queue API to update the playing item". The player plays the next item and sends timeline calls with its `playQueueItemID`; "the play queue window advances as the server receives timeline requests". When stopping one item to go to the next, the timeline call takes `state=stopped&continuing=1` (spec).
- `GET /hubs/metadata/{id}/postplay` (spec) returns rows for the end screen. On this server it returned the global On Deck row (Wheel of Time, South Park, Bob's Burgers), not the next episode. Plex Web removes any "up next" row from it and takes the next item from the play queue.

**How Plex's apps behave**
- Plex Web 4.162.1: when the file ends, if the queue has another item and the video is at least 300 seconds long, it pauses and shows "Playing Next" with the poster and a 10-second countdown ring, when Auto Play is on. With Auto Play off it waits for a click. It prepares the next item's playback 10 seconds before the end.
- Plex Web's Skip Credits button seeks to the end of the credits marker. On a `final` marker that is the end of the file, which triggers the "Playing Next" screen.
- Other Plex apps: "In some apps, the playback will minimize and play in a small box on the post play screen on the 'final' credit marker" ([Credits Detection](https://support.plex.tv/articles/credits-detection/), modified Aug 2024). Which apps, and the countdown length there: unverified.

**Plex Pass and settings**: play queues need neither. The `final` flag needs credits detection, which needs Plex Pass on the server owner's account and Plex Media Server 1.31.0 or later (same article). The owner's plex.tv account reports a lifetime plan, active.

**For our player**
- Start the countdown at the `startTimeOffset` of the `final` credits marker, shrink the picture to a corner of the window, and keep the credits playing behind it. When the countdown ends or the owner clicks, play the next episode.
- No `final` marker (24 episodes have only a non-final credits marker, 45 have none): fall back to Plex Web's rule, the countdown at the end of the file.
- Movies have no next item, so no countdown.
- A setting "Play next episode automatically", on by default, matching Plex Web's Auto Play.
- mpv:
  - `--keep-open=yes` so mpv holds the last frame instead of quitting at the end of the file.
  - `{"command":["observe_property",1,"time-pos"]}`; compare each value with the marker.
  - Next episode: `{"command":["loadfile","<direct play address>","replace",-1,"start=0"]}`. In mpv 0.41 `loadfile` takes `url`, `flags`, `index` and `options` (`mpv --input-cmdlist` on the owner's Mac).
  - `--prefetch-playlist=yes` with the next file appended (`loadfile ... append`) lets mpv open the next file early. Whether that helps over the plex.direct address is unverified.
- Size: medium (play queue, countdown overlay, timeline changes, tests for the countdown rules).

## 2. Skip intro, skip credits, skip recaps

**Getting the markers**
- `GET /library/metadata/{ratingKey}?includeMarkers=1` (checked on the slot), or the play queue as above.
- `includeMarkers` is **not in the spec**. Every Plex client sends it, and it worked on the slot.
- Marker fields seen on the slot: `type` (`intro` or `credits`), `startTimeOffset`, `endTimeOffset` (ms), `final="1"` on the last credits marker. Example, The Leftovers S01E02: intro 234848 to 327541, final credits 3310438 to 3369376.
- The spec documents the marker object only as the reply of the "create a marker" call (`POST /library/metadata/{ids}/marker`), with types `intro`, `commercial`, `bookmark`, `resume` and `credit`, and an example `{"final":true,"type":"credits",...}`.
- Trap: every marker on this server has `id` 26294, in both JSON and XML. It is the id of the one "marker" tag in Plex's database, not of the marker. Plex Web keys markers by `type:startTimeOffset:endTimeOffset`; do the same.
- Trap: Plex Web's item fetch adds `asyncCheckFiles=1&asyncRefreshAnalysis=1&asyncRefreshLocalMediaAgent=1`. The spec says these start background work. Our app must not send them.
- A movie can have more than one credits marker. Arrival has a non-final one (1:52:05 to 1:55:21) and a final one (1:55:51 to the end).

**How Plex's apps behave**
- Plex Web 4.162.1 has four buttons: "Skip Intro", "Skip Credits", "Skip Ads" (type `commercial`) and "Skip Recaps" (type `recaps`). This server has no recap or ad markers.
- The button shows while the position is inside the marker and hides in its last 500 ms. Pressing it seeks to `endTimeOffset`, rounded to whole seconds.
- Plex's support page says skipping lands "a couple of seconds before the intro ends so you know you did not miss any of the start of the show" ([Skip TV Show Intros](https://support.plex.tv/articles/skip-content/)). Plex Web's code seeks to the end itself.
- Plex Web has no automatic skip. Plex's Android TV app offers show button, skip automatically, or off for credits (per Plex's [Android TV settings page](https://support.plex.tv/articles/settings-android-tv/), unverified: not read directly).

**Plex Pass and settings**
- Plex Pass on the server owner's account to detect, and on the watching account to skip (both articles above). The owner has both.
- Server: `GenerateIntroMarkerBehavior` and `GenerateCreditsMarkerBehavior` (both `asap` here). Library: `enableIntroMarkerGeneration`, `enableCreditsMarkerGeneration` (both on). Per show or movie: `enableCreditsMarkerGeneration` (`-1` = library default).
- `MarkerSource=any` downloads credits markers other servers found for the same file, before analysing locally. Intro markers are not shared ([Credits Detection](https://support.plex.tv/articles/credits-detection/)).
- Plex ignores intros shorter than 20 seconds and intros ending after the halfway point (Skip TV Show Intros).

**For our player**
- One setting per kind (intro, recap, credits): off, show button (default), skip automatically.
- Automatic skip fires once per marker and only when playback crosses `startTimeOffset` while playing. A seek or resume into the middle of an intro shows the button instead. After an automatic skip, show "Intro skipped" with an undo button for a few seconds.
- Automatic credits skip on a `final` marker means "go to the next episode", so it follows the Up Next setting.
- Fallback when Plex has no marker: use a chapter named Intro, Opening, Recap or Previously on (112 and 61 episodes here). Chapter names vary by release, so match a short fixed list.
- mpv: observe `time-pos`; on press, `{"command":["seek",<endTimeOffset/1000>,"absolute"]}`.
- Size: small to medium. Small for buttons and automatic skip once the play queue exists; the chapter fallback and undo add a day or two.

## 3. Trailers before movies (Cinema Trailers and pre-roll)

- Cinema Trailers play trailers before a movie, like a cinema. A pre-roll is a fixed clip, such as a studio logo, set on the server in `CinemaTrailersPrerollID` ([Cinema Trailers, Extras & Related Albums](https://support.plex.tv/articles/202934883-cinema-trailers-extras/), modified Oct 2024).
- The player decides. The spec: `extrasPrefixCount` on `POST /playQueues` is the "Number of trailers to prepend a movie with not including the pre-roll. If omitted the pre-roll will not be returned in the play queue. When resuming a movie `extrasPrefixCount` should be omitted."
- Plex Web sends it only for movies started from the beginning, using its own player setting "Cinema Trailers to play before movies". The support article says these are app settings, not server settings.
- Trailers and pre-roll arrive as separate play queue items before the movie, so a player could skip one by moving to the next queue item.
- This server: the pool is trailers of unwatched movies in the library, streamed from Plex's extras provider (Arrival lists 44 extras, Bugonia 6). "Find extras" and the theater and Blu-ray trailer sources need Plex Pass (same article). No pre-roll is set.
- For our player: never send `extrasPrefixCount`. No trailers, no pre-roll, nothing to skip. Size: none.

## 4. Play queue controls (next, previous, shuffle)

All in the spec:
- Create: `POST /playQueues` with `type=video`, `uri`, `key` (first item), `continuous`, `shuffle`, `onDeck`.
- Read: `GET /playQueues/{id}?window=&center=`.
- Add: `PUT /playQueues/{id}?uri=&next=1` (play next) or without `next` (add to the end).
- Shuffle: `PUT /playQueues/{id}/shuffle` and `/unshuffle`. The spec: only "for play queues *without* an Up Next area", meaning without manually added items.
- Remove and move: `DELETE /playQueues/{id}/items/{itemId}`, `PUT .../move`.
- Next and previous: no call. The player loads the neighbouring item and sends timeline calls for it.

For our player: next and previous episode buttons in the control bar, from the queue window. Shuffle later. Creating a queue writes a row in Plex's database; light, but it is a write, so it wasn't tried during this research.

## 5. Remembered audio and subtitle choice

Three levels, checked on the slot:

1. **Per file**: `PUT /library/parts/{partId}?audioStreamID=&subtitleStreamID=` (spec; `subtitleStreamID=0` turns subtitles off, `allParts=1` covers multi-part files). The choice comes back as `selected` on that stream. Saved per user. Example: Arrival has "English Forced" subtitles selected.
2. **Per show**: `GET /library/metadata/{showRatingKey}?includePreferences=1` returns `audioLanguage`, `subtitleLanguage` and `subtitleMode` ("Auto-select subtitle mode": `-1` account default, `0` manually selected, `1` shown with foreign audio, `2` always enabled). All empty or `-1` on The Leftovers. `includePreferences` is not in the spec; the setter `PUT /library/metadata/{ids}/prefs` is.
3. **Per account**, on plex.tv (`GET https://clients.plex.tv/api/v2/user`, field `profile`): `autoSelectAudio` true, `defaultAudioLanguage` en, `defaultSubtitleLanguage` en, `autoSelectSubtitle` 1, `defaultSubtitleForced` 0. The server uses these because `LanguageInCloud` is on, so a new episode's `selected` streams already follow them. That plex.tv call is outside the server spec.

What Plex's apps do when you change tracks mid-show and the next episode starts: unverified. Plex Web's code calls the per-file setter; whether it also writes the next episode wasn't traced.

For our player:
- On start, use the streams marked `selected`.
- When the owner changes audio or subtitles, call the per-file setter. When the next episode loads, pick the stream with the same language, forced flag and subtitle type, and call the setter for that file too.
- mpv: Plex's stream `index` is the stream's position in the file, which matches the `ff-index` field in mpv's `track-list`; set `aid` or `sid` to the matching mpv track. Subtitles stored as separate files (they have a `key`, e.g. Arrival's two later "English" entries) load with `sub-add` and `/library/streams/{id}.srt`.
- Size: medium.

## 6. Resume and watched rules

- Resume point: `viewOffset` on the item, in ms (spec). Bugonia has 5442820 (1:30:42).
- Plex saves it from timeline calls. The server marks an item watched at the earliest of 90% and the start of the first credits marker (`LibraryVideoPlayedAtBehaviour=3`). So with timeline calls, the app needs no separate "mark watched" call. That this rule applies to a third-party player's timeline calls is unverified; Plex's settings don't name clients.
- Timeline fields to add to the plan in [player-stack.md](player-stack.md): `playQueueItemID`, and `continuing=1` on the stop sent when moving to the next item.
- For our player: offer "Resume from 1:30:42" or "Start over" when `viewOffset` is set. mpv: `loadfile ... start=5442.8`.
- Size: small.

## 7. Chapters and chapter pictures

- `includeChapters=1` on the item (not in the spec; Plex Web sends it). Each chapter has `index`, `tag` (its name, when the file has one), `startTimeOffset`, `endTimeOffset`, and `thumb` when a picture exists.
- Picture: `GET /library/media/{mediaId}/chapterImages/{index}` (spec). Bugonia's first chapter picture returned a 12.9 KB JPEG. Arrival's chapters have none. `GenerateChapterThumbBehavior` is `never`, yet 2,014 chapter pictures exist on disk, presumably from before.
- mpv reads chapters straight from the file (`chapter-list` property, `chapter` to jump), so the list doesn't need Plex. Only the pictures do.
- Size: small for a list in the side panel; small again for pictures where they exist.

## 8. Preview pictures for scrubbing

- The file's `Part` has `indexes="sd"` when pictures exist (checked on the slot).
- `GET /library/parts/{partId}/indexes/sd` (spec) returns the whole BIF file. The Leftovers S01E02 (56 min): 12.3 MB, 1,684 pictures (one per 2 seconds), downloaded in 0.46 s.
- `GET /library/parts/{partId}/indexes/sd/{offsetMs}` (spec) returns one 320 x 180 JPEG, about 5.5 KB.
- Plex Web asks for one picture per hover, at the hovered time rounded to whole seconds.
- Settings: `GenerateBIFBehavior=asap`, library `enableBIFGeneration` on. Plex Pass not needed ([Video Preview Thumbnails](https://support.plex.tv/articles/202197528-video-preview-thumbnails/), modified 2019).
- For our player: fetch single pictures on hover, with a small cache, from our own control bar. If mpv runs in its own window, the bar is ours anyway.
- Size: small to medium.

## 9. Subtitle auto-sync (later)

- Plex can shift a badly timed SRT subtitle file to match the dialogue, using voice activity data from the server ([Auto-Sync Subtitles](https://support.plex.tv/articles/auto-sync-subtitles/), modified Sep 2024). Needs Plex Media Server 1.41.0 or later, Plex Pass on both sides, and an external SRT file. Embedded subtitles don't qualify.
- The spec documents `hasVoiceActivity` on the media and `canAutoSync` on subtitle streams.
- Plex Web sends `autoAdjustSubtitle=1` among its conversion settings. During direct play it fetches the subtitles from `/subtitles/:/transcode/universal/start` with those settings. That address is not in the spec. Converting subtitle text is light work on the server.
- For mpv: `sub-add` that address. Untested.
- Size: medium, mostly testing.

## 10. Ad markers, Watch Together, sync

- Ad markers: Plex's ad detection is meant for TV recordings. Both libraries are set to "For recorded items", and no ad markers exist. The owner's files are web and Blu-ray releases. Leave out.
- Watch Together and syncing to devices: Plex Web carries code for both, but neither helps one owner on one computer. Leave out.

## Server cost

The app only reads markers, pictures and chapters, so it adds no background work. The work is already happening because these settings are on:

| Task | What it does to the processor (checked on the slot unless marked) | Status |
|---|---|---|
| Intro detection | Decodes the audio of each episode's opening to FLAC (lossless audio) and compares episodes. One run used `-t 1590` seconds of a 53-minute episode. | Running during the check: The Shards S01, 61% then 62% about six minutes later. |
| Voice activity | Decodes the whole audio track to 8 kHz mono and listens for speech. | Running: Gone S01E02, Heartstopper S03E04. 327 of 692 episodes done. |
| Credits detection | Method not documented. Many credits markers are downloaded instead (`MarkerSource=any`). | 647 of 692 episodes, 80 of 81 movies done. |
| Preview pictures | Plex: "not uncommon for a single movie to take 10 minutes or more", using "the majority of your CPU" (Video Preview Thumbnails). Keyframes-only, as set here, is lighter (unverified by how much). | 777 of 782 files done; 899 BIF files take 9.6 GB, almost all of Plex's 9.8 GB media folder. |
| Ad detection, chapter pictures, loudness, deep media analysis | | Not running for these libraries. |

Measured load: six samples ten seconds apart, 02:57 to 02:58 UTC, found 2 or 3 "Plex Transcoder" detection processes using 84% to 180% of one processor core in total. The machine's load average was about 15 on 72 threads. Plex's log folder doesn't exist on the slot, so the time per item couldn't be read from logs.

Ongoing cost is per new file: once the backlog finishes, each new episode costs one audio decode for intros, one for voice activity, credits detection unless the online store has them, and one preview-picture pass.

Choices for the owner (nothing was changed):
- Set intro, credits and voice-activity detection to "as a scheduled task" instead of `asap`. They would then run only between 02:00 and 05:00 UTC, instead of whenever a file arrives.
- Turn voice activity off if subtitle auto-sync isn't wanted. It's the one task here set above Plex's default.
- Keep preview pictures. The backlog is done and new files cost one pass each.

## Could not verify

- When the Up Next countdown starts in Plex's non-web apps, and its length there.
- Whether Plex's Android TV, HTPC or desktop apps skip intros automatically, and their exact setting names.
- Whether the server applies the "mark watched at first credits marker" rule to a third-party player's timeline calls.
- Whether a Plex app carries a changed audio or subtitle track to the next episode, and how.
- The subtitle auto-sync address with mpv.
- Whether `--prefetch-playlist` shortens the gap between episodes over the plex.direct address.
- Whether Plex hides markers from accounts without Plex Pass, or only hides the buttons in its apps. Irrelevant for the owner, who has a lifetime pass.
- How much lighter keyframes-only preview pictures are than Plex's "10 minutes per movie" figure.
