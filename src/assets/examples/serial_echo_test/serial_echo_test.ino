// Serial echo test for the gcgui Send widget (app -> device direction).
// Upload to Arduino, select the port at 115200, add a "Send" widget, connect.
// Type a message and hit Send (or Enter). The board echoes each
// newline-terminated line back as "ECHO: <line>", visible in Raw Serial.
//
// Also try the widget's "+newline" toggle off: with no trailing newline the
// echo is held back until the next newline arrives, proving the toggle works.

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for USB serial on Leonardo/Micro-style boards
  }
  Serial.println("# serial_echo_test ready. Send a line from the gcgui Send widget.");
}

void loop() {
  static String line = "";

  while (Serial.available() > 0) {
    String c = (String)Serial.read();
    if (c == '\n') {
      Serial.print("ECHO: ");
      Serial.println(line);
      line = "";
    } else if (c != '\r') {
      line += c;
      if (line.length() > 120) {
        // Guard against runaway input with no terminator.
        Serial.print("ECHO: ");
        Serial.println(line);
        line = "";
      }
    }
  }
}
