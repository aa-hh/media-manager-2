# Acceptance checks on the deploy host

Manual checks that local tests cannot cover; each runs on the real deploy
host. They were moved out of the README so it stays generic. Record the output
of each step.

## Service connections

Accepted only on live service evidence: run `node dist/server/cli.js
connections check` on the host and see `ok` with a version on the sonarr,
radarr, rtorrent and plex lines. The test fixtures prove controlled behaviour
only.

## Backups

The tests prove controlled behaviour against a fake bucket and a temporary
folder only. Accepted once `backup now`, `backup list` and a `backup restore`
to a spare path have run against the real destination.

## Restart after a crash or reboot

Record step 6 as a manual run or a real reboot. Run the commands from `~/media-manager-2` with the env file loaded: `cd ~/media-manager-2 && set -a && . ~/.config/media-manager-2/env && set +a`.

- [ ] 1. Crash. `kill -9 $(cat server.pid)`. Within 60 seconds `curl -fs http://127.0.0.1:$PORT/auth/status` succeeds, `ensure.log` has exactly one new `started pid` line, and `pgrep -fc "node $HOME/media-manager-2/dist/server/index.js"` prints 1.
- [ ] 2. No duplicates, stopped. Stop the server inside `flock -n ensure.lock sh` and `exit`, then run `bin/ensure-running.sh & bin/ensure-running.sh & wait`. One run logs `started pid`, the other `another run holds the lock, exiting`; the `pgrep -fc` count prints 1.
- [ ] 3. No duplicates, healthy. With the server answering, run `cat server.pid; bin/ensure-running.sh & bin/ensure-running.sh & wait; cat server.pid`. Both pids match and nothing new is logged.
- [ ] 4. Lock not inherited. `ls -l /proc/$(cat server.pid)/fd | grep -c ensure.lock` prints 0.
- [ ] 5. Deploy against cron. Run `while :; do bin/ensure-running.sh; sleep 1; done >> ensure.log 2>&1`. On your machine, run `sh scripts/deploy.sh`. Stop the loop with Ctrl-C; the `pgrep -fc` count prints 1 and `cat DEPLOYED` shows the new commit.
- [ ] 6. Reboot. The host cannot be rebooted on demand. Stop the server inside `flock -n ensure.lock sh` and `exit`, run the exact `@reboot` line from `crontab -l` by hand, and confirm the `pgrep -fc` count prints 1. After the next real reboot, record `uptime`, `ps -o etime= -p $(cat server.pid)` and the boot-time `started pid` line in `ensure.log`.
- [ ] 7. Hung server. `kill -STOP $(cat server.pid)`, then `bin/ensure-running.sh`. After about 45 seconds it logs `alive but not answering after 3 probes, stopping it` and `started pid`, and the `pgrep -fc` count prints 1.

