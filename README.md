# SafePass System Software
This is a repository for any and all software required for the RIPPLE roadside flood-detection system, notably the civilian-alert app and the EMS monitoring dashboard.

The software system ingests sensor data via MQTT, stores it in a MySQL database via a REST API, and delivers real-time push notifications to users through a React Native iOS app. A static web dashboard provides an overview of monitored locations including graphical analysis of flood trends.

## Repository Structure

```
safepass-system-software/
├── sensor-backend/    # MQTT test scripts and SQL/Express API backend
├── ios-app/           # React Native (Expo) mobile app with push notifications
├── sps-dashboard/     # HTML web dashboard for RIPPLE Systems
└── docs/              # Database schema and documentation
```

---

### `/sensor-backend`

Backend services for MQTT testing and database integration.

- **`MQTT_testCode/`** — Python scripts for testing MQTT publish/subscribe against a local broker
  - `demoPublish.py` — Demo sensor data publisher
  - `testPublish.py` — Minimal publish test
  - `testDatabaseSubscriberScript.py` — Subscriber that writes incoming messages to the database
- **`SQL/`** — Express.js REST API with MySQL integration
  - `src/index.js` — API entry point
  - `src/db.js` — MySQL connection
  - `src/routes/` — API route handlers
  - `.env.example` — Template for required environment variables

### `/ios-app`

React Native mobile application (Expo) providing real-time flood alerts via push notifications.

- `App.js` — App root and navigation
- `NativeAlertDashboard.js` — Main alert dashboard screen
- `config.js` — Centralized configuration (broker URL, thresholds, etc.)
- `backend/` — Node.js MQTT subscriber service that bridges MQTT messages to Expo push notifications
  - `subscriber.js` — Core MQTT → push notification bridge
  - `config.js` — Backend-specific configuration
  - `testPublish.js` / `interactiveTest.js` — Testing utilities

### `/sps-dashboard`

Static HTML/CSS/JS web dashboard for the RIPPLE Systems interface. Includes pages for home, FAQ, settings, and location-specific content.

### `/docs`

Project documentation and database assets.

- `schema.sql` — MySQL database schema

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native (Expo) |
| Push Notifications | Expo Push Notification Service |
| MQTT Broker | Public broker (HiveMQ / configurable) |
| Backend API | Node.js + Express |
| Database | MySQL |
| Dashboard | Static HTML/CSS/JS |
| Test Scripts | Python (`paho-mqtt`) |

## Getting Started

### Prerequisites
- Node.js (v18+)
- Python 3 with `paho-mqtt` installed (`pip install paho-mqtt`)
- MySQL database instance
- Expo CLI (`npm install -g expo-cli`)

### Running the SQL API

```bash
cd sensor-backend/SQL
cp .env.example .env   # fill in DB credentials
npm install
npm start
```

### Running the iOS App

```bash
cd ios-app
npm install
npx expo start
```

### Running the MQTT → Push Notification Bridge

```bash
cd ios-app/backend
npm install
node subscriber.js
```

### Running MQTT Test Scripts

```bash
cd sensor-backend/MQTT_testCode
python testPublish.py
```
