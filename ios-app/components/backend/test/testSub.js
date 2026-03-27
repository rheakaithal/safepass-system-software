// Uses HiveMQ Cloud broker (Robert's setup)

const mqtt = require("mqtt");

// HiveMQ Cloud broker (TLS)
const broker = "mqtts://83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud:8883";

// MUST match publisher exactly
// Python publishes to: f"sensors/{pole_id}/{waterlevel}"
const topic = "sensors/#"; // wildcard so changing waterlevel still works

const options = {
  username: "Sensor",
  password: "Team13Capstone",
};

console.log("Starting subscriber...");
const client = mqtt.connect(broker, options);

client.on("connect", () => {
  console.log("Connected to broker");
  client.subscribe(topic, { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed to:", topic);
  });
});

client.on("message", (t, message) => {
  console.log("\nMessage received");
  console.log("Topic:", t);
  console.log("Payload:", message.toString());
});

client.on("error", (err) => {
  console.error("MQTT error:", err);
});
