// mqttClient.js
const mqtt = require("mqtt");

const broker = "mqtts://83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud:8883";
const topic = "sensors/#";

const options = {
  username: "Sensor",
  password: "Team13Capstone",
};

let onAlert = null;
function registerAlertHandler(cb) {
  onAlert = cb;
}

const client = mqtt.connect(broker, options);

client.on("connect", () => {
  console.log("MQTT connected");
  client.subscribe(topic, { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed to:", topic);
  });
});

client.on("message", (t, message) => {
  console.log("MQTT message received:", t, message.toString());

  const level = Number(message.toString());
  if (Number.isNaN(level)) return;

  let severity = "clear";
  let msg = "Roads clear. Safe to drive.";

  if (level > 6) {
    severity = "critical";
    msg = "Floodwaters present. Road closed for civilian safety.";
  } else if (level > 2.5) {
    severity = "warning";
    msg = "Heavy rain in the area. Drive cautiously.";
  }

  const alert = {
    id: Date.now().toString(),
    region: "Pole 2",
    severity,
    message: msg,
    timestamp: new Date().toISOString(),
  };

  if (onAlert) onAlert(alert);
});

client.on("error", (err) => {
  console.error("MQTT error:", err);
});

module.exports = { registerAlertHandler };
