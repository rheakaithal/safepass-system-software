import React, { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, ScrollView, Platform } from 'react-native';
import mqtt from '@taoqf/react-native-mqtt';
import { NativeAlertDashboard } from './NativeAlertDashboard';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { MQTT_BROKER_URL, MQTT_OPTIONS, TOPICS, ALERT_HISTORY_LIMIT } from './config';

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
        setAlerts((prevAlerts) => [newAlert, ...prevAlerts].slice(0, ALERT_HISTORY_LIMIT));
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
