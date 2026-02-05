const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const { onNewAlert } = require("./public_broker/testSub_public");

const app = express();
app.use(cors());

let alerts = [];

app.get("/api/alerts", (req, res) => {
  res.json(alerts);
});

const server = app.listen(3000, () =>
  console.log("REST API running on port 3000")
);

const wss = new WebSocket.Server({ server });

onNewAlert((alert) => {
  alerts.unshift(alert);
  alerts = alerts.slice(0, 10);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(alert));
    }
  });
});
