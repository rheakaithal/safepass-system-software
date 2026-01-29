import { AlertTriangle, CheckCircle, Bell, BellOff } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { useState } from "react";

export interface FloodAlert {
  id: string;
  region: string;
  severity: "critical" | "warning" | "clear";
  message: string;
  timestamp: Date;
}

interface AlertDashboardProps {
  alerts: FloodAlert[];
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export function AlertDashboard({ alerts, notificationsEnabled, onToggleNotifications }: AlertDashboardProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>("all");

  // Filter alerts from last 24 hours
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentAlerts = alerts.filter(alert => alert.timestamp >= twentyFourHoursAgo);

  // Get unique regions from recent alerts
  const regions = Array.from(new Set(recentAlerts.map(a => a.region))).sort();

  // Filter alerts based on selected region
  const filteredAlerts = selectedRegion === "all" 
    ? recentAlerts 
    : recentAlerts.filter(a => a.region === selectedRegion);

  const activeAlerts = filteredAlerts.filter(a => a.severity !== "clear");
  const hasActiveAlerts = activeAlerts.length > 0;

  const getSeverityColor = (severity: FloodAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "clear":
        return "secondary";
    }
  };

  const getSeverityIcon = (severity: FloodAlert["severity"]) => {
    if (severity === "clear") {
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

      {/* Region Filter & Status */}
      <div className="flex items-center justify-between gap-4">
        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region} value={region}>
                {region}
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
            <Card key={alert.id} className={alert.severity === "clear" ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm">{alert.region}</h3>
                      <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                        {alert.severity === "critical" ? "Critical" : alert.severity === "warning" ? "Warning" : "Clear"}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
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