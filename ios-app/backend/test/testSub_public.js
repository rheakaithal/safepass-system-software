// This exists for personal (Rhea's) 24/7 testing purposes
// Uses public MQTT broker

const mqtt = require("mqtt");

const broker = "mqtt://broker.hivemq.com";
const topic = "safepass/test/rhea123/waterlevel"; // MUST match publisher exactly

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
    region: "Pole 1",
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
