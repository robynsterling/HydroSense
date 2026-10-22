/*
  All Sensors: DHT11 + Capacitive Soil Moisture + OLED Display
  Reads temperature, humidity, and soil moisture every 3 seconds, prints
  them to the Serial Monitor, and shows them on a 0.96" SSD1306 OLED (I2C).

  Libraries (Arduino IDE -> Library Manager):
    - "DHT sensor library" by Adafruit
    - "Adafruit SSD1306" by Adafruit
    - "Adafruit GFX Library" by Adafruit

  Wiring:
    DHT11 data -> GPIO 4
    OLED SDA   -> GPIO 21
    OLED SCL   -> GPIO 22
    OLED VCC   -> 3V3
    OLED GND   -> GND
    Soil AOUT  -> GPIO 34
    Soil VCC   -> 3V3
    Soil GND   -> GND

  Serial Monitor: 115200 baud
*/

#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ---------- DHT settings ----------
#define DHT_PIN   4        // GPIO (D4) the sensor's data pin is connected to
#define DHT_TYPE  DHT11    // Sensor model

// ---------- Soil moisture settings ----------
// GPIO 34 is on ADC1, which keeps working when Wi-Fi is on (ADC2 pins don't).
// It is input-only, which is all an analog sensor needs.
#define SOIL_PIN  34

// Calibration: raw readings with the probe in dry air and in a cup of water.
// The sensor reads HIGHER when dry and LOWER when wet. Replace these with
// the raw values printed in the Serial Monitor (see README).
const int SOIL_DRY_RAW = 3000;
const int SOIL_WET_RAW = 1500;

// Number of analog samples averaged per reading to smooth out ADC noise
const int SOIL_SAMPLES = 10;

// ---------- OLED settings ----------
#define SCREEN_WIDTH   128   // OLED width in pixels
#define SCREEN_HEIGHT  64    // OLED height in pixels (some 0.91" modules are 32)
#define OLED_RESET     -1    // No reset pin on these modules, so share the ESP32 reset
#define OLED_ADDRESS   0x3C  // Most common I2C address (try 0x3D if the screen stays blank)

// How often to take a reading, in milliseconds.
const unsigned long READ_INTERVAL_MS = 3000;

// Create the sensor and display objects
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Timestamp of the last reading
unsigned long lastRead = 0;

// Averages several analog reads so one noisy sample doesn't skew the result
int readSoilRaw() {
  long total = 0;
  for (int i = 0; i < SOIL_SAMPLES; i++) {
    total += analogRead(SOIL_PIN);
    delay(10);
  }
  return total / SOIL_SAMPLES;
}

// Converts a raw reading to 0-100 %, using the calibration values above
int soilRawToPercent(int raw) {
  int percent = map(raw, SOIL_DRY_RAW, SOIL_WET_RAW, 0, 100);
  // Constrain the result to 0-100 % in case the reading is outside the calibration range
  return constrain(percent, 0, 100);
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  dht.begin();

  // 12-bit readings (0-4095) for the soil sensor
  analogReadResolution(12);

  // Start I2C on the ESP32's default pins (SDA = 21, SCL = 22)
  Wire.begin(21, 22);

  // Start the OLED. If it isn't found, print an error and stop.
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("OLED not found - check wiring and I2C address.");
    while (true) { delay(100); }
  }

  // Splash message while waiting for the first reading
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Sensors starting...");
  display.display();   // Nothing appears on screen until display() is called

  Serial.println("DHT11 + Soil Moisture + OLED starting...");
}

void loop() {
  // ---------- Non-blocking timer ----------
  unsigned long now = millis();
  if (now - lastRead < READ_INTERVAL_MS) {
    return;
  }
  lastRead = now;

  // ---------- Read the sensors ----------
  float humidity = dht.readHumidity();
  float tempC    = dht.readTemperature();
  float tempF    = dht.readTemperature(true);

  int soilRaw     = readSoilRaw();
  int soilPercent = soilRawToPercent(soilRaw);

  // A failed DHT read shouldn't hide the soil reading, so keep going either way
  bool dhtOk = !(isnan(humidity) || isnan(tempC) || isnan(tempF));
  float heatIndexF = dhtOk ? dht.computeHeatIndex(tempF, humidity) : NAN;

  // ---------- Print to Serial Monitor ----------
  if (dhtOk) {
    Serial.print("Humidity: ");
    Serial.print(humidity, 0);
    Serial.print(" %  |  Temp: ");
    Serial.print(tempC, 1);
    Serial.print(" C / ");
    Serial.print(tempF, 1);
    Serial.print(" F  |  Heat index: ");
    Serial.print(heatIndexF, 1);
    Serial.print(" F");
  } else {
    Serial.print("DHT11 read failed - check wiring and pin");
  }
  Serial.print("  |  Soil: ");
  Serial.print(soilPercent);
  Serial.print(" % (raw ");
  Serial.print(soilRaw);
  Serial.println(")");

  // ---------- Show on OLED ----------
  display.clearDisplay();          // Wipe the previous frame

  // Top line: heat index, or an error if the DHT failed (small text)
  display.setTextSize(1);
  display.setCursor(0, 0);
  if (dhtOk) {
    display.print("Feels like: ");
    display.print(heatIndexF, 1);
    display.print(" F");
  } else {
    display.print("DHT11 read failed!");
  }

  // Temperature (big text)
  display.setTextSize(2);
  display.setCursor(0, 12);
  if (dhtOk) {
    display.print(tempF, 1);
  } else {
    display.print("--");
  }
  display.print(" F");

  // Humidity (big text)
  display.setCursor(0, 30);
  if (dhtOk) {
    display.print(humidity, 0);
  } else {
    display.print("--");
  }
  display.print(" % RH");

  // Soil moisture (big text)
  display.setCursor(0, 48);
  display.print("Soil ");
  display.print(soilPercent);
  display.print("%");

  display.display();               // Push everything to the screen
}