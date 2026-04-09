# RIPPLE Alert — iOS/Android Mobile App

A real-time flood alert app for the SafePass system. Receives live water level data from field sensors via MQTT and delivers native push notifications to civilian devices when road conditions become dangerous.

---

## How It Works

```
MCU Sensor
    │  publishes raw water level readings every ~5 min
    ▼
HiveMQ MQTT Broker (cloud, public)
    │
    ├──► backend/subscriber.js  (running on Render.com)
    │         │  classifies level → SAFE / WARNING / CRITICAL
    │         │  publishes processed alert to safepass/alerts
    │         └─ calls Expo Push API → native OS notification on phones
    │
    └──► App.js (on device, when app is open)
              │  subscribes to safepass/alerts
              └─ updates UI in real-time via NativeAlertDashboard.js
```

Push notifications are handled server-side so alerts reach users **even when the app is closed**.

---

## Project Structure

```
ios-app/
├── App.js                   # Entry: MQTT connection, push token registration, alert state
├── NativeAlertDashboard.js  # UI: accordion alert cards, pole filter, status indicators
├── index.js                 # Expo root registration (do not modify)
├── config.js                # ⚙️  All mobile app constants (broker URL, topics, thresholds)
├── app.json                 # Expo + EAS project config
├── assets/                  # App icons, splash screen, header logo
├── TESTING.md               # Step-by-step guide for running a live demo
│
└── backend/
    ├── subscriber.js        # Production MQTT processor (deployed to Render.com)
    ├── interactiveTest.js   # Demo tool: simulates sensor data interactively via CLI
    ├── testPublish.js       # Automated sim: publishes continuous random readings
    └── config.js            # ⚙️  All backend constants (broker URL, topics, thresholds, poles)
```

---

## Configuration

All tuneable values live in **one place per environment** — never scattered across files.

| File | For | Key values |
|---|---|---|
| `config.js` | Mobile app | Broker URL (WSS), MQTT options, topics, pole list, thresholds, history limit |
| `backend/config.js` | Node.js backend | Broker URL (MQTT), MQTT options, topics, pole list, thresholds, Expo push URL |

> **To add a new pole:** add its name to `PREDEFINED_POLES` in `config.js` and `POLES` in `backend/config.js`.  
> **To adjust flood thresholds:** edit `THRESHOLDS` in both config files (keep them in sync).

---

## Running Locally

### Mobile App
```bash
# From ios-app/
npx expo start --tunnel
```
Scan the QR code with **Expo Go** on a physical device. Push notifications require a physical device — simulators cannot generate Expo Push Tokens.

### Backend (MQTT Processor)
```bash
# From ios-app/backend/
node subscriber.js
```

### Interactive Demo (recommended for testing)
```bash
# From ios-app/backend/ — boots subscriber automatically, accepts CLI sensor input
node interactiveTest.js
```
See `TESTING.md` for the full step-by-step testing guide.

---

## Deployment

| Component | Platform | Notes |
|---|---|---|
| Mobile app | Expo / EAS | Build with `eas build`, distribute via `eas submit` |
| `backend/subscriber.js` | Render.com (Web Service) | Auto-deploys on push to `main`. Deployed URL is unused — it exists only to satisfy Render's port binding requirement. |

The backend uses **automatic MQTT reconnection** (5s retry, 60s keepalive). The MCU's 5-minute sensor heartbeat keeps the Render service active and prevents spin-down.

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `expo` | Mobile app runtime and build tooling |
| `expo-notifications` | Native push notification registration and handling |
| `expo-device` | Detects physical device vs simulator |
| `@taoqf/react-native-mqtt` | MQTT client for React Native (WSS support) |
| `lucide-react-native` | Icon set used in alert cards |
| `mqtt` *(backend)* | MQTT client for Node.js |
