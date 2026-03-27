// MQTT processor: Subscribes to raw sensor data and publishes processed alerts
const mqtt = require("mqtt");

// Connect to HiveMQ broker
const client = mqtt.connect("mqtt://broker.hivemq.com");

// Classification logic
function classify(level) {
  if (level > 80) return "CRITICAL";
  if (level > 50) return "WARNING";
  return "SAFE";
}

client.on("connect", () => {
  console.log("MQTT connected to broker");
  // Subscribe to raw sensor data
  client.subscribe("safepass/sensors/+/waterlevel", { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed to: safepass/sensors/+/waterlevel");
  });
});

client.on("message", (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    const alert = {
      poleId: data.poleId,
      level: data.level,
      status: classify(data.level),
      timestamp: Date.now(),
    };

    console.log("Publishing alert:", alert);

    // Publish processed alert to alerts topic
    client.publish("safepass/alerts", JSON.stringify(alert), { qos: 1 });
  } catch (err) {
    console.error("Error processing message:", err);
  }
});

client.on("error", (err) => {
  console.error("MQTT error:", err);
});
