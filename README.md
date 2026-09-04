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

---

## 🛠 Installation & Setup

### Prerequisites
*   A running instance of [Frigate NVR](https://frigate.video/).
*   Node.js v20+ installed on your server.

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/Frigate-Guardian.git
cd Frigate-Guardian
npm install
```

### 2. Configure Secrets
Create a `.env` file in the root directory (use `.env.example` as a template):
```text
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-google-app-password
GMAIL_RECIPIENT=your-alerts-recipient@gmail.com
GEMINI_API_KEY=your-gemini-key
```

### 3. Run for Production (Recommended)
We recommend using **PM2** to keep the sentinel running 24/7 in the background:
```bash
npm run build
pm2 start dist/server.cjs --name frigate-guardian
```

---

## 🔒 Security & Privacy
*   **Local First:** Your passwords and configuration are stored locally in `~/.frigate-guardian` and never uploaded to the cloud.
*   **Encrypted Streams:** Supports HTTPS and secure WebSocket (WSS) for camera intercepts.

---

## 🏗 Built With
*   **Frontend:** React, Tailwind CSS, Lucide Icons, Framer Motion.
*   **Backend:** Node.js, Express, MQTT.js, Nodemailer.
*   **AI:** Google Gemini 1.5 Flash.

---
*Created with ❤️ for the Frigate NVR Community.*
