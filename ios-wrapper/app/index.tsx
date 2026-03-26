import { useEffect, useState } from 'react';
import { WebView } from 'react-native-webview';
import { SafeAreaView, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { registerForPushNotifications } from '@/app/services/notificationService';

export default function HomeScreen() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useEffect(() => {
    let notificationResponseListener: any;

    const setupNotifications = async () => {
      // Register for push notifications
      const token = await registerForPushNotifications();
      if (token) {
        console.log('Expo push token:', token);
        setExpoPushToken(token);
        // TODO: Send token to backend for storing
      }

      // Listen for notification responses (when user taps notification)
      notificationResponseListener = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('Notification tapped:', response);
        const data = response.notification.request.content.data;
        // Handle navigation or other actions based on notification data
        if (data && data.severity) {
          Alert.alert('Flood Alert', `Severity: ${data.severity}`);
        }
      });
    };

    setupNotifications();

    return () => {
      if (notificationResponseListener) {
        notificationResponseListener.remove();
      }
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WebView
        source={{ uri: 'https://sps-tau-taupe.vercel.app/' }}
        bounces={false}
      />
    </SafeAreaView>
  );
}
