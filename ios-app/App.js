import React, { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, ScrollView, Platform } from 'react-native';
import mqtt from '@taoqf/react-native-mqtt';
import { NativeAlertDashboard } from './NativeAlertDashboard';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MQTT_BROKER_URL, MQTT_OPTIONS, TOPICS, ALERT_HISTORY_LIMIT, ALERT_WINDOW_HOURS, DEMO_CLEAR_INTERVAL_MS } from './config';

const ALERTS_STORAGE_KEY = 'safepass_alerts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [connected, setConnected] = useState(false);

  const handleClear = () => {
    setAlerts([]);
    AsyncStorage.removeItem(ALERTS_STORAGE_KEY)
      .catch(e => console.error('Failed to clear alerts:', e));
  };

  // Load persisted alerts on boot, filtered to the active window
  useEffect(() => {
    AsyncStorage.getItem(ALERTS_STORAGE_KEY).then(stored => {
      if (!stored) return;
      const cutoff = Date.now() - ALERT_WINDOW_HOURS * 60 * 60 * 1000;
      const parsed = JSON.parse(stored)
        .filter(a => new Date(a.timestamp).getTime() > cutoff)
        .map(a => ({ ...a, timestamp: new Date(a.timestamp) }));
      if (parsed.length > 0) setAlerts(parsed);
    }).catch(e => console.error('Failed to load alerts from storage:', e));
  }, []);

  // Demo mode: auto-clear all alerts on a fixed interval
  useEffect(() => {
    if (!DEMO_CLEAR_INTERVAL_MS) return;
    const timer = setInterval(() => {
      console.log('Demo clear: wiping alert history');
      setAlerts([]);
      AsyncStorage.removeItem(ALERTS_STORAGE_KEY)
        .catch(e => console.error('Failed to clear alerts from storage:', e));
    }, DEMO_CLEAR_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Connect to the Native MQTT Broker via wss
    const client = mqtt.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

    client.on('connect', () => {
      setConnected(true);
      console.log('Connected to MQTT Broker via wss');
      client.subscribe(TOPICS.ALERTS);
      
      // Setup push notifications
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          setExpoPushToken(token);
          client.publish(TOPICS.TOKENS, JSON.stringify({ token }), { qos: 1 });
        }
      });
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
        setAlerts((prevAlerts) => {
          const updated = [newAlert, ...prevAlerts].slice(0, ALERT_HISTORY_LIMIT);
          AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated))
            .catch(e => console.error('Failed to persist alerts:', e));
          return updated;
        });
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    });

    client.on('reconnect', () => setConnected(false));
    client.on('offline', () => setConnected(false));

    return () => {
      client.end();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <NativeAlertDashboard 
          alerts={alerts}
          connected={connected}
          onClear={handleClear}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0f172a',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId || "8226b785-3cde-489a-b968-8a477c672dc9";
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('Push token generated successfully!');
    } catch (e) {
      console.error(e);
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
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
