// This exists for personal (Rhea's) testing purposes
// Uses public MQTT broker

const mqtt = require("mqtt");

const broker = "mqtt://broker.hivemq.com";
const topic = "safepass/test/rhea123/waterlevel"; // MUST match publisher exactly

console.log("Starting subscriber...");
const client = mqtt.connect(broker);

client.on("connect", () => {
  console.log("Connected to broker");
  client.subscribe(topic, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed to:", topic);
  });
});

client.on("message", (t, message) => {
  console.log("Message received");
  console.log("Topic:", t);
  console.log("Payload:", message.toString());
});

client.on("error", (err) => {
  console.error("MQTT error:", err);
});
