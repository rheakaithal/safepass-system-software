import { AlertTriangle, CheckCircle, Bell, BellOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.tsx";
import { Badge } from "./ui/badge.tsx";
import { Button } from "./ui/button.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select.tsx";
import { useState } from "react";

export interface FloodAlert {
  id: string;
  poleId: string;
  status: "CRITICAL" | "WARNING" | "SAFE";
  level: number;
  timestamp: Date;
}

interface AlertDashboardProps {
  alerts: FloodAlert[];
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export function AlertDashboard({ alerts, notificationsEnabled, onToggleNotifications }: AlertDashboardProps) {
  const [selectedPole, setSelectedPole] = useState<string>("all");

  // Filter alerts from last 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(alert => alert.timestamp >= twentyFourHoursAgo);

  // Get unique poleIds from recent alerts
  const poleIds = Array.from(new Set(recentAlerts.map(a => a.poleId))).sort();

  // Filter alerts based on selected poleId
  const filteredAlerts = selectedPole === "all" 
    ? recentAlerts 
    : recentAlerts.filter(a => a.poleId === selectedPole);

  const activeAlerts = filteredAlerts.filter(a => a.status !== "SAFE");
  const hasActiveAlerts = activeAlerts.length > 0;

  const getStatusColor = (status: FloodAlert["status"]) => {
    switch (status) {
      case "CRITICAL":
        return "destructive";
      case "WARNING":
        return "default";
      case "SAFE":
        return "secondary";
    }
  };

  const getStatusIcon = (status: FloodAlert["status"]) => {
    if (status === "SAFE") {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    }
    return <AlertTriangle className="h-5 w-5 text-orange-600" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Flood Alerts</h1>
        <Button
          variant={notificationsEnabled ? "default" : "outline"}
          size="sm"
          onClick={onToggleNotifications}
          className="gap-2"
        >
          {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {notificationsEnabled ? "On" : "Off"}
        </Button>
      </div>

      {/* Pole Filter & Status */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedPole} onValueChange={setSelectedPole}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Poles</SelectItem>
            {poleIds.map((pole) => (
               <SelectItem key={pole} value={pole}>
                 {pole}
               </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
           {hasActiveAlerts ? (
             <>
               <AlertTriangle className="h-5 w-5 text-orange-600" />
               <span className="font-semibold">{activeAlerts.length} Active</span>
             </>
           ) : (
             <>
               <CheckCircle className="h-5 w-5 text-green-600" />
               <span className="font-semibold">All Clear</span>
             </>
           )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-2">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              No alerts
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card key={alert.id} className={alert.status === "SAFE" ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(alert.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{alert.poleId}</h3>
                      <Badge variant={getStatusColor(alert.status)} className="text-xs">
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">Level: {alert.level} cm</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}