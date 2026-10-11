# 0002. Force every import by copy, and refuse when hardlinks are off

Status: accepted

## Context

When Sonarr or Radarr will not import a finished download on its own, media-manager-2 forces the import with a `ManualImport` command. That command takes an import mode. `move` takes the file out of rTorrent's folder and ends seeding, which the private trackers in use punish. `copy` copies the file, or hardlinks it when the service's "use hardlinks instead of copy" setting is on. `auto` lets the service choose. Three code paths sent three different modes: the replace flow sent `auto`, the background import fix sent `copy`, and the hand-import screen sent `copy` after checking the hardlink setting. No commit recorded why they differed. Both services on the slot have hardlinks on today, so every path produced a hardlink, but nothing enforced that.

## Decision

Every forced import goes through one operation on the Sonarr/Radarr module. It reads the service's media management settings first. When hardlinks are off it refuses, sends nothing, and reports a refusal with the reason, which the caller turns into a needs-you problem. When hardlinks are on it sends `copy`. No path through the module can send `move` or `auto`.

## Consequences

A replace, a background import fix and a hand import all behave the same way. A seeding torrent's file is never moved and never copied in full. If the hardlink setting is ever switched off on the slot, every forced import stops with a visible problem instead of silently doubling disk use; turning the setting back on is the fix. The Sonarr/Radarr module pays one extra settings read per forced import.
