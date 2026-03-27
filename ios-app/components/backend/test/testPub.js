// Uses HiveMQ Cloud broker (Robert's setup)

const mqtt = require("mqtt");

const broker = "mqtts://83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud:8883";

const options = {
  username: "Sensor",
  password: "Team13Capstone",
};

// Match Python test values
const pole_id = 2;
let waterlevel = 0.5;

const getTopic = () => `sensors/${pole_id}/waterlevel`;

const client = mqtt.connect(broker, options);

client.on("connect", () => {
  console.log("Connected to HiveMQ Cloud");
  console.log("Publishing test data...");

  setInterval(() => {
    waterlevel += 0.5;

    const topic = getTopic();
    const payload = waterlevel.toString();

    client.publish(topic, payload, { qos: 1 });
    console.log(`Published → Topic: ${topic}, Payload: ${payload}`);
  }, 2000);
});
