/*
 * MFD bezel → USB serial, for the MFD testbench (line protocol, 115200 baud).
 *
 * 20 OSBs + 4 rockers (8 contacts) = 28 inputs. This sketch scans a 7 × 4
 * diode matrix (rows driven LOW one at a time, columns read with pull-ups),
 * debounces, and prints one line per press:
 *     OSB 6
 *     RKR BRT +
 * It also listens for the app's outbound lines (LED <n> <0|1>) to light
 * per-button backlights — wire them to `ledPins` if you have them.
 *
 * Works on any Arduino-compatible board with native USB or a USB-UART
 * (Pro Micro, RP2040, ESP32-S3, Nano…). Adjust pins to your wiring.
 */

const uint8_t ROWS = 7, COLS = 4;
const uint8_t rowPins[ROWS] = {2, 3, 4, 5, 6, 7, 8};
const uint8_t colPins[COLS] = {9, 10, 16, 14};

// what each matrix position means — edit to match your wiring
const char* keymap[ROWS][COLS] = {
  {"OSB 1",  "OSB 2",  "OSB 3",  "OSB 4"},
  {"OSB 5",  "OSB 6",  "OSB 7",  "OSB 8"},
  {"OSB 9",  "OSB 10", "OSB 11", "OSB 12"},
  {"OSB 13", "OSB 14", "OSB 15", "OSB 16"},
  {"OSB 17", "OSB 18", "OSB 19", "OSB 20"},
  {"RKR GAIN +", "RKR GAIN -", "RKR SYM +", "RKR SYM -"},
  {"RKR BRT +",  "RKR BRT -",  "RKR CON +", "RKR CON -"},
};

const unsigned long DEBOUNCE_MS = 25;
bool stable[ROWS][COLS];
bool lastRead[ROWS][COLS];
unsigned long changedAt[ROWS][COLS];
String rx;

void setup() {
  Serial.begin(115200);
  for (uint8_t r = 0; r < ROWS; r++) { pinMode(rowPins[r], OUTPUT); digitalWrite(rowPins[r], HIGH); }
  for (uint8_t c = 0; c < COLS; c++) pinMode(colPins[c], INPUT_PULLUP);
}

void handleLine(const String& line) {
  // e.g. "LED 6 1" — drive a backlight here if fitted
  if (line.startsWith("LED ")) {
    int sp = line.indexOf(' ', 4);
    int osb = line.substring(4, sp).toInt();
    bool on = line.substring(sp + 1).toInt() == 1;
    (void)osb; (void)on; // digitalWrite(ledPins[osb - 1], on);
  }
}

void loop() {
  unsigned long now = millis();
  for (uint8_t r = 0; r < ROWS; r++) {
    digitalWrite(rowPins[r], LOW);
    delayMicroseconds(5);
    for (uint8_t c = 0; c < COLS; c++) {
      bool down = digitalRead(colPins[c]) == LOW;
      if (down != lastRead[r][c]) { lastRead[r][c] = down; changedAt[r][c] = now; }
      if (down != stable[r][c] && now - changedAt[r][c] > DEBOUNCE_MS) {
        stable[r][c] = down;
        if (down) Serial.println(keymap[r][c]);   // act on press, not release
      }
    }
    digitalWrite(rowPins[r], HIGH);
  }
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n') { handleLine(rx); rx = ""; }
    else if (ch != '\r' && rx.length() < 64) rx += ch;
  }
}
