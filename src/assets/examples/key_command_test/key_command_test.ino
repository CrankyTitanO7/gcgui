// Per-key command test for the gcgui Key Send widget (app -> device).
// Upload to Arduino, select the port at 115200, add a "Key Send" widget,
// connect, and arm its switch. Each keypress acts immediately (no Enter):
//   1        -> LED on            0        -> LED off
//   w/a/s/d  -> direction ack     ?        -> help
//   Enter    -> OK
//
// Status streams as CSV at 2 Hz for the Number/Graph widgets (CSV protocol):
//   time_s, led_state, last_key_ascii
// e.g. "12.345, 1, 119" means LED on, last key 'w' (ASCII 119).
// ACK lines have no commas, so the CSV parser ignores them; Raw Serial
// still shows everything.

const int LED_PIN = LED_BUILTIN;

int ledState = LOW;
int lastKey = 0;
unsigned long lastStatus = 0;

void printHelp() {
  Serial.println("# key_command_test ready. Arm Key Send and press keys.");
  Serial.println("# 1=LED on, 0=LED off, w/a/s/d=drive, ?=help, Enter=OK");
}

void ack(const char* what) {
  Serial.print("ACK: ");
  Serial.println(what);
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, ledState);
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for USB serial on Leonardo/Micro-style boards
  }
  printHelp();
}

void loop() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    lastKey = (int)c;
    switch (c) {
      case '1':
        ledState = HIGH;
        digitalWrite(LED_PIN, HIGH);
        ack("LED on");
        break;
      case '0':
        ledState = LOW;
        digitalWrite(LED_PIN, LOW);
        ack("LED off");
        break;
      case 'w':
        ack("forward");
        break;
      case 'a':
        ack("left");
        break;
      case 's':
        ack("back");
        break;
      case 'd':
        ack("right");
        break;
      case '?':
        printHelp();
        break;
      case '\n':
        Serial.println("OK");
        break;
      case '\r':
        break; // ignore; Key Send maps Enter to '\n'
      default:
        Serial.print("? ");
        Serial.println(c);
        break;
    }
  }

  unsigned long now = millis();
  if (now - lastStatus >= 500) {
    lastStatus = now;
    Serial.print(now / 1000.0, 3);
    Serial.print(", ");
    Serial.print(ledState == HIGH ? 1 : 0);
    Serial.print(", ");
    Serial.println(lastKey);
  }
}
