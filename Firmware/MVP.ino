/*
  All Sensors: DHT11 + Capacitive Soil Moisture + LCD Display
  Reads temperature, humidity, and soil moisture every 3 seconds, prints
  them to the Serial Monitor, and shows them on a 0.96" SSD1306 OLED (I2C).

  Libraries (Arduino IDE -> Library Manager):
    - "DHT sensor library" by Adafruit
    - "Adafruit SSD1306" by Adafruit
    - "Adafruit GFX Library" by Adafruit

  Wiring:
    DHT11 data -> GPIO 4
    Display LED SDA   -> GPIO 21
    Display LED SCL   -> GPIO 22
    Display LED VCC   -> 5V
    Display LED GND   -> GND
    Soil AOUT  -> GPIO 34
    Soil VCC   -> 3V3
    Soil GND   -> GND

  Serial Monitor: 115200 baud
*/

#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

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
const int SOIL_WET_RAW = 1300;

// Number of analog samples averaged per reading to smooth out ADC noise
const int SOIL_SAMPLES = 10;

// ---------- OLED settings ----------
#define LCD_COLUMNS   16   // OLED width in pixels
#define LCD_ROWS  2    // OLED height in pixels (some 0.91" modules are 32)
#define LCD_ADDRESS   0x27  // Most common I2C 

// How often to take a reading, in milliseconds.
const unsigned long READ_INTERVAL_MS = 1000;

// Create the sensor and display objects
DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);

// Timestamp of the last reading
unsigned long lastRead = 0;
bool lastPage = false;

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
  Wire.setClock(100000);

  // Start the LCD. If it isn't found, print an error and stop.
  Wire.beginTransmission(LCD_ADDRESS);
  if (Wire.endTransmission() !=0) {
    Serial.println("{\"error\": \"LCD not found\"}");
    while (true) { delay(100);}
  }

  // Splash message while waiting for the first reading
  lcd.init();
  lcd.backlight();

  lcd.clear();
  delay(100);

  lcd.setCursor(0, 0);
  lcd.print("Sensors Loading");
  lcd.setCursor(0, 1);
  lcd.print("Please wait...");
  delay(1500);

  lcd.clear();
  Serial.println("{\"System started successfully\":}");
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

 // ---------- send in USB in format JSON ----------
  // Esto es lo que va a leer tu Backend en Python
  Serial.print("{\"temp\": ");
  if (dhtOk) Serial.print(tempF, 1); else Serial.print("null");
  Serial.print(", \"humidity\": ");
  if (dhtOk) Serial.print((int)humidity); else Serial.print("null");
  Serial.print(", \"feelsLike\": ");
  if (dhtOk) Serial.print(heatIndexF, 1); else Serial.print("null");
  Serial.print(", \"soil\": ");
  Serial.print(soilPercent);
  Serial.println("}");

  // ---------- Show on LCD ----------
//Switch screen every 5 seconds
bool showScreen = ((millis()/5000)%2==1);

// Si cambia de pagina cada 5s, limpiamos una sola vez con calma
  if (showScreen != lastPage) {
    lcd.clear();
    delay(20);
    lastPage = showScreen;
  }
  char line0[17];
  char line1[17];

  // screen 1: temperature and humidity
if (!showScreen) {
    lcd.setCursor(0, 0);
    if (dhtOk) {
      lcd.print("Temp: ");
      lcd.print(tempF, 1);
      lcd.print(" F");
    } else {
      lcd.print("Temp: Error");
    }
    lcd.setCursor(0, 1);
    if (dhtOk) {
      lcd.print("Humidity: ");
      lcd.print((int)humidity);
      lcd.print(" %");
    } else {
      lcd.print("Humidity: Error");
    }

 } else {
    // ===== SCREEN 2: Feels Like & Soil Moisture =====
    lcd.setCursor(0, 0);
    if (dhtOk) {
      lcd.print("Feels: ");
      lcd.print(heatIndexF, 1);
      lcd.print(" F");
    } else {
      lcd.print("Feels: Error");
    }
    lcd.setCursor(0, 1);
    lcd.print("Soil Moist: ");
    lcd.print(soilPercent);
    lcd.print("%");
  }
}
  
