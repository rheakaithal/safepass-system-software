
// This exists for personal (Rhea's) testing purposes
// Uses public MQTT broker

const mqtt = require("mqtt");

const broker = "mqtt://broker.hivemq.com";
const topic = "safepass/test/rhea123/waterlevel";

const client = mqtt.connect(broker);

client.on("connect", () => {
  console.log("Publishing test data...");

  let level = 0.5;

  setInterval(() => {
    level += 0.5;
    client.publish(topic, level.toString());
    console.log("Published:", level);
  }, 2000);
});



