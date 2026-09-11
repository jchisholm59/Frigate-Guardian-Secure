# 🗼 WatchTower

**The ULTRALATEST Advanced Surveillance Hub & AI Intelligence Console for Frigate NVR.**

WatchTower is a comprehensive, real-time surveillance dashboard designed to supercharge your Frigate NVR experience. It combines high-performance live monitoring with intelligent background automation, multi-channel alerts, and Google Gemini AI vision assessment.

![WatchTower UI](https://raw.githubusercontent.com/blakeblackshear/frigate/master/web/src/assets/frigate.png) *(Placeholder for your awesome dashboard screenshot)*

---

## 🙏 Built On

WatchTower is a console layered on top of other people's excellent work — it doesn't replace or reimplement them:

*   **[Frigate NVR](https://frigate.video/)** by [Blake Blackshear](https://github.com/blakeblackshear) — the open-source NVR and object-detection engine that does all the actual camera processing, recording, and detection.
*   **[BirdNET-Go](https://github.com/tphakala/birdnet-go)** by [Tomi Hakala](https://github.com/tphakala) — the real-time bioacoustic bird identification engine behind the Bioacoustic Yard Intelligence features.

If you find WatchTower useful, consider starring and supporting those projects directly.

---

## ✨ Key Features

### 🚀 Real-Time Tactical Hub
*   **High-Speed Grid:** Monitor all your Frigate camera feeds in a low-latency MJPEG grid.
*   **Live Heartbeat:** Real-time MQTT connection status with visual "Green Light" confirmation.
*   **Dynamic Telemetry:** Live tracking of CPU usage, Coral TPU inference speeds, and system uptime directly from your NVR.

### 📧 Intelligent Background Notifications
*   **Persistent Sentinel:** Alerts are processed server-side. Receive notifications even when your browser is closed.
*   **Visual Gmail Alerts:** Receive high-resolution snapshots of detected objects embedded directly in your emails.
*   **One-Click Action:** Every alert (Gmail, Discord, Slack) includes a direct link to "View Event Recording" via your Tailscale or local network.
*   **Multi-Channel Support:** Native support for Gmail (SMTP), Discord Webhooks (with image uploads), and Slack Incoming Webhooks.
*   **Per-Camera Control:** Mute notifications for individual cameras without affecting recording or the Review feed.

### 🧠 Advanced AI Filtering & Analysis
*   **Parked Car Logic:** Stop notification fatigue with intelligent filtering for stationary vehicles.
*   **Tactical AI Briefs:** Integrated with **Google Gemini 1.5 Flash** to generate human-readable security assessments of events.
*   **Natural Language Search:** Find specific events using AI-powered search (e.g., *"Show me all the delivery trucks from yesterday morning"*).

### 📐 Configuration & Design Studio
*   **Zone & Mask Designer:** Draw motion masks and detection zones directly on your live feeds.
*   **Instant YAML:** Automatically generate perfectly formatted YAML code to paste into your Frigate `config.yml`.
*   **Stability First:** De-duplicated event list ensures you see a single, real-time row per detection instead of hundreds of updates.

### 🎬 Reliable Clip Playback
*   **Automatic Transcoding:** H.265/HEVC event clips (common on newer 4K cameras) are transcoded to browser-compatible H.264 on the fly — Firefox/Chrome can't decode HEVC natively.
*   **Hardware Acceleration:** Uses Intel Quick Sync (VAAPI) when available, with automatic fallback to software encoding.
*   **Clip Caching:** Transcoded clips are cached, so replaying the same event is instant after the first view.

### 🐦 Bioacoustic Yard Intelligence
*   **BirdNET-Go Integration:** Real-time bird species identification via high-fidelity audio analysis.
*   **Live Audio Sentinel:** Listen to your yard in real-time with a built-in frequency spectrogram.
*   **Diversity Report:** Automatic population summary of all species visiting your property.
*   **Audio Proof:** Play back specific bird song recordings directly from your yard history.
*   **Daily Species Sentinel:** Intelligent alerts for the first sighting of each unique species every day, preventing notification fatigue.

### 🌊 Tidal Intelligence
*   **CHS Predictions:** Official Canadian Hydrographic Service tide data (DFO IWLS API) — no API key required.
*   **Multi-Station:** Track up to four stations (home, cottage, marina) and switch between them with sub-tabs.
*   **30-Hour Curve:** Live SVG tide curve with a "now" marker, interpolated current height, and high/low markers.
*   **Upcoming Tides:** High & low table plus a "next high/low in Xh Ym" countdown.
*   **Sun & Moon:** Sunrise, sunset, and moon phase computed locally from each station's coordinates.
*   **Tide Alerts:** Optional high/low tide notifications a configurable number of minutes ahead, delivered through your existing Gmail / Slack / Discord channels, plus a live in-app banner.

### ✈️ Live Air Traffic
*   **PiAware / dump1090-fa Integration:** Live aircraft positions from your own local ADS-B receiver — no third-party tracking service required.
*   **300nm Range Map:** Street, Satellite, and Topographic layers, centered on your home with 50nm range rings and a one-click 2x zoom for the traffic cluster overhead.
*   **Flight Table:** Altitude, speed, heading, squawk, and distance from home for every aircraft currently in range.
*   **Aircraft Detail:** Click any plane for its photo, type, registration, and origin/destination — sourced from free community APIs (adsbdb.com, planespotters.net), with optional departure/arrival times via a free registered OpenSky Network API client.

### 🌤 Weather
*   **Current Conditions:** Temperature, feels-like, humidity, wind, pressure, and precipitation for your home location.
*   **7-Day Forecast:** Daily highs/lows, precipitation chance, and sunrise/sunset — no API key required (Open-Meteo).

---

## 🛠 Installation & Setup

### Prerequisites
*   A running instance of [Frigate NVR](https://frigate.video/).
*   Node.js v22+ installed on your server.
*   `ffmpeg` (and `ffprobe`) installed and on `PATH` — required for clip transcoding and BirdNET-Go live audio.

### 1. Clone & Install
```bash
git clone https://github.com/jchisholm59/WatchTower.git
cd WatchTower
npm install
```

### 2. Configure Secrets
Create your environment files in the root directory (use `.env.example` as a template).

> [!IMPORTANT]
> To prevent AI development environments from overwriting your custom settings, this project uses two environment files:
> 1.  **.env**: Managed automatically by the IDE (stores your `GEMINI_API_KEY`).
> 2.  **guardian.env**: Created by you for all other secrets (Gmail, Slack, Discord, etc.).

**Example `guardian.env`:**
```text
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-google-app-password
GMAIL_RECIPIENT=your-alerts-recipient@gmail.com
# GEMINI_API_KEY is handled in .env
```

### 3. Run for Production (Recommended)
We recommend using **PM2** to keep the sentinel running 24/7 in the background:
```bash
npm run build
pm2 start dist/server.cjs --name watchtower
```

### 4. Running with Docker (Recommended)
You can also run WatchTower using Docker, which is the recommended way for production deployment. It also supports Intel Quick Sync (VAAPI) hardware-accelerated clip transcoding when `/dev/dri` is available.

**Quick Start:**
1.  **Configure environment:** 
    - The IDE will manage your `GEMINI_API_KEY` automatically in the `.env` file.
    - Create a file named `guardian.env` for your custom secrets (use `.env.example` as a template).
2.  **Start the container:**
    ```bash
    docker compose up -d --build
    ```

The application will be available at `http://localhost:8100` (configurable via the `PORT` environment variable in `docker-compose.yml`).

**Persistent Data:**
Docker will automatically create a volume to persist your settings:
- `guardian_data`: Persists `notification_settings.json`, `mqtt_config.json`, and the transcoded clip cache in the `/app/data` directory inside the container.

**Troubleshooting & Maintenance:**
- **View logs:** `docker compose logs -f`
- **Restart:** `docker compose restart`
- **Full Reset (Wipes all settings & credentials):**
  If you want to perform a truly clean install and wipe all persisted settings from the Docker volume:
  ```bash
  docker compose down -v
  docker compose up -d --build
  ```

---

## 🐦 BirdNET-Go Setup
To enable bird song identification, go to **Notifications -> BirdNET-Go** in the dashboard:
1.  **Enable Integration:** Toggle the switch to ON.
2.  **MQTT Broker:** Provide the IP of the broker BirdNET-Go is publishing to.
3.  **MQTT Topic:** Set to your sightings topic (default: `birdnet-sightings`).
4.  **Web URL:** Enter your BirdNET-Go web interface address (e.g., `http://192.168.2.210:8080`) to enable audio clip playback.
5.  **Live Audio:** Enter the RTSP URL of your yard microphone to enable the live spectrogram.
6.  **Daily Alerts:** Toggle "Daily Species Sentinel" to receive notifications for the first detection of each species every day.

---

## 🌊 Tides Setup
Tide predictions come from the public **DFO / Canadian Hydrographic Service** IWLS API — no key or account needed. In the dashboard, go to **Notifications -> Tides**:
1.  **Enable Integration:** Toggle the switch to ON.
2.  **Add Stations:** Search by name or 5-digit CHS code (e.g. `Halifax`, `Digby`, `00490`) and add up to four.
3.  **Units:** Choose metres or feet.
4.  **Tide Alerts (optional):** Toggle on, set how many minutes ahead to notify, pick high and/or low tide, and choose which channels carry them. Alerts reuse the webhook URLs / SMTP credentials from the Gmail, Slack, and Discord tabs.

Predictions are cached server-side for 10 minutes. The **Tides** tab shows the curve, upcoming tides, and sun/moon panel for each configured station. Requires outbound HTTPS to `api-iwls.dfo-mpo.gc.ca`.

---

## ✈️ Flights Setup
Live air traffic requires a local **PiAware** or **dump1090-fa** ADS-B receiver on your network (a Raspberry Pi + RTL-SDR dongle is the common setup). In the dashboard, go to **Notifications -> Flights**:
1.  **Enable Integration:** Toggle the switch to ON.
2.  **PiAware Receiver Address:** Just the IP (e.g. `192.168.1.x`) — WatchTower fills in the standard `/skyaware/data/aircraft.json` path. A full URL also works for non-default installs. Use **Test Connection** to confirm it's reachable.
3.  **Home Coordinates:** Enter your latitude/longitude to center the map and range rings.
4.  **OpenSky Network (optional):** For departure/arrival times, register a free API client at [opensky-network.org](https://opensky-network.org/) and paste the Client ID/Secret in. Without it, you still get aircraft photos and routes for scheduled flights, just no timing data.

The **Flights** tab polls the receiver every few seconds — no data leaves your network except the on-demand aircraft photo/route lookups (adsbdb.com, planespotters.net, optionally OpenSky) when you click a specific plane.

---

## 🌤 Weather Setup
Uses [Open-Meteo](https://open-meteo.com/) — free, no API key or account needed. In the dashboard, go to **Notifications -> Weather**:
1.  **Enable Integration:** Toggle the switch to ON.
2.  **Home Coordinates:** Enter your latitude/longitude (the same values as Tides/Flights, if configured).

The **Weather** tab refreshes every 10 minutes, matching the server-side cache.

---

## 🔒 Security & Privacy
*   **Local First:** Your passwords and configuration are stored locally in `~/.frigate-guardian` (or `/app/data` under Docker) and never uploaded to the cloud.
*   **Encrypted Streams:** Supports HTTPS and secure WebSocket (WSS) for camera intercepts.

---

## 🏗 Built With
*   **Frontend:** React, Tailwind CSS, Lucide Icons, Framer Motion, Leaflet.
*   **Backend:** Node.js, Express, MQTT.js, Nodemailer, FFmpeg.
*   **AI:** Google Gemini 1.5 Flash.
*   **Data:** [Frigate NVR](https://frigate.video/) by Blake Blackshear, [BirdNET-Go](https://github.com/tphakala/birdnet-go) (MQTT) by Tomi Hakala, DFO / Canadian Hydrographic Service IWLS (tides), OpenStreetMap / Esri / OpenTopoMap (map tiles), [adsbdb.com](https://www.adsbdb.com/), [planespotters.net](https://www.planespotters.net/) and [OpenSky Network](https://opensky-network.org/) (flight & aircraft lookups), [Open-Meteo](https://open-meteo.com/) (weather).

---
*Created with ❤️ for the Frigate NVR Community.*
