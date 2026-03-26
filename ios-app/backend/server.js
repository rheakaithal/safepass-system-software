const WebSocket = require("ws");
// TEST mode
const { registerAlertHandler } = require("./test/testSub_public");

// PROD Mode
// const { registerAlertHandler } = require("./subscriber");

const wss = new WebSocket.Server({ port: 3000 });
console.log("WebSocket server running on 3000");

registerAlertHandler((alert) => {
  console.log("Broadcasting alert:", alert);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(alert));
    }
  });
});

client.on("message", (topic, message) => {
  console.log("Alert received:", message.toString());
});

client.on("error", (err) => {
  console.error("MQTT error:", err);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "alert-server" });
});

app.listen(port, () => {
  console.log(`Alert server running on port ${port}`);
});
