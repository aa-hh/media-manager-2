# What Whatbox allows for hosting media-manager-2

Linear: [AA-8](https://linear.app/aa-hh/issue/AA-8). Researched 2026-10-08 from Whatbox's public wiki and FAQ, without signing in. Anything Whatbox does not publish is marked "Not published".

## Answer

media-manager-2 can run on Whatbox as an ordinary program started over SSH (the remote command line), with no Docker and no root (administrator) access. It listens on a port between 10000 and 32767, and Whatbox's "Managed Links" page puts an HTTPS address in front of it. Cron (the built-in task scheduler) restarts it after a server reboot, and a check script run every 5 minutes restarts it after a crash. Node.js, Python and Go are already installed. Whatbox publishes no per-user memory or process limits, only a rule against burdening the shared server. Whatbox says nothing about hardlinks; Linux allows them only within one filesystem, and the slot's files sit on one drive, so they very likely work, but this needs a one-minute check on the slot.

## Docker and root access

- No root access: "No, root access is not available." ([FAQ](https://whatbox.ca/faq))
- "You can not install software that requires root privileges." ([FAQ](https://whatbox.ca/faq), [Installing Software](https://whatbox.ca/wiki/Installing_Software))
- Docker is not mentioned anywhere in the FAQ, and the wiki has no Docker page (`https://whatbox.ca/wiki/Docker` returns 404). Docker's rootless mode still needs `newuidmap`/`newgidmap` installed on the host and entries in `/etc/subuid` and `/etc/subgid` ([Docker docs](https://docs.docker.com/engine/security/rootless/)), which a user without root cannot add. Treat Docker as unavailable. Not published: whether Whatbox would add these on request.

## Languages and runtimes

- Node.js and npm: "Node.js and npm are installed on our servers." Versions not listed. ([Node.js](https://whatbox.ca/wiki/nodejs))
- Users can install newer Node versions themselves with pnpm: the Seerr guide runs `pnpm env use -g 22` to switch to Node 22. ([Seerr](https://whatbox.ca/wiki/Seerr))
- Python is preinstalled; packages must go in a virtualenv (a private package folder) because system-wide installs are "not possible with your Whatbox slot". ([Python](https://whatbox.ca/wiki/Python))
- Go is installed and `go build` works. ([Go](https://whatbox.ca/wiki/Go))
- Java is allowed but not installed or supported by Whatbox. ([FAQ](https://whatbox.ca/faq))
- Anything else: compile from source into `$HOME` or download prebuilt binaries. ([Installing Software](https://whatbox.ca/wiki/Installing_Software))
- Exact installed versions are on the slot's "Labs" page, which needs a sign-in. ([Python](https://whatbox.ca/wiki/Python), [Manage page](https://whatbox.ca/wiki/manage_page)) Not checked.

## Running a long-running web app

- Custom apps are allowed: "Yes, however, this is advanced functionality that you must do via SSH, and our support will be limited." ([FAQ](https://whatbox.ca/faq))
- Port: "A random port number between 10000 and 32767 is needed." ([Node.js](https://whatbox.ca/wiki/nodejs), [Userland Nginx](https://whatbox.ca/wiki/Userland_Nginx))
- Plain address: `http://server.whatbox.ca:<port>/`, HTTP only. ([Node.js](https://whatbox.ca/wiki/nodejs))
- HTTPS: on the Managed Links page, "Add a custom app" with the app's port. Each slot gets its own `box.ca` subdomain, and each custom app gets a subdomain under it with HTTPS. ([Managed Links](https://whatbox.ca/wiki/Managed_Links))
- Managed Links can also point at a Unix domain socket (a local file the app listens on instead of a port) and can turn on WebSockets (a kept-open connection for live updates), which media-manager-2 would need only if it pushes live torrent status to the browser that way. ([Managed Links](https://whatbox.ca/wiki/Managed_Links))
- Managed Links can use a domain the owner already has ("Bring Your Own Domain"), set up with CNAME records. ([Managed Links](https://whatbox.ca/wiki/Managed_Links))
- Managed Links adds HTTPS only. Whatbox's Sonarr and Radarr guides still require the app's own sign-in ("You must enable Authentication") ([Sonarr](https://whatbox.ca/wiki/sonarr), [Radarr](https://whatbox.ca/wiki/radarr)), so media-manager-2 needs its own sign-in, as the map's destination already says.
- Keeping it alive: Whatbox's own guides start apps inside `screen` (a program that keeps a command running after SSH disconnects), then add two crontab lines: `@reboot` to start after a server restart, and `*/5 * * * *` to run a script that restarts the app if `pgrep` does not find it. ([Seerr](https://whatbox.ca/wiki/Seerr), [Sonarr](https://whatbox.ca/wiki/sonarr), [Cron](https://whatbox.ca/wiki/Cron), [screen](https://whatbox.ca/wiki/screen)) So a crash can mean up to 5 minutes of downtime.
- Not published: whether user-level systemd (Linux's standard service manager) works. No Whatbox guide uses it.

## Reaching Sonarr, Radarr and rTorrent

- Sonarr and Radarr are bound to localhost (reachable only from the same server) by default "to prevent non-secure external access". ([Sonarr](https://whatbox.ca/wiki/sonarr), [Radarr](https://whatbox.ca/wiki/radarr)) The Seerr guide says to "Use 127.0.0.1 as the address for connecting other apps if the app is running on the same server." ([Seerr](https://whatbox.ca/wiki/Seerr)) media-manager-2 on the same slot can call them at `127.0.0.1:<port>`.
- rTorrent's XMLRPC interface (its remote-control interface) is published at `https://server.whatbox.ca:443/xmlrpc`, signed in with the Whatbox username and password. ([Using XMLRPC with Python](https://whatbox.ca/wiki/Using_XMLRPC_with_Python)) Not published: a local socket path for rTorrent.
- Whatbox manages Sonarr and Radarr updates; their built-in update and restart functions "will fail". ([Sonarr](https://whatbox.ca/wiki/sonarr), [Radarr](https://whatbox.ca/wiki/radarr))

## Memory, CPU and process limits

- Not published: any per-user memory, CPU or process limit.
- The rule is behavioural: "Software that negatively impacts other users by burdening the server is not allowed." ([FAQ](https://whatbox.ca/faq), [Installing Software](https://whatbox.ca/wiki/Installing_Software))
- Also banned: cryptocurrency mining, peer-to-peer load balancing, Tor nodes, LLM models, and transcoding 4K HEVC video. ([Installing Software](https://whatbox.ca/wiki/Installing_Software), [FAQ](https://whatbox.ca/faq))
- Server hardware: a CPU with a Passmark score of at least 30,000, 320 GB of RAM, shared across slots. ([FAQ](https://whatbox.ca/faq))
- The Seerr guide caps its build at 8 CPUs so it "will allow Seerr to build correctly on our servers", a hint that heavy builds are better done elsewhere and copied over. ([Seerr](https://whatbox.ca/wiki/Seerr))
- Going over the storage limit slows downloads, then locks the slot; a locked slot has its torrent client shut down and SSH blocked. ([FAQ](https://whatbox.ca/faq), [Locked Slots](https://whatbox.ca/wiki/locked_slots))

## Hardlinks between rTorrent's download folder and the library folder

A hardlink is a second name for the same file on disk, so Sonarr or Radarr can import a download into the library folder without a second copy while rTorrent keeps seeding the original.

- Whatbox publishes nothing about hardlinks. A search of whatbox.ca found no page mentioning them.
- Linux rule: a hardlink fails with `EXDEV` when the two paths are "not on the same mounted filesystem", and "link() does not work across different mounts, even if the same filesystem is mounted on both." ([link(2) man page](https://man7.org/linux/man-pages/man2/link.2.html))
- Whatbox describes one drive per slot: "Your slot's hard drive may have up to 4 users." ([FAQ](https://whatbox.ca/faq)) If rTorrent's download folder and the library folder are both under the home directory on that drive, hardlinks should work. Not confirmed.
- To confirm on the slot: `df <download folder> <library folder>` must show the same mount for both, and after one import `stat -c %h <file in download folder>` must print 2 or more.

## What would make a later move to another host harder

- Addresses: the `box.ca` subdomain and `server.whatbox.ca:<port>` are Whatbox's. Using "Bring Your Own Domain" now keeps the public address when moving. ([Managed Links](https://whatbox.ca/wiki/Managed_Links))
- rTorrent access: the `https://server.whatbox.ca/xmlrpc` endpoint and its Whatbox-password sign-in are set up by Whatbox. Another host will expose rTorrent differently (often a local socket), so the address and sign-in belong in settings.
- Process handling: Whatbox's pattern is screen plus cron. Most other hosts use Docker or systemd. Keep start-up to one command with all host values in settings or environment variables, and the move is a new start-up wrapper.
- No Docker here: if a Dockerfile is added for other hosts, it cannot be tested on Whatbox.
- Data safety: "We provide non-redundant storage, so please backup your files," and files are deleted 7 days after a slot expires. ([FAQ](https://whatbox.ca/faq)) media-manager-2's own database (including which second versions it tracks) needs a backup copy off the slot.
- Paths: Whatbox home directories are `/home/<user>` (seen in its cron scripts, e.g. [Seerr](https://whatbox.ca/wiki/Seerr)). Download and library folder paths belong in settings.
