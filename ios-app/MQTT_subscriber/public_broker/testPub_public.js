const mqtt = require("mqtt");

const broker = "mqtt://broker.hivemq.com";
const topic = "safepass/test/rhea123/waterlevel";

const client = mqtt.connect(broker);

client.on("connect", () => {
  console.log("Publishing test data...");

  let level = 50;

  setInterval(() => {
    level += 5;
    client.publish(topic, level.toString());
    console.log("Published:", level);
  }, 2000);
});
