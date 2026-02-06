import { useEffect, useRef, useState } from "react";
import { AlertDashboard, FloodAlert } from "./components/AlertDashboard.tsx";
import { toast, Toaster } from "sonner";

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

  // WebSocket connection (NO polling)
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000");

    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    socket.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);

        const alert: FloodAlert = {
          ...raw,
          timestamp: new Date(raw.timestamp),
        };

        setAlerts((prev) => [alert, ...prev].slice(0, 10));

        // Toast notifications
        if (alert.severity === "critical") {
          toast.error(`${alert.region}: ${alert.message}`);
        } else if (alert.severity === "warning") {
          toast.warning(`${alert.region}: ${alert.message}`);
        } else {
          toast.success(`${alert.region}: ${alert.message}`);
        }

        // Browser notification (critical only, deduped)
        if (
          notificationsEnabled &&
          notificationPermission === "granted" &&
          alert.severity === "critical" &&
          lastAlertIdRef.current !== alert.id
        ) {
          lastAlertIdRef.current = alert.id;

          new Notification(`Flood Alert: ${alert.region}`, {
            body: alert.message,
            icon: "/favicon.ico",
            tag: alert.id,
          });
        }
      } catch (err) {
        console.error("Invalid WebSocket message:", err);
      }
    };

    socket.onerror = (err) => {
      console.error("WebSocket error", err);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    return () => socket.close();
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
