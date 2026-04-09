// ─── SafePass Backend Config ───────────────────────────────────────────────
// Single source of truth for all backend constants.
// Update values here — never hardcode them in subscriber/test scripts.

// MQTT broker URL (plain MQTT for Node.js — note: App.js uses WSS variant)
// Used in: subscriber.js, interactiveTest.js, testPublish.js → mqtt.connect()
const MQTT_BROKER_URL = 'mqtt://broker.hivemq.com';

// MQTT connection options — reconnection + keepalive behaviour
// Used in: subscriber.js, interactiveTest.js, testPublish.js → mqtt.connect()
const MQTT_OPTIONS = {
  reconnectPeriod: 5000,  // retry every 5s after a disconnect
  connectTimeout: 30000,  // 30s to establish initial connection
  keepalive: 60,          // send MQTT ping every 60s to detect dead connections
};

// MQTT topics
// Used in: subscriber.js → subscribe/publish, interactiveTest.js → publish/subscribe, testPublish.js → publish
const TOPICS = {
  SENSOR_WILDCARD: 'safepass/sensors/+/waterlevel', // wildcard sub for all poles
  SENSOR_BASE:     'safepass/sensors',               // base path; append /<poleId>/waterlevel to publish
  ALERTS:          'safepass/alerts',                // processed alerts → consumed by mobile app
  TOKENS:          'safepass/tokens',                // push token registration channel
};

// Valid pole IDs — add new poles here when hardware is extended
// Used in: interactiveTest.js → input validation, testPublish.js → default pole
const POLES = ['Pole 1', 'Pole 2'];

// Water level classification thresholds (inches)
// NOTE: Must match THRESHOLDS in ../config.js — keep both in sync
// Used in: subscriber.js → classify()
const THRESHOLDS = {
  CRITICAL: 6,  // >= 6 in → road closed
  WARNING:  2,  // >= 2 in → heavy rain warning
};

// Expo Push Notification API endpoint
// Used in: subscriber.js → sendPushNotification()
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

module.exports = { MQTT_BROKER_URL, MQTT_OPTIONS, TOPICS, POLES, THRESHOLDS, EXPO_PUSH_URL };
