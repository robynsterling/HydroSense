import serial
import json
import threading
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="HydroSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

latest_data = {
    "temp": None,
    "humidity": None,
    "feelsLike": None,
    "soil": 0,
    "status": "Connecting to ESP32..."
}

SERIAL_PORT = "COM6"
BAUD_RATE = 115200

def read_serial_loop():
    global latest_data
    while True:
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
            print(f"-> CONNECTED successfully to ESP32 on {SERIAL_PORT}")
            
            while True:
                if ser.in_waiting > 0:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line.startswith("{") and line.endswith("}"):
                        try:
                            data = json.loads(line)
                            # Solo actualizamos si contiene los datos de los sensores
                            if "soil" in data:
                                latest_data = data
                                latest_data["status"] = "Connected"
                        except json.JSONDecodeError:
                            pass
                time.sleep(0.05)
                
        except Exception as e:
            latest_data["status"] = f"Disconnected: {e}"
            time.sleep(2)

thread = threading.Thread(target=read_serial_loop, daemon=True)
thread.start()

@app.get("/api/data")
def get_sensor_data():
    return latest_data

@app.get("/")
def home():
    return {"message": "API HydroSense functioning"}
