// Random 3-column CSV test for gcgui (Protocol: CSV).
// Upload to Arduino, select the port at 115200, set Protocol to CSV.
//
// Format expected by src/components/parsers/csvproc.jsx:
//   time_seconds, datapoint_1, datapoint_2
// Example line:
//   12.345, 512, 23.7
//
// Column mapping in the app:
//   col 0 -> "time", col 1 -> "datapoint 1", col 2 -> "datapoint 2"

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    ; // wait for USB serial on Leonardo/Micro-style boards
  }
  randomSeed(analogRead(0));
}

void loop() {
  float t = millis() / 1000.0;          // col 0: time in seconds
  long datapoint1 = random(0, 1024);    // col 1: int 0-1023
  float datapoint2 = random(200, 301) / 10.0; // col 2: float 20.0-30.0

  Serial.print(t, 3);
  Serial.print(", ");
  Serial.print(datapoint1);
  Serial.print(", ");
  Serial.println(datapoint2, 1);

  delay(200); // ~5 Hz
}
