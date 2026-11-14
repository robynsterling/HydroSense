# Hydrosense Real-Time Dashboard
HydroSense uses React + Vite for the frontend, FastAPI for the backend, and an ESP32 to collect live sensor readings.

## Run on Windows in VS Code(Git Bash)

1. Open the Project
Open the HydroSense project folder in Visual Studio Code (or your preferred IDE).

Select Terminal → New Terminal and choose Git Bash as the terminal profile.

2. Connect the ESP32
Connect the ESP32 to the laptop using a USB data cable.
Open Arduino IDE and check Tools → Port to identify the correct COM port.
In main.py, update the serial port if necessary:

SERIAL_PORT = "COM6"
BAUD_RATE = 115200

COM6 is the port used during our testing. It may be different on another computer.

Close the Arduino Serial Monitor before starting the API, since only one application can normally access the serial port at a time.

3. Start the FastAPI Backend
From the directory containing main.py, install the required Python packages (first-time setup only):

python -m pip install fastapi uvicorn pyserial

Start the API using:

python -m uvicorn main:app --port 8001

The backend should be accessible at:

http://localhost:8001/api/data

Open that URL in Chrome to verify that the API responds with JSON sensor data.

A "status": "Connected" response indicates that the backend has received valid sensor readings from the ESP32.

Note: If port 8001 is already in use, first check whether the API is already running at the URL above. Do not start a second instance unnecessarily.

4. Start the React Frontend
Open a second Git Bash terminal in VS Code.

From the project root, run:
cd frontend
npm install
npm run dev

npm install is only required during initial setup or when dependencies change.

Open the localhost URL displayed by Vite, typically:
http://localhost:5173/

5. Connect the Website to the API
In the HydroSense dashboard, select API mode.

The frontend is configured to request sensor readings from:

http://localhost:8001/api/data

Keep both terminal processes running while using the application.


NB: Starting HydroSense on Future Sessions
After the initial installation, the normal startup sequence is:
1. Plug in the ESP32 and confirm its COM port.
2. Open Git Bash in the folder containing main.py.
3. Start FastAPI with python -m uvicorn main:app --port 8001.
4. Open another terminal and run cd frontend && npm run dev.
5. Open the website and select API mode.

Important: The frontend and backend must use the same API port. If the configured port changes, update VITE_API_BASE_URL or the frontend’s fallback URL accordingly, then restart Vite.

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
