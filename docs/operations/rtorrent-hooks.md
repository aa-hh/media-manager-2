# rTorrent event hooks

Without hooks the app reads rTorrent's full torrent list every 30 seconds. With them, a torrent that is added, finishes, is stopped, closed or removed reaches the app within about a second.

Each hook touches a file in the app's data folder (`rtorrent-events/` next to the database). The app watches that folder and runs its full rTorrent poll when anything in it changes. The line carries no password or token. rTorrent and the app must run on the same machine as the same user.

Add these lines to the end of `/config/ahhhhhhh/rtorrent/rtorrent.rc` on the Whatbox slot (`~/.config/rtorrent/rtorrent.rc` links there):

```
# media-manager-2: tell the app at once when a torrent is added, finishes, stops or is removed.
method.set_key = event.download.inserted_new, media_manager_2, "execute.nothrow.bg=touch,/home/ahhhhhhh/.local/share/media-manager-2/rtorrent-events/changed"
method.set_key = event.download.finished, media_manager_2, "execute.nothrow.bg=touch,/home/ahhhhhhh/.local/share/media-manager-2/rtorrent-events/changed"
method.set_key = event.download.paused, media_manager_2, "execute.nothrow.bg=touch,/home/ahhhhhhh/.local/share/media-manager-2/rtorrent-events/changed"
method.set_key = event.download.closed, media_manager_2, "execute.nothrow.bg=touch,/home/ahhhhhhh/.local/share/media-manager-2/rtorrent-events/changed"
method.set_key = event.download.erased, media_manager_2, "execute.nothrow.bg=touch,/home/ahhhhhhh/.local/share/media-manager-2/rtorrent-events/changed"
```

rTorrent reads the file only when it starts, so restart rTorrent afterwards. Restarting stops seeding for the minute it takes.

If `DB_PATH` points the database somewhere else, change the folder in each line to `rtorrent-events/` next to that database. To remove the hooks, delete the lines and restart rTorrent; the app goes back to its 30-second schedule.
