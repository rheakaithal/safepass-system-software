import React, { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import mqtt from '@taoqf/react-native-mqtt'; 
import { NativeAlertDashboard } from './NativeAlertDashboard';

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    // 1. Connect to the Native MQTT Broker via wss
    const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');

    client.on('connect', () => {
      console.log('Connected to MQTT Broker via wss');
      client.subscribe('safepass/alerts');
    });

    client.on('message', (topic, message) => {
      try {
        const raw = JSON.parse(message.toString());
        
        const newAlert = {
          id: Date.now().toString() + '-' + raw.poleId,
          poleId: raw.poleId,
          level: raw.level,
          status: raw.status,
          timestamp: new Date(raw.timestamp)
        };

        // Prepend new alert to the top of the list
        setAlerts((prevAlerts) => [newAlert, ...prevAlerts].slice(0, 50));
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    return () => {
      client.end();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <NativeAlertDashboard 
          alerts={alerts}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={() => setNotificationsEnabled(!notificationsEnabled)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    padding: 16,
    paddingTop: 40,
  }
});
