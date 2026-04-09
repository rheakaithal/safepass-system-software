const mqtt = require("mqtt");
const { MQTT_BROKER_URL, MQTT_OPTIONS, TOPICS, POLES } = require("./config");

const client = mqtt.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

client.on("connect", () => {
  console.log("Connected to test publisher. Sending continuous data...");

  const poleId = POLES[0]; // defaults to first defined pole
  let baseLevel = 1.5; // Starts in SAFE range

  // Send a new reading every 3 seconds
  setInterval(() => {
    // Add random noise between -0.5 and +0.5
    const noise = (Math.random() * 1) - 0.5;
    let newLevel = baseLevel + noise;

    // Keep it realistic 0-20 inches
    if (newLevel < 0) newLevel = 0;
    if (newLevel > 20) newLevel = 20;
    
    // Round to 1 decimal
    newLevel = parseFloat(newLevel.toFixed(1));

    baseLevel = newLevel; // Update base for next drift
    const payload = JSON.stringify({ poleId, level: baseLevel });
    const topic = `${TOPICS.SENSOR_BASE}/${poleId}/waterlevel`;

    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        console.error("Failed to publish:", err);
      } else {
        console.log(`Publishing [${poleId}]: Water Level ${newLevel} in`);
      }
    });

  }, 3000); // 3000ms = 3 seconds
});

process.on("SIGINT", () => {
  console.log("\nStopping continuous test publisher...");
  client.end();
  process.exit();
});
