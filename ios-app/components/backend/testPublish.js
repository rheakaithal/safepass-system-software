const mqtt = require("mqtt");

const client = mqtt.connect("mqtt://broker.hivemq.com");

client.on("connect", () => {
  console.log("Connected to test publisher. Sending continuous data...");

  const poleId = "Pole 1";
  let baseLevel = 45; // Starts in SAFE range

  // Send a new reading every 3 seconds
  setInterval(() => {
    // Randomly fluctuate between -5 and +15 to simulate gradually rising water
    const fluctuation = Math.floor(Math.random() * 20) - 5;
    baseLevel += fluctuation;
    
    // Clamp values between 0 and 100 for safety bounds
    if (baseLevel < 0) baseLevel = 0;
    if (baseLevel > 100) baseLevel = 100;

    const payload = JSON.stringify({ poleId, level: baseLevel });
    const topic = `safepass/sensors/${poleId}/waterlevel`;

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("Failed to publish:", err);
      } else {
        console.log(`Published to ${topic}: ${payload}`);
      }
    });

  }, 3000); // 3000ms = 3 seconds
});

process.on("SIGINT", () => {
  console.log("\nStopping continuous test publisher...");
  client.end();
  process.exit();
});
