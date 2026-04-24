// ─── SafePass Mobile App Config ───────────────────────────────────────────
// Single source of truth for all mobile app constants.
// Update values here — never hardcode them in components.

// MQTT broker URL (WSS required for React Native)
// Used in: App.js → mqtt.connect()
export const MQTT_BROKER_URL = 'wss://83ad0f202f85425e99ee81ecdda5e543.s1.eu.hivemq.cloud:8884/mqtt';

// MQTT connection options — reconnection + keepalive behaviour
// Used in: App.js → mqtt.connect()
export const MQTT_OPTIONS = {
  username: 'testuser',
  password: 'Team13Capstone',
  reconnectPeriod: 5000,  // retry every 5s after a disconnect
  connectTimeout: 30000,  // 30s to establish initial connection
  keepalive: 60,          // send MQTT ping every 60s to detect dead connections
};

// MQTT topics the app subscribes to or publishes on
// Used in: App.js → client.subscribe() / client.publish()
export const TOPICS = {
  ALERTS: 'safepass/alerts',   // processed alerts published by subscriber.js
  TOKENS: 'safepass/tokens',   // push token registration channel
};

// Poles always shown in the filter bar, even before any alert data arrives
// Used in: NativeAlertDashboard.js → pole filter buttons
export const PREDEFINED_POLES = ['Pole 1', 'Pole 2'];

// Water level classification thresholds (inches)
// NOTE: Must match THRESHOLDS in backend/config.js — keep both in sync
// Used in: NativeAlertDashboard.js → alert messages (informational reference only;
//          actual classification happens server-side in backend/subscriber.js)
export const THRESHOLDS = {
  CRITICAL: 6,
  WARNING: 2,
};

// Max number of alerts kept in memory at any time (prevents unbounded growth)
// Used in: App.js → setAlerts() slice
export const ALERT_HISTORY_LIMIT = 50;

// Demo mode: clear all alerts every N milliseconds (set to 0 to disable)
export const DEMO_CLEAR_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// How many hours back the UI displays alerts (older alerts are filtered out)
// Used in: NativeAlertDashboard.js → 24hr filter
export const ALERT_WINDOW_HOURS = 24;
