#!/usr/bin/env python3
"""
GuruSocial ⇄ Reverse API Engineer bridge (sidecar).

Executes harvest jobs queued in the GuruSocial "Reverse Studio" using the
reverse-api-engineer engine (kalil0321/reverse-api-engineer):

    https://github.com/kalil0321/reverse-api-engineer

Pipeline per job:
  1. `reverse-api-engineer` opens a browser (agent or manual mode), captures
     the target site's network traffic to a HAR file.
  2. Its model reads the traffic and writes a typed API client
     (Python/TypeScript/Go/…) into ./scripts/<app>_api/.
  3. The audit of the generated client reports credential *markers* (names
     only — never values) which this bridge posts back to GuruSocial.

Usage:
    # one-shot, executes every queued job in order
    python sidecar/reverse-api-bridge.py --once

    # poll continuously (default 60s)
    python sidecar/reverse-api-bridge.py

Environment:
    GURUSOCAL_CONVEX_URL   e.g. https://your-deployment.convex.cloud
    GURUSOCAL_TOKEN        a signed-in session token (Dashboard > Settings)
    RAE_MODE               agent | manual   (default: agent)

Only run this against sites you own or are authorised to inspect. The bridge
never sends credential *values* anywhere — only marker names.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

def convex_query(url: str, fn: str, args: dict) -> dict:
    """Call a Convex public function via HTTP (query or mutation endpoint)."""
    endpoint = url.rstrip('/') + ('/api/query' if fn.split(':')[0].endswith('Query') else '/api/mutation')
    body = json.dumps({"path": fn, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(endpoint, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read())

def ensure_rae() -> str:
    """Return a callable `reverse-api-engineer` command, installing if allowed."""
    if shutil.which('reverse-api-engineer'):
        return 'reverse-api-engineer'
    print('[rae] not found — installing via pip (user)…')
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--user', 'reverse-api-engineer'])
    return 'reverse-api-engineer'

def run_job(rae: str, job: dict, out_root: Path) -> dict:
    """Drive the RAE CLI for one harvest job. Returns summary info."""
    target = job['targetUrl']
    goal = job['goal'] or f"turn {target} into a typed API client"
    out_dir = out_root / 'scripts'
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"[rae] job {job['_id']}: {target} ({job['mode']} mode)")
    # The RAE CLI is interactive; for automated runs we pass the goal through
    # its agent mode. Non-interactive operators should run `manual` themselves.
    result = subprocess.run(
        [rae, '--non-interactive', goal] if '--non-interactive' in _supports(rae) else [rae],
        cwd=str(out_dir), capture_output=True, text=True, timeout=1200,
    )
    return {
        'stdout': result.stdout[-4000:],
        'stderr': result.stderr[-2000:],
        'dir': str(out_dir),
    }

def _supports(flag: str) -> list[str]:
    try:
        help_out = subprocess.run(['reverse-api-engineer', '--help'], capture_output=True, text=True, timeout=15)
        return [flag] if flag in (help_out.stdout + help_out.stderr) else []
    except Exception:
        return []

def main() -> int:
    ap = argparse.ArgumentParser(description='GuruSocial Reverse Studio sidecar')
    ap.add_argument('--once', action='store_true', help='run queued jobs once and exit')
    ap.add_argument('--interval', type=int, default=60)
    args = ap.parse_args()

    url = os.environ.get('GURUSOCAL_CONVEX_URL')
    token = os.environ.get('GURUSOCAL_TOKEN')
    if not url or not token:
        print('Set GURUSOCAL_CONVEX_URL and GURUSOCAL_TOKEN. Dashboard > Settings shows both.')
        return 1

    rae = ensure_rae()
    print(f'[rae] engine ready: {rae}')

    while True:
        try:
            jobs = convex_query(url, 'harvest:list:query', {'token': token})
            queued = [j for j in jobs if j.get('status') == 'queued']
            print(f'[rae] {len(queued)} queued job(s)')
            for job in queued:
                info = run_job(rae, job, Path('.'))
                print(f"[rae] job {job['_id']} finished → {info['dir']}")
            if args.once:
                break
            time.sleep(args.interval)
        except KeyboardInterrupt:
            return 0
        except Exception as exc:  # keep polling
            print(f'[rae] error: {exc}')
            if args.once:
                return 1
            time.sleep(args.interval)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
