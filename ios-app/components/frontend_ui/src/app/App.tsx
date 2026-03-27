import { useEffect, useRef, useState } from "react";
import { AlertDashboard, FloodAlert } from "./components/AlertDashboard.tsx";
import { toast, Toaster } from "sonner";
import mqtt from "mqtt";

function App() {
  const [alerts, setAlerts] = useState<FloodAlert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");

  // Track last alert ID to avoid duplicate notifications
  const lastAlertIdRef = useRef<string | null>(null);

  // Check notification permission on load
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications not supported in this browser");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "granted") {
      setNotificationsEnabled(true);
      toast.success("Notifications enabled");

      new Notification("Flood Alert System", {
        body: "You will now receive flood alerts",
        icon: "/favicon.ico",
      });
    } else {
      toast.error("Notification permission denied");
    }
  };

  const handleToggleNotifications = () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      toast.info("Notifications disabled");
    } else {
      if (notificationPermission === "granted") {
        setNotificationsEnabled(true);
        toast.success("Notifications enabled");
      } else {
        requestNotificationPermission();
      }
    }
  };

  // MQTT Connection
  useEffect(() => {
    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

    client.on("connect", () => {
      console.log("MQTT connected to wss://broker.hivemq.com:8884/mqtt");
      client.subscribe("safepass/alerts");
    });

    client.on("message", (topic, message) => {
      try {
        const raw = JSON.parse(message.toString());

        const alert: FloodAlert = {
          id: Date.now().toString() + "-" + raw.poleId,
          poleId: raw.poleId,
          status: raw.status,
          level: raw.level,
          timestamp: new Date(raw.timestamp),
        };

        setAlerts((prev) => [alert, ...prev].slice(0, 10));

        const msgStr = `Level: ${alert.level} cm`;

        // Toast notifications
        if (alert.status === "CRITICAL") {
          toast.error(`${alert.poleId}: ${msgStr}`);
        } else if (alert.status === "WARNING") {
          toast.warning(`${alert.poleId}: ${msgStr}`);
        } else {
          toast.success(`${alert.poleId}: ${msgStr}`);
        }

        // Browser notification (critical only, deduped)
        if (
          notificationsEnabled &&
          notificationPermission === "granted" &&
          alert.status === "CRITICAL" &&
          lastAlertIdRef.current !== alert.id
        ) {
          lastAlertIdRef.current = alert.id;

          new Notification(`Flood Alert: ${alert.poleId}`, {
            body: msgStr,
            icon: "/favicon.ico",
            tag: alert.id,
          });
        }
      } catch (err) {
        console.error("Invalid MQTT message:", err);
      }
    });

    client.on("error", (err) => {
      console.error("MQTT error", err);
    });

    return () => {
      client.end();
    };
  }, [notificationsEnabled, notificationPermission]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <AlertDashboard
          alerts={alerts}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
        />
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
