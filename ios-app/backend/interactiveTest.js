const mqtt = require("mqtt");
const readline = require("readline");
const { spawn } = require("child_process");
const path = require("path");

// Auto-start the subscriber server in the background
const subscriberPath = path.join(__dirname, "subscriber.js");
const subscriberProcess = spawn("node", [subscriberPath], {
  stdio: "pipe" // Capture logs to filter out noisy payloads
});

let backendConnected = false;

subscriberProcess.stdout.on("data", (data) => {
  const line = data.toString();
  if (line.includes("Push Notifications | Expo API") || line.includes("Registered Push Device")) {
    process.stdout.write("\n📡 [Backend] " + line);
  }
  
  // Wait to prompt the user until the backend subscriber actually connects to MQTT
  if (line.includes("MQTT connected to broker") && !backendConnected) {
    backendConnected = true;
    console.log("🟢 Backend Subscriber Online!\n");
    promptUser();
  }
});

console.log("\n▶️  Auto-started subscriber.js backend server in the background.");

// Ensure we kill the backend server when this tester is closed
process.on("exit", () => subscriberProcess.kill());
process.on("SIGINT", () => {
  subscriberProcess.kill();
  process.exit();
});

const client = mqtt.connect("mqtt://broker.hivemq.com");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

client.on("connect", () => {
  client.subscribe("safepass/tokens", { qos: 1 });
  console.log("\n==============================================");
  console.log(" 🌊 SAFEPASS INTERACTIVE WATER TESTER 🌊 ");
  console.log("==============================================\n");
  console.log("Type a simulated water level (in inches) to test how");
  console.log("the app responds in real-time.\n");
  console.log("Format: [Level] (defaults to Pole 1) or [Pole] [Level] (e.g. '2 6.5')\n");
  console.log("  🛑 >= 6 in = CRITICAL");
  console.log("  ⚠️ >= 2 in = WARNING");
  console.log("  ✅ < 2 in = SAFE\n");
  console.log("⚠️  Please open the Mobile App and wait for '📱 Push Device Connected' before sending data!\n");
  console.log("Type 'exit' to quit.\n");
  console.log("⏳ Waiting for background server to boot...");
});

function promptUser() {
  rl.question("Enter level (or 'Pole Level', e.g. '2 6.5'): ", (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log("Closing tester and shutting down backend server...");
      subscriberProcess.kill();
      client.end();
      rl.close();
      return;
    }

    const parts = input.trim().split(/\s+/);
    let poleId = "Pole 1";
    let level = NaN;

    if (parts.length === 1) {
      level = parseFloat(parts[0]);
    } else if (parts.length >= 2) {
      const poleNum = parseInt(parts[0], 10);
      if (poleNum !== 1 && poleNum !== 2) {
        console.log("❌ Invalid Pole! Our system currently only supports Pole 1 or Pole 2.\n");
        promptUser();
        return;
      }
      poleId = `Pole ${poleNum}`;
      level = parseFloat(parts[1]);
    }

    if (isNaN(level)) {
      console.log("❌ Invalid format. Try just a number like '4.5' or format '2 4.5'.\n");
      promptUser();
      return;
    }
    const payload = JSON.stringify({ poleId, level });
    const topic = `safepass/sensors/${poleId}/waterlevel`;

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ Failed to publish:", err);
      } else {
        console.log(`\n✅ Sent ${level} in to ${poleId}! Check your phone/browser.\n`);
      }
      promptUser();
    });
  });
}

client.on("error", (err) => {
  console.log("MQTT Error: ", err);
});

client.on("message", (topic, message) => {
  if (topic === "safepass/tokens") {
    console.log("\n📱 Push Device Connected! You can now trigger alerts.");
  }
});
