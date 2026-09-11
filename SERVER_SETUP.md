# 🛠 Running WatchTower on a Linux Server

To run this application in the background so it stays alive after you log out of your server, use one of the following methods.

---

## 🚀 Option 1: Using PM2 (Recommended)
PM2 is a professional process manager. it will keep the app running forever and restart it automatically if the server reboots.

1.  **Install PM2 globally:**
    ```bash
    sudo npm install -g pm2
    ```

2.  **Build and Start (Production Mode):**
    Production mode is much more stable and faster for a server than `npm run dev`.
    ```bash
    # Step 1: Create the optimized build
    npm run build

    # Step 2: Start the server with PM2
    pm2 start dist/server.cjs --name watchtower
    ```

    **Alternative: Start without building (using TS directly):**
    If you prefer not to build, use `tsx` to run the typescript file:
    ```bash
    pm2 start "npx tsx server.ts" --name watchtower
    ```

3.  **Manage the process:**
    - `pm2 status` - See if it's running.
    - `pm2 logs watchtower` - View live logs (useful for debugging alerts).
    - `pm2 restart watchtower` - Restart the app.
    - `pm2 stop watchtower` - Stop the app.

    *If you have an existing process still running under the old `frigate-guardian` name, either keep using that name or `pm2 delete frigate-guardian` and start fresh with `--name watchtower`.*

4.  **Keep it running after a reboot:**
    ```bash
    pm2 save
    pm2 startup
    ```

---

## 🧠 Local AI Support (Ollama)
WatchTower supports **local AI** using Ollama. This allows for unlimited, private, and fast event summaries and searches without needing a Google API key.

1.  **Install Ollama** on your server: [ollama.com](https://ollama.com)
2.  **Pull a model** (we recommend `llama3` or `mistral`):
    ```bash
    ollama pull llama3
    ```
3.  **Update your .env file** in the project folder:
    ```text
    OLLAMA_URL=http://localhost:11434
    OLLAMA_MODEL=llama3
    ```
4.  **Restart the server:**
    ```bash
    pm2 restart watchtower
    ```
    *If no OLLAMA_URL is provided, the system will automatically fall back to Gemini.*

---

## 📺 Option 2: Using Screen (The Quick Way)
If you don't want to install extra tools, use `screen` to create a virtual terminal.

1.  **Start a new screen session:**
    ```bash
    screen -S watchtower
    ```

2.  **Run the app inside the screen:**
    ```bash
    npm run dev
    ```

3.  **Detach from the screen:**
    Press `Ctrl + A` then `D`. 
    *The app is now running in the background. You can safely log out.*

4.  **Re-attach later:**
    When you log back in, type:
    ```bash
    screen -r watchtower
    ```

---

## ⚠️ Important Note on Data
Your settings (MQTT, Gmail, etc.) are stored in `~/.frigate-guardian/` (this internal storage path is unchanged by the WatchTower rename, so existing settings carry over automatically). 
- These files are permanent and will be used by the app regardless of whether you run it via PM2 or Screen.
- Make sure the user running the app has permission to write to their home directory.

## 🎞 Why did `nohup` fail for feeds?
Development servers like Vite often require an active terminal to manage the complex proxying required for video streams. Detaching them with `nohup` can break the "pipe" that carries the MJPEG data. PM2 and Screen solve this by providing a stable environment for those streams.
