const WebSocket = require("ws");
const { registerAlertHandler } = require("./subscriber");

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
