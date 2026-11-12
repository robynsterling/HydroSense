# Hydrosense Real-Time Dashboard

A custom retro-like React website for the ESP32 with DHT11, capacitive soil sensor, OLED, and BLE. 

## Run on Mac in VS Code

1. Install Node.js LTS if needed.
2. Open this folder in VS Code.
3. Use **Terminal → New Terminal**, then run:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually http://localhost:5173/). Start with **Demo adventure** to preview the interface. (The demo's readings are fake)

## Connect Bluetooth

1. Upload your teammate's ESP32 firmware, turn on the ESP32 and ensure Bluetooth advertising is active (`ESP32-Weather`).
2. Open the site in **Chrome or Edge on a Mac** on `http://localhost:5173/` (Web Bluetooth needs a secure context; localhost works).
3. Choose **Bluetooth · ESP32** and click **Connect BLE**.
4. Select `ESP32-Weather` from the browser dialog and allow the connection. The UI subscribes to notifications every time the ESP32 sends them.

Firmware's BLE service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
Firmware's characteristic UUID: `beb5483e-36e1-4688-b7f5-ea07361b26a8`
Payload: `tempC,humidity,heatIndexF,soilPercent` as UTF-8 text, e.g. `24.8,61,77.8,55`.

## Connect FastAPI (optional)

Copy `.env.example` to `.env` (both in project root) and edit to match your backend:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_READINGS_PATH=/readings
```

Select **FastAPI · Backend** in the page. It polls GET every 3 seconds. Accepts JSON fields such as `temperature_c`, `humidity`, `heat_index_f`, `soil_moisture`, plus several aliases, or data inside a `latest` or `reading` object. Your FastAPI backend must also allow CORS from `http://localhost:5173` during local development.


