import { useState, useEffect } from "react";
import { AlertDashboard, FloodAlert } from "@/app/components/AlertDashboard";
import { toast, Toaster } from "sonner";


function App() {
  const [alerts, setAlerts] = useState<FloodAlert[]>(generateMockAlerts());
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    // Check initial notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === "granted") {
        setNotificationsEnabled(true);
        toast.success("Notifications enabled successfully");
        
        // Send a test notification
        new Notification("Flood Alert System", {
          body: "You will now receive flood alerts",
          icon: "/favicon.ico",
          badge: "/favicon.ico",
        });
      } else {
        toast.error("Notification permission denied");
      }
    } else {
      toast.error("Notifications not supported in this browser");
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

  // Simulate receiving new alerts
  useEffect(() => {
  const socket = new WebSocket("ws://YOUR_SERVER_IP:3000");

  socket.onmessage = (event) => {
    const alert: FloodAlert = {
      ...JSON.parse(event.data),
      timestamp: new Date(JSON.parse(event.data).timestamp),
    };

    setAlerts((prev) => [alert, ...prev].slice(0, 10));

    if (
      notificationsEnabled &&
      notificationPermission === "granted" &&
      alert.severity === "critical"
    ) {
      new Notification(`Flood Alert: ${alert.region}`, {
        body: alert.message,
        icon: "/favicon.ico",
      });

      toast.error(`${alert.region}: ${alert.message}`);
    }
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