const mqtt = require("mqtt");
const readline = require("readline");

const client = mqtt.connect("mqtt://broker.hivemq.com");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

client.on("connect", () => {
  console.log("\n==============================================");
  console.log(" 🌊 SAFEPASS INTERACTIVE WATER TESTER 🌊 ");
  console.log("==============================================\n");
  console.log("Type a simulated water level (in cm) to test how");
  console.log("the app responds in real-time.\n");
  console.log("  🛑 > 80 cm = CRITICAL");
  console.log("  ⚠️ > 50 cm = WARNING");
  console.log("  ✅ < 50 cm = SAFE");
  console.log("\nType 'exit' to quit.\n");
  
  promptUser();
});

function promptUser() {
  rl.question("Enter water level: ", (input) => {
    if (input.toLowerCase() === 'exit') {
      console.log("Closing tester...");
      client.end();
      rl.close();
      return;
    }

    const level = parseInt(input, 10);
    if (isNaN(level)) {
      console.log("❌ Please enter a valid number.\n");
      promptUser();
      return;
    }

    const poleId = "Pole-001";
    const payload = JSON.stringify({ poleId, level });
    const topic = `safepass/sensors/${poleId}/waterlevel`;

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("❌ Failed to publish:", err);
      } else {
        console.log(`✅ Sent ${level}cm to ${poleId}! Check your phone/browser.\n`);
      }
      promptUser();
    });
  });
}

client.on("error", (err) => {
  console.log("MQTT Error: ", err);
});
