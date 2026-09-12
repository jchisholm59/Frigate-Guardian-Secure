# ⏪ Rollback Notes

Backup points created before risky deploys to the live NUC (`192.168.2.210:8100`, pm2 process `watchtower`), and how to revert to them.

---

## 2026-09-12 — Clip transcode cache pre-warming

Before deploying the MQTT-triggered background clip-transcode warming (commit `0a4fbf2`), a backup point was made of the last-known-good build (commit `36c3bcb` — BirdNET alert filter fix + PORT default fix, running live and stable at the time).

**Git tag:** [`pre-clip-cache-warm-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-clip-cache-warm-2026-09-12) at commit `36c3bcb`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-clip-cache-warm-20260912-082612/`

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-clip-cache-warm-20260912-082612 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-clip-cache-warm-2026-09-12 -- server.ts && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Flight route city-name display

Before deploying the flight-detail city-name change (commit `568437b`), a backup point was made of the last-known-good build (commit `0a4fbf2` — clip transcode cache pre-warming, running live and stable at the time).

**Git tag:** [`pre-flight-route-cities-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-flight-route-cities-2026-09-12) at commit `0a4fbf2`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-flight-route-cities-20260912-083732/`

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-flight-route-cities-20260912-083732 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-flight-route-cities-2026-09-12 -- flights.ts src/components/FlightDetailModal.tsx src/types.ts && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Fix .env leak in Download ZIP feature (security)

Before deploying the fix for `.env`/`guardian.env` (real Gmail SMTP password, Slack/Discord webhooks, Gemini API key) being bundled into the "Download ZIP" feature's output — reachable by anyone hitting the unauthenticated web UI — a backup point was made of the last-known-good build (commit `568437b` — flight route city names, running live and stable at the time).

**Git tag:** [`pre-env-zip-leak-fix-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-env-zip-leak-fix-2026-09-12) at commit `568437b`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-env-zip-leak-fix-20260912-084630/`

⚠️ **Do not revert this one without a reason that outweighs the security fix** — rolling back re-opens the leak (anyone who can reach the web UI can re-download `.env` in plaintext). If you ever do revert it, rotate the exposed Gmail app password, Slack webhook, Discord webhook, and Gemini API key immediately after.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-env-zip-leak-fix-20260912-084630 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-env-zip-leak-fix-2026-09-12 -- scripts/make-zip.cjs server.ts && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## General pattern for future backup points

Before deploying a change you might want to undo:

1. **Tag the currently-deployed commit** (from your local checkout, once you've confirmed the NUC is on that exact commit via `git log --oneline -1` over SSH):
   ```bash
   git tag -a pre-<change-name>-$(date +%Y-%m-%d) <commit-sha> -m "Backup point before <change-name>"
   git push origin pre-<change-name>-$(date +%Y-%m-%d)
   ```

2. **Snapshot the running build on the NUC** before pulling/rebuilding:
   ```bash
   ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && mkdir -p ../watchtower-backups && cp -r dist ../watchtower-backups/dist-pre-<change-name>-\$(date +%Y%m%d-%H%M%S)"
   ```

3. Deploy as normal (`git pull`, `npm run build`, `pm2 restart watchtower`).

4. Add an entry to this file with the tag name, backup directory, and exact revert commands — future-you (or Claude) shouldn't have to reconstruct paths and timestamps from shell history.

**Housekeeping:** `/home/jim/watchtower-backups/` isn't pruned automatically — old snapshots should be deleted by hand once you're confident a deploy is solid.
