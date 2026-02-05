const mqtt = require("mqtt");

const broker = "mqtt://broker.hivemq.com";
const topic = "safepass/test/rhea123/waterlevel";

let alertCallback = null;

function onNewAlert(cb) {
  alertCallback = cb;
}

const client = mqtt.connect(broker);

client.on("connect", () => {
  client.subscribe(topic);
});

client.on("message", (_, message) => {
  const level = Number(message.toString());

  let severity = "clear";
  let msg = "Roads clear. Safe to drive.";

  if (level > 80) {
    severity = "critical";
    msg = "Floodwaters present. Road closed for civilian safety.";
  } else if (level > 60) {
    severity = "warning";
    msg = "Heavy rain in the area. Drive cautiously.";
  }

  const alert = {
    id: Date.now().toString(),
    region: "Pole 1",
    severity,
    message: msg,
    timestamp: new Date().toISOString()
  };

  if (alertCallback) alertCallback(alert);
});

module.exports = { onNewAlert };
