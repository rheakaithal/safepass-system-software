# SafePass System Software

A comprehensive flood alert notification system with backend data ingestion using MQTT, GUI interface, and an iOS app for real-time flood risk alerts.

## Folder Structure

### `/backend`
Backend services and MQTT integration:
- `MQTT_subscriber/` - MQTT subscriber for app 
- `MQTT_testCode/` - Test Pub/Sub with local MQTT Broker (hosted through Robert's machine)
- `public_broker/` - Test Pub/Sub with public MQTT broker for 24/7 testing ability
- `SQL/` - SQL database backend with Express API

### `/GUIv2`
Main web-based GUI for monitoring water levels and flood predictions

### `/GUIv3`
Alternative GUI version with location-based pages

### `/SPS_Dashboard`
RIPPLE Systems dashboard interface

### `/ios-app`
iOS app frontend (React-based) with UI components and navigation

### `/docs`
Documentation including database schema
- MQTT Username: `Sensor` / Password: `Team13Capstone`
- Database: `my_database`