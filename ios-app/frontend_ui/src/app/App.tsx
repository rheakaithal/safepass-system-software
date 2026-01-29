import { useState, useEffect } from "react";
import { AlertDashboard, FloodAlert } from "@/app/components/AlertDashboard";
import { toast, Toaster } from "sonner";

// Mock data generator for demo purposes
const generateMockAlerts = (): FloodAlert[] => {
  return [
    {
      id: "1",
      region: "Pole 1",
      severity: "critical",
      message: "Floodwaters present. Road closed for civilian safety.",
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    },
    {
      id: "2",
      region: "Pole 2",
      severity: "warning",
      message: "Heavy rain in the area. Drive cautiously.",
      timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    },
    {
      id: "3",
      region: "Pole 1",
      severity: "clear",
      message: "Roads clear. Safe to drive.",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  ];
};

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
    const interval = setInterval(() => {
      // Randomly generate a new alert every 30 seconds (for demo purposes)
      const shouldGenerateAlert = Math.random() > 0.7;
      
      if (shouldGenerateAlert) {
        const regions = ["Pole 1", "Pole 2"];
        const severities: FloodAlert["severity"][] = ["warning", "critical", "clear"];
        const messages = {
          warning: "Heavy rain in the area. Drive cautiously.",
          critical: "Floodwaters present. Road closed for civilian safety.",
          clear: "Roads clear. Safe to drive.",
        };

        const severity = severities[Math.floor(Math.random() * severities.length)];
        const newAlert: FloodAlert = {
          id: Date.now().toString(),
          region: regions[Math.floor(Math.random() * regions.length)],
          severity,
          message: messages[severity],
          timestamp: new Date(),
        };

        setAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // Keep only last 10 alerts

        // Send browser notification if enabled
        if (notificationsEnabled && notificationPermission === "granted") {
          new Notification(`Flood Alert: ${newAlert.region}`, {
            body: newAlert.message,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: newAlert.id,
          });
        }

        // Show toast notification
        if (severity === "critical") {
          toast.error(`${newAlert.region}: ${newAlert.message}`);
        } else if (severity === "warning") {
          toast.warning(`${newAlert.region}: ${newAlert.message}`);
        } else {
          toast.success(`${newAlert.region}: ${newAlert.message}`);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
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