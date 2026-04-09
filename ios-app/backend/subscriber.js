// MQTT processor: Subscribes to raw sensor data and publishes processed alerts
const mqtt = require("mqtt");

// Connect to HiveMQ broker
const client = mqtt.connect("mqtt://broker.hivemq.com");

// Device Push Token Registry
const registeredTokens = new Set();

// Track the last known status for each pole to avoid redundant consecutive alerts
const poleStates = {};

// Classification logic
function classify(level) {
  if (level >= 6) return "CRITICAL";
  if (level >= 2) return "WARNING";
  return "SAFE";
}

client.on("connect", () => {
  console.log("MQTT connected to broker");
  // Subscribe to raw sensor data and token feeds
  client.subscribe("safepass/sensors/+/waterlevel", { qos: 1 }, (err) => {
    if (err) console.error("Subscribe error:", err);
    else console.log("Subscribed to: safepass/sensors/+/waterlevel");
  });
  client.subscribe("safepass/tokens", { qos: 1 });
});

client.on("message", (topic, message) => {
  // Save mobile Push Notifications tokens if they exist
  if (topic === "safepass/tokens") {
    try {
      const data = JSON.parse(message.toString());
      if (data.token && !registeredTokens.has(data.token)) {
        registeredTokens.add(data.token);
        console.log(`Registered Push Device. Total active devices: ${registeredTokens.size}`);
      }
    } catch(e) { console.error("Bad token payload", e); }
    return; // ensure we stop executing alerts code
  }

  try {
    const data = JSON.parse(message.toString());
    const newStatus = classify(data.level);
    
    // Only process and publish if this status is different from the previous one
    if (poleStates[data.poleId] !== newStatus) {
      poleStates[data.poleId] = newStatus; // Update known state

      // Process the raw data into an alert format
      const alert = {
        poleId: data.poleId,
        level: data.level,
        status: newStatus,
        timestamp: Date.now(),
      };

      console.log(`Publishing State Change Alert:`, alert);

      // Publish processed alert to alerts topic
      client.publish("safepass/alerts", JSON.stringify(alert), { qos: 1 });

      // Remotely Ping Registered External Phones
      sendPushNotification(newStatus, alert.poleId, alert);
    }
  } catch (error) {
    console.error("Failed to process message:", error);
  }
});

async function sendPushNotification(status, poleId, alertData) {
  if (registeredTokens.size === 0) return;

  const title = status === 'CRITICAL' ? '🚨 CRITICAL ALERT' : status === 'WARNING' ? '⚠️ WARNING' : '✅ ALL CLEAR';
  const body = status === 'CRITICAL' ? `Floodwaters detected at ${poleId}. Road closed.` : 
               status === 'WARNING' ? `${poleId} reporting Heavy Rain.` : 
               `${poleId} is clear and safe.`;

  const pushMessages = Array.from(registeredTokens).map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: { alertData },
  }));

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushMessages),
    });
    console.log(`Sent ${pushMessages.length} Push Notifications | Expo API Response: ${res.status}`);
  } catch (err) {
    console.error('Failed to dispatch notifications to Expo:', err);
  }
}

client.on("error", (err) => {
  console.error("MQTT error:", err);
});

// Dummy HTTP server to satisfy Render.com Web Service Port binding requirements
const http = require('http');
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SafePass MQTT Backend is active.\n');
}).listen(PORT, () => {
  console.log(`Dummy health port listening on port ${PORT} to satisfy Render`);
});
