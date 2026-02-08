/**
 * Relay: Website (frontend) <-> this server <-> ESP32 (USB serial OR remote WebSocket).
 * Run: npm run ws-server
 *
 * Mode 1 – USB serial (ESP32 plugged into this computer):
 *   Set in .env.local: SERIAL_PORT=/dev/cu.wchusbserial10  (Mac) or COM3 (Windows)
 *   Optional: SERIAL_BAUD=115200
 *
 * Mode 2 – Remote WebSocket (ESP32 on another computer’s network/WebSocket):
 *   Set in .env.local: ESP32_WS_URL=ws://192.168.1.XX:81
 */
const WebSocket = require("ws");

const PROXY_PORT = Number(process.env.WS_PROXY_PORT) || 8080;
const SERIAL_PATH = process.env.SERIAL_PORT?.trim();
const SERIAL_BAUD = Number(process.env.SERIAL_BAUD) || 115200;
const esp32Address = process.env.ESP32_WS_URL?.trim();

const useSerial = Boolean(SERIAL_PATH);
let wss;
let serialPort = null;
let espSocket = null;

function broadcastToBrowsers(obj) {
  const msg = JSON.stringify(obj);
  if (!wss) return;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function isHardwareReady() {
  if (useSerial) return serialPort?.isOpen === true;
  return espSocket && espSocket.readyState === WebSocket.OPEN;
}

function sendToHardware(data) {
  if (useSerial && serialPort?.isOpen) {
    serialPort.write(data + "\n");
    return true;
  }
  if (!useSerial && espSocket?.readyState === WebSocket.OPEN) {
    espSocket.send(data);
    return true;
  }
  return false;
}

// ---- Serial (USB) mode ----
function connectSerial() {
  if (!SERIAL_PATH) return;
  const { SerialPort } = require("serialport");
  serialPort = new SerialPort({ path: SERIAL_PATH, baudRate: SERIAL_BAUD });

  serialPort.on("open", () => {
    console.log("Connected to ESP32 via USB on", SERIAL_PATH);
    broadcastToBrowsers({ type: "hardware_ready" });
  });

  serialPort.on("error", (err) => {
    console.error("Serial error:", err.message);
    console.log("HINT: Close Arduino IDE Serial Monitor if it is open.");
  });

  serialPort.on("close", () => {
    console.log("Serial port closed. Reconnect the device and restart the server.");
    broadcastToBrowsers({ type: "hardware_lost" });
  });
}

// ---- WebSocket (remote) mode ----
function connectToHardware() {
  if (!esp32Address) return;
  espSocket = new WebSocket(esp32Address);

  espSocket.on("open", () => {
    console.log("Connected to ESP32 at", esp32Address);
    broadcastToBrowsers({ type: "hardware_ready" });
  });

  espSocket.on("error", (err) => {
    console.log("Hardware connection error:", err.message);
  });

  espSocket.on("close", (code, reason) => {
    console.log("Hardware disconnected. Retrying in 5s...");
    broadcastToBrowsers({ type: "hardware_lost" });
    setTimeout(connectToHardware, 5000);
  });
}

// ---- WebSocket server for website ----
wss = new WebSocket.Server({ port: PROXY_PORT });

if (useSerial) {
  connectSerial();
  console.log("WebSocket server on port", PROXY_PORT, "| Serial:", SERIAL_PATH, "@", SERIAL_BAUD);
} else if (esp32Address) {
  connectToHardware();
  console.log("WebSocket server on port", PROXY_PORT, "| ESP32:", esp32Address);
} else {
  console.log("WebSocket server on port", PROXY_PORT);
  console.log("Set SERIAL_PORT (USB) or ESP32_WS_URL (remote) in .env.local to connect to hardware.");
}

wss.on("connection", (ws) => {
  console.log("Website connected");
  if (isHardwareReady()) {
    ws.send(JSON.stringify({ type: "hardware_ready" }));
  }

  ws.on("message", (message) => {
    const data = message.toString();
    if (sendToHardware(data)) {
      console.log("Relaying to hardware:", data);
    } else {
      console.log("Dropped (hardware not connected):", data);
    }
  });
});
