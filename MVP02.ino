#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------- BLE settings ----------
#define SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
BLECharacteristic *pChar;
bool deviceConnected = false;

class ServerCB : public BLEServerCallbacks
{
    void onConnect(BLEServer *) { deviceConnected = true; }
    void onDisconnect(BLEServer *s)
    {
        deviceConnected = false;
        s->startAdvertising(); // lets the phone reconnect
    }
};

// ---------- DHT settings ----------
#define DHT_PIN 4
#define DHT_TYPE DHT11

// ---------- Soil moisture settings ----------
#define SOIL_PIN 34
const int SOIL_DRY_RAW = 3000;
const int SOIL_WET_RAW = 1500;
const int SOIL_SAMPLES = 10;

// ---------- OLED settings ----------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

const unsigned long READ_INTERVAL_MS = 3000;

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
unsigned long lastRead = 0;

int readSoilRaw()
{
    long total = 0;
    for (int i = 0; i < SOIL_SAMPLES; i++)
    {
        total += analogRead(SOIL_PIN);
        delay(10);
    }
    return total / SOIL_SAMPLES;
}

int soilRawToPercent(int raw)
{
    int percent = map(raw, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100);
    return constrain(percent, 0, 100);
}

void setup()
{
    Serial.begin(115200);
    delay(1000);
    dht.begin();
    analogReadResolution(12);
    Wire.begin(21, 22);

    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS))
    {
        Serial.println("OLED not found - check wiring and I2C address.");
        while (true)
        {
            delay(100);
        }
    }
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("Sensors starting...");
    display.display();

    // ---------- Start BLE ----------
    BLEDevice::init("ESP32-Weather");
    BLEServer *server = BLEDevice::createServer();
    server->setCallbacks(new ServerCB());
    BLEService *svc = server->createService(SERVICE_UUID);
    pChar = svc->createCharacteristic(
        CHAR_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pChar->addDescriptor(new BLE2902());
    svc->start();
    BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID);
    BLEDevice::startAdvertising();

    Serial.println("DHT11 + Soil + OLED + BLE starting...");
}

void loop()
{
    unsigned long now = millis();
    if (now - lastRead < READ_INTERVAL_MS)
        return;
    lastRead = now;

    float humidity = dht.readHumidity();
    float tempC = dht.readTemperature();
    float tempF = dht.readTemperature(true);

    int soilRaw = readSoilRaw();
    int soilPercent = soilRawToPercent(soilRaw);

    bool dhtOk = !(isnan(humidity) || isnan(tempC) || isnan(tempF));
    float heatIndexF = dhtOk ? dht.computeHeatIndex(tempF, humidity) : NAN;

    // ---------- Serial Monitor ----------
    if (dhtOk)
    {
        Serial.printf("Humidity: %.0f %% | Temp: %.1f C / %.1f F | Heat index: %.1f F",
                      humidity, tempC, tempF, heatIndexF);
    }
    else
    {
        Serial.print("DHT11 read failed - check wiring and pin");
    }
    Serial.printf("  |  Soil: %d %% (raw %d)\n", soilPercent, soilRaw);

    // ---------- Send over BLE: "tempC,humidity,heatIndexF,soil%" ----------
    if (deviceConnected && dhtOk)
    {
        char buf[48];
        snprintf(buf, sizeof(buf), "%.1f,%.0f,%.1f,%d", tempC, humidity, heatIndexF, soilPercent);
        pChar->setValue(buf);
        pChar->notify();
    }

    // ---------- OLED ----------
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    if (dhtOk)
    {
        display.print("Feels like: ");
        display.print(heatIndexF, 1);
        display.print(" F");
    }
    else
    {
        display.print("DHT11 read failed!");
    }

    display.setTextSize(2);
    display.setCursor(0, 12);
    if (dhtOk)
        display.print(tempF, 1);
    else
        display.print("--");
    display.print(" F");

    display.setCursor(0, 30);
    if (dhtOk)
        display.print(humidity, 0);
    else
        display.print("--");
    display.print(" % RH");

    display.setCursor(0, 48);
    display.print("Soil ");
    display.print(soilPercent);
    display.print("%");

    display.display();
}