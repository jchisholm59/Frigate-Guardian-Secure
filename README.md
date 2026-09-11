# 🛡️ Frigate Guardian

**The ULTRALATEST Advanced Surveillance Hub & AI Intelligence Console for Frigate NVR.**

Frigate Guardian is a comprehensive, real-time surveillance dashboard designed to supercharge your Frigate NVR experience. It combines high-performance live monitoring with intelligent background automation, multi-channel alerts, and Google Gemini AI vision assessment.

![Frigate Guardian UI](https://raw.githubusercontent.com/blakeblackshear/frigate/master/web/src/assets/frigate.png) *(Placeholder for your awesome dashboard screenshot)*

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

### 🧠 Advanced AI Filtering & Analysis
*   **Parked Car Logic:** Stop notification fatigue with intelligent filtering for stationary vehicles.
*   **Tactical AI Briefs:** Integrated with **Google Gemini 1.5 Flash** to generate human-readable security assessments of events.
*   **Natural Language Search:** Find specific events using AI-powered search (e.g., *"Show me all the delivery trucks from yesterday morning"*).

### 📐 Configuration & Design Studio
*   **Zone & Mask Designer:** Draw motion masks and detection zones directly on your live feeds.
*   **Instant YAML:** Automatically generate perfectly formatted YAML code to paste into your Frigate `config.yml`.
*   **Stability First:** De-duplicated event list ensures you see a single, real-time row per detection instead of hundreds of updates.

### 🐦 Bioacoustic Yard Intelligence
*   **BirdNET-Go Integration:** Real-time bird species identification via high-fidelity audio analysis.
*   **Live Audio Sentinel:** Listen to your yard in real-time with a built-in frequency spectrogram.
*   **Diversity Report:** Automatic population summary of all species visiting your property.
*   **Audio Proof:** Play back specific bird song recordings directly from your yard history.
*   **Daily Species Sentinel:** Intelligent alerts for the first sighting of each unique species every day, preventing notification fatigue.

### 🌊 Tidal Intelligence (NEW)
*   **CHS Predictions:** Official Canadian Hydrographic Service tide data (DFO IWLS API) — no API key required.
*   **Multi-Station:** Track up to four stations (home, cottage, marina) and switch between them with sub-tabs.
*   **30-Hour Curve:** Live SVG tide curve with a "now" marker, interpolated current height, and high/low markers.
*   **Upcoming Tides:** High & low table plus a "next high/low in Xh Ym" countdown.
*   **Sun & Moon:** Sunrise, sunset, and moon phase computed locally from each station's coordinates.
*   **Tide Alerts:** Optional high/low tide notifications a configurable number of minutes ahead, delivered through your existing Gmail / Slack / Discord channels, plus a live in-app banner.

---

## 🛠 Installation & Setup

### Prerequisites
*   A running instance of [Frigate NVR](https://frigate.video/).
*   Node.js v22+ installed on your server.

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/Frigate-Guardian.git
cd Frigate-Guardian
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
pm2 start dist/server.cjs --name frigate-guardian
```

### 4. Running with Docker (Recommended)
You can also run Frigate Guardian using Docker, which is the recommended way for production deployment.

**Quick Start:**
1.  **Configure environment:** 
    - The IDE will manage your `GEMINI_API_KEY` automatically in the `.env` file.
    - Create a file named `guardian.env` for your custom secrets (use `.env.example` as a template).
2.  **Start the container:**
    ```bash
    docker compose up -d
    ```

The application will be available at `http://localhost:3000`.

**Persistent Data:**
Docker will automatically create a volume to persist your settings:
- `guardian_data`: Persists `notification_settings.json` and `mqtt_config.json` in the `/app/data` directory inside the container.

**Troubleshooting & Maintenance:**
- **View logs:** `docker logs -f frigate-guardian`
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

## 🔒 Security & Privacy
*   **Local First:** Your passwords and configuration are stored locally in `~/.frigate-guardian` and never uploaded to the cloud.
*   **Encrypted Streams:** Supports HTTPS and secure WebSocket (WSS) for camera intercepts.

---

## 🏗 Built With
*   **Frontend:** React, Tailwind CSS, Lucide Icons, Framer Motion.
*   **Backend:** Node.js, Express, MQTT.js, Nodemailer.
*   **AI:** Google Gemini 1.5 Flash.
*   **Data:** BirdNET-Go (MQTT), DFO / Canadian Hydrographic Service IWLS (tides).

---
*Created with ❤️ for the Frigate NVR Community.*
