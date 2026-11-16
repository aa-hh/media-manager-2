# 0008. A deleted file stays deleted

Status: accepted

## Context

The owner frees space by deleting files by hand, outside this app. Sonarr and Radarr kept those episodes and movies monitored, so their release-feed checks grabbed the next copy, and this app's search scheduler searched every monitored item without a file. Nothing could tell a file the owner deleted from one never downloaded. On 14 Nov 2026 Sonarr had downloaded 141 deleted episodes again and Radarr 10 movies, and 450 episodes and 4 movies were waiting to be.

## Decision

Once a file is deleted, its episode or movie is no longer wanted. Sonarr's Unmonitor Deleted Episodes and Radarr's Unmonitor Deleted Movies do this when the file goes, whoever deleted it.

- The search scheduler reads the setting before every check. When it is off, the scheduler turns it on, unmonitors every monitored item whose file the owner deleted (delete reason `Manual` or `MissingFromDisk`), and says so in a resolved problem. When it cannot read the setting, it searches nothing for that service.
- More than 10 gaps opening in one check in titles already in the library are not searched. They join the search backlog and an open problem names them. New releases and newly added titles never count toward the 10.
- `searchAgain` deletes monitor again after the files are gone, since the setting unmonitors what the delete removed.

## Consequences

Getting a deleted title back is a deliberate act: monitor it again or search from its page. Monitoring an old season again in one go can trip the 10-gap hold; the owner then searches it from the title page. A re-monitor made in Sonarr or Radarr directly is honoured, because only a setting found off triggers the clean-up.
