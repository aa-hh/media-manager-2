#!/usr/bin/env python3
"""Exit (waking the main session) when a background helper stalls or all have finished.

Usage: watch-helpers.py <output_file> [<output_file> ...]
The output_file paths are the ones the Agent tool returns for each background launch.
"""
import json, os, sys, time

STALE_MIN = 20   # longer than the 10-minute Bash timeout, so a running build never counts
POLL_S = 60
MAX_HOURS = 6    # razor: fixed ceiling; make it an argument if runs ever legitimately go longer

# A hand-back is a tool call, so the transcript ends on its tool result, not an
# assistant line: judge by the last assistant entry instead of the last line.
def finished(path):
    try:
        with open(path, 'rb') as f:
            f.seek(0, 2); f.seek(max(0, f.tell() - 65536))
            lines = f.read().splitlines()
    except OSError:
        return False
    for line in reversed(lines):
        try:
            e = json.loads(line)
        except ValueError:
            continue  # the chunk's first line may be cut off
        if not isinstance(e, dict) or e.get('type') != 'assistant':
            continue
        m = e.get('message') or {}
        content = m.get('content')
        return m.get('stop_reason') == 'end_turn' or (isinstance(content, list) and any(
            isinstance(b, dict) and b.get('type') == 'tool_use' and b.get('name') == 'SubagentHandback'
            for b in content))
    return False

start = time.time()
files = sys.argv[1:]
while True:
    running = [p for p in files if not finished(p)]
    if not running:
        print('ALL FINISHED'); sys.exit(0)
    for p in running:
        idle = (time.time() - (os.path.getmtime(p) if os.path.exists(p) else start)) / 60
        if idle >= STALE_MIN:
            print(f'STALE {idle:.0f} min: {p}'); sys.exit(0)
    if time.time() - start > MAX_HOURS * 3600:
        print('WATCHER TIMED OUT; still running: ' + ' '.join(running)); sys.exit(0)
    time.sleep(POLL_S)
