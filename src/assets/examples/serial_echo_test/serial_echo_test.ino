// Serial echo test for gcgui (app -> device -> app).
// Upload to Arduino, select the port at 115200.
// Every byte received is written straight back out immediately: no
// buffering, no waiting for a newline. Per-key presses from the Key Send
// widget or the Key Button widget echo back instantly.
//
// Note: gcgui's Raw Serial view only renders complete newline-terminated
// lines, so lone echoed chars become visible once a newline arrives. For a
// per-key reply that shows up in the app immediately, use
// key_command_test.ino instead (it answers each key with an ACK line).

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for USB serial on Leonardo/Micro-style boards
  }
  Serial.println("# serial_echo_test ready. Bytes are echoed immediately.");
}

void loop() {
  while (Serial.available() > 0) {
    Serial.write(Serial.read());
  }
}
