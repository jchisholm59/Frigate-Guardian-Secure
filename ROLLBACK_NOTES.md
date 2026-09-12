# ⏪ Rollback Notes

Backup points created before risky deploys to the live NUC (`192.168.2.210:8100`, pm2 process `watchtower`), and how to revert to them.

---

## 2026-09-12 — Exclusion zone reference-frame loading/error states

Before deploying (commit `a74bef9`), a backup point was made of the last-known-good build (commit `e8fc78c` — zone dragging, running live and stable at the time).

**Git tag:** [`pre-zone-loading-state-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-zone-loading-state-2026-09-12) at commit `e8fc78c`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-zone-loading-state-20260912-170400/`

Fixes "the drawing area is currently black" in the exclusion zone editor — the reference-frame image had no loading/error feedback, so the real (but brief) network round-trip through WatchTower to the camera server looked identical to a broken fetch. Added a loading spinner, a distinct error+Retry state, a manual "Refresh Frame" button, and cache-busting on every load. Traced live end-to-end before concluding it was a timing issue, not a broken proxy — raw Frigate snapshot, WatchTower's proxied response, and the browser's loaded `<img>` were all confirmed correct; only the missing loading indicator was the actual bug. Verified the fix by catching the spinner mid-fetch via Refresh Frame and confirming it resolves cleanly.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-zone-loading-state-20260912-170400 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-zone-loading-state-2026-09-12 -- src/components/ExclusionZoneModal.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Exclusion zone drag-to-move/reshape

Before deploying (commit `e8fc78c`), a backup point was made of the last-known-good build (commit `13ef340` — exclusion zones feature, running live and stable at the time).

**Git tag:** [`pre-zone-dragging-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-zone-dragging-2026-09-12) at commit `13ef340`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-zone-dragging-20260912-165010/`

Adds real dragging to the exclusion zone editor: drag a vertex to reshape a corner, or drag inside the shape to move the whole zone — previously the only way to adjust an existing zone was Clear Vertices + redraw. Verified live: dragged a zone as a whole shape, then reshaped one vertex into an irregular quadrilateral, confirmed no stray vertex from either drag's trailing click, confirmed the result persists correctly after Save.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-zone-dragging-20260912-165010 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-zone-dragging-2026-09-12 -- src/components/ExclusionZoneModal.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Exclusion zones feature

Before deploying (commit `13ef340`), a backup point was made of the last-known-good build (commit `79f290b` — BirdNET clip-link fix, running live and stable at the time).

**Git tag:** [`pre-exclusion-zones-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-exclusion-zones-2026-09-12) at commit `79f290b`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-exclusion-zones-20260912-163837/`

Adds notification-layer exclusion zones (Alert Rules → Exclusion Zones): draw a polygon per camera, any detection centered inside it is silently skipped before dispatch — independent of Frigate's own `stationary` heuristic, which is exactly what's unreliable for parked cars under changing light/shadow. Also repurposes the Snapshot/Playback "Box ON/OFF" toggle to show these zones instead of the old per-event box. Verified end-to-end against real data: drew a zone over real deck furniture using the camera's live frame, confirmed the ray-casting filter against the real saved polygon, and confirmed the overlay renders correctly on both a real snapshot and a real playing video clip with the toggle working both directions.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-exclusion-zones-20260912-163837 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-exclusion-zones-2026-09-12 -- server.ts src/App.tsx src/components/EventsReview.tsx src/components/NotificationSettingsView.tsx src/components/SnapshotViewerModal.tsx src/components/TenSecondPlaybackModal.tsx src/types.ts && git rm -f src/components/ExclusionZoneModal.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — BirdNET alert clip link fix

Before deploying (commit `79f290b`), a backup point was made of the last-known-good build (commit `ab6dd95` — all-cameras-muted fix, running live and stable at the time).

**Git tag:** [`pre-birdnet-cliplink-fix-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-birdnet-cliplink-fix-2026-09-12) at commit `ab6dd95`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-birdnet-cliplink-fix-20260912-125812/`

Fixes BirdNET alert emails/Slack/Discord messages linking to `<frigateServerUrl>/api/events/<birdDetectionId>/clip.mp4` — a URL that can never exist, since a BirdNET-Go detection ID is never a real Frigate event ID. Bird alerts now link straight to BirdNET-Go's own `/api/v2/audio/<id>` endpoint (mirroring how camera alerts already link straight to Frigate rather than through WatchTower). Verified directly against the live BirdNET-Go instance: HTTP 200, `Content-Type: audio/wav`, `Content-Disposition: inline` — plays immediately, no login required.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-birdnet-cliplink-fix-20260912-125812 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-birdnet-cliplink-fix-2026-09-12 -- server.ts && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — All-cameras-muted fix

Before deploying (commit `ab6dd95`), a backup point was made of the last-known-good build (commit `44d081c` — Add Frigate Server form defaults fix, running live and stable at the time).

**Git tag:** [`pre-camera-mute-fix-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-camera-mute-fix-2026-09-12) at commit `44d081c`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-camera-mute-fix-20260912-125144/`

Fixes "unable to disable all camera alerts": `filters.selectedCameras` is an allow-list where empty means "no filter, notify every camera" — muting cameras one at a time through Alert Rules empties that array on the last one, which both the UI and the server's dispatch check read as "no restriction," silently re-enabling everything. Added `filters.allCamerasMuted` as an unambiguous flag, plus a "Mute All" button. Verified live in the browser: muted 3 real cameras one at a time down to zero, confirmed the UI shows an explicit "all muted" banner instead of reverting, confirmed the persisted settings carry `allCamerasMuted: true`, and confirmed re-enabling one camera correctly drops back to an explicit allow-list.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-camera-mute-fix-20260912-125144 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-camera-mute-fix-2026-09-12 -- server.ts src/types.ts src/components/NotificationSettingsView.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Add Frigate Server form stale-default fix

Before deploying (commit `44d081c`), a backup point was made of the last-known-good build (commit `18319b3` — BirdNET channel fix, running live and stable at the time).

**Git tag:** [`pre-hostmodal-defaults-fix-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-hostmodal-defaults-fix-2026-09-12) at commit `18319b3`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-hostmodal-defaults-fix-20260912-123726/`

Fixes "Server Base URL" and "MQTT Broker Host" in the Add Frigate Server form defaulting to real pre-filled values (`http://localhost:5000`, `localhost`) instead of starting empty — typing into them without first selecting-all inserted at the cursor instead of replacing, producing a garbled concatenated URL that could never connect. Verified live: added a real remote Frigate server (over Tailscale) end-to-end — clean URL, successful probe (discovered its actual cameras), and confirmed it persisted correctly across a reload — before cleaning up the test entry.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-hostmodal-defaults-fix-20260912-123726 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-hostmodal-defaults-fix-2026-09-12 -- src/components/HostConnectorModal.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

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

## 2026-09-12 — Username/password login

Before deploying optional login (commit `215b9f2`), a backup point was made of the last-known-good build (commit `1477464` — the `.env` zip-leak fix, running live and stable at the time).

**Git tag:** [`pre-login-auth-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-login-auth-2026-09-12) at commit `1477464`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-login-auth-20260912-085509/`

This one shipped inert — auth only turns on once `AUTH_USERNAME`/`AUTH_PASSWORD` are set in `.env` on the NUC and the app is restarted. Verified live immediately after deploy: `/api/auth/status` returned `authEnabled: false` and `/api/birds/sightings` was still reachable, i.e. zero behavior change until credentials are actually configured.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-login-auth-20260912-085509 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit (also removes the login UI/routes entirely, not just disables them):**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-login-auth-2026-09-12 -- server.ts src/App.tsx src/components/Navbar.tsx package.json package-lock.json .env.example && git rm -f src/components/LoginView.tsx && npm install && npm run build && pm2 restart watchtower"
```

Simpler alternative if login is on and just needs to come back off without a full revert: remove/comment out `AUTH_USERNAME`/`AUTH_PASSWORD` from `.env` and `pm2 restart watchtower` — the app falls back to open access immediately, no rebuild needed.

After any of the above, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Role-based multi-user accounts (login now always on)

Before deploying multi-user accounts (commit `a96a683`), a backup point was made of the last-known-good build (commit `215b9f2` — the opt-in login, which was still inert/off at the time, running live and stable).

**Git tag:** [`pre-rbac-users-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-rbac-users-2026-09-12) at commit `215b9f2`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-rbac-users-20260912-091102/`

⚠️ **This deploy is a real behavior change, not inert** — the app now always requires login. On this restart it seeded a fresh `admin`/`watchtower` account (`<data dir>/users.json`) and immediately started returning 401 to unauthenticated requests. Verified live: `/api/auth/status` → `authEnabled: true, authenticated: false`, `/api/birds/sightings` → 401 without a session. **Log in and change that password immediately** (top-right Account menu once logged in).

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-rbac-users-20260912-091102 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-rbac-users-2026-09-12 -- server.ts src/App.tsx src/components/Navbar.tsx .env.example && git rm -f src/components/AccountModal.tsx && npm run build && pm2 restart watchtower"
```

Note: reverting to the `215b9f2` opt-in-login version leaves `<data dir>/users.json` on disk unused — harmless, but delete it if you want a clean slate (`rm ~/.frigate-guardian/users.json` on the NUC), since if this feature is ever redeployed later it reads that file first rather than re-seeding.

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — Flights map default to Satellite

Trivial one-line change (commit `7014670`) — before deploying, a backup point was made of the last-known-good build (commit `a96a683` — RBAC multi-user accounts, running live and stable at the time).

**Git tag:** [`pre-satellite-default-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-satellite-default-2026-09-12) at commit `a96a683`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-satellite-default-20260912-092030/`

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-satellite-default-20260912-092030 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-satellite-default-2026-09-12 -- src/components/FlightMap.tsx && npm run build && pm2 restart watchtower"
```

After either, confirm it came back up:
```bash
curl -s http://192.168.2.210:8100/api/birds/status
```

---

## 2026-09-12 — BirdNET Gmail/Discord dispatch fix + per-channel alerts

Before deploying (commit `18319b3`), a backup point was made of the last-known-good build (commit `7014670` — Satellite map default, running live and stable at the time).

**Git tag:** [`pre-birdnet-channel-fix-2026-09-12`](https://github.com/jchisholm59/WatchTower/tree/pre-birdnet-channel-fix-2026-09-12) at commit `7014670`

**Build snapshot on the NUC:** `/home/jim/watchtower-backups/dist-pre-birdnet-channel-fix-20260912-102858/`

Fixes BirdNET alerts throwing (and silently failing) on Gmail/Discord because `event.id` from BirdNET-Go is a number, not a string — `!event.id.startsWith('test-')` crashed, invisibly, for both senders. Also adds `birdnet.alertChannels` so bird alerts can target a different channel set than camera alerts. Verified locally end-to-end before deploy (login, toggled Gmail/Slack on, confirmed the channel chips select/deselect correctly and persist via `/api/notifications/settings`) — could not verify against the live instance directly since the login system (working as intended) means only the account holder can drive it.

### To revert

**Fast path — restores the exact build that was running, no rebuild, back in seconds:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && rm -rf dist && cp -r ../watchtower-backups/dist-pre-birdnet-channel-fix-20260912-102858 dist && pm2 restart watchtower"
```

**Full path — also rolls back the source tree to that commit:**
```bash
ssh 192.168.2.210 "cd /home/jim/Frigate-Guardian-Secure && git checkout pre-birdnet-channel-fix-2026-09-12 -- server.ts src/components/NotificationSettingsView.tsx src/types.ts && npm run build && pm2 restart watchtower"
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
